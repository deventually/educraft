/**
 * The one team page (plan step 5, BESLUIT-2026-11-16-7): `/teams/:id` for the admin, the
 * team's lead and a plain member, with more or fewer controls per role.
 * - **admin** (with two-step verification, as on every admin page): everything, on any team.
 * - **lead**: the lead functions of `teams.server.ts`, each scoped to the caller again.
 * - **member**: reads names, who leads and the programmes; the action is a 404.
 * Anyone else gets a 404. The team is the one in the URL; a `teamId` in a form is ignored.
 */
import { requireRole, requireUser } from "./auth.server";
import { redirectWithFlash } from "./flash.server";
import { resolveModelInfo } from "~/lib/ai/models";
import {
  applyTeamExtraModels,
  applyTeamSettingsForm,
  getTeamSettingsOffer,
} from "./teamSettings.server";
import {
  addMember,
  deleteTeam,
  getTeamForLead,
  getTeamWithMembers,
  leadAddMembers,
  leadCandidates,
  leadCreateInvite,
  leadMakeLead,
  leadRemoveMember,
  leadSetSettings,
  leadStepDown,
  removeMember,
  renameTeam,
  setLead,
  setTeamSettings,
} from "./repositories/teams.server";
import { getTeamForMember } from "./repositories/teamView.server";
import { getUserById, listPeople } from "./repositories/users.server";
import {
  getDivisionKind,
  listDivisions,
  setTeamDivision,
  teamDivisionId,
} from "./repositories/organisation.server";
import { listProgrammes } from "./repositories/programmes.server";
import {
  linkProgrammeTeam,
  programmeChoices,
  unlinkProgrammeTeam,
} from "./repositories/programmeTeams.server";
import { getTeamTemplate } from "./repositories/slideTemplates.server";
import { divisionWord } from "~/lib/organisation/kinds";
import { getLocale } from "~/lib/i18n/locale.server";
import { loc } from "~/lib/i18n/localized";

const MAX = 500;
/** Days a lead's invite link stays valid (the admin's default). */
const INVITE_DAYS = 14;
const notFound = () => new Response("Not found", { status: 404 });

/** Who the caller is to this team, with the team as that role may see it. */
async function standing(request: Request, teamId: string) {
  const user = await requireUser(request);
  if (user.role === "admin") {
    const admin = await requireRole(request, "admin");
    const team = await getTeamWithMembers(teamId);
    return team ? { role: "admin" as const, user: admin, team } : null;
  }
  const led = await getTeamForLead(user.id, teamId);
  if (led) return { role: "lead" as const, user, team: led };
  const read = await getTeamForMember(user.id, teamId);
  return read ? { role: "member" as const, user, team: read } : null;
}

/** Ids with their display names (an unknown id keeps its id). */
function namesOf(ids: string[] | undefined): { id: string; displayName: string }[] {
  return (ids ?? []).map((id) => ({ id, displayName: resolveModelInfo(id).displayName }));
}

export async function loadTeamPage(request: Request, teamId: string) {
  const s = await standing(request, teamId);
  if (!s) throw notFound();
  const { role, user, team } = s;
  const manages = role !== "member";
  const programmes = (await listProgrammes(user, MAX))
    .filter((p) => p.teamIds.includes(team.id))
    .map(({ id, name }) => ({ id, name }));
  const admin = role === "admin";
  const [offer, divisions, divisionId, kind] = await Promise.all([
    manages ? getTeamSettingsOffer(admin) : null,
    admin ? listDivisions() : [],
    admin ? teamDivisionId(team.id) : null,
    getDivisionKind(),
  ]);
  return {
    role,
    selfId: user.id,
    team,
    candidates: admin
      ? await adminCandidates(team)
      : ((await leadCandidates(user.id, team.id)) ?? []),
    // The team's own expensive models may be its default too (BESLUIT-2026-11-18-5).
    offer:
      offer && "settings" in team
        ? { ...offer, teamExtras: namesOf(team.settings.extraModels) }
        : offer,
    programmes,
    // The programmes this team may still join (BESLUIT-2026-11-16-4); none for a member.
    programmeChoices: manages ? await programmeChoices(user, team.id) : [],
    divisions: divisions.map(({ id, name }) => ({ id, name })),
    divisionId,
    // Where the team belongs, as one choice: its programmes, a faculty, or the institution.
    belongs: (programmes.length > 0 ? "programmes" : divisionId ? "division" : "institution") as
      | "programmes"
      | "division"
      | "institution",
    divisionWord: loc(divisionWord(kind), getLocale(request)),
    // The team's PowerPoint template (P30.7b): the lead's to set.
    slideTemplate: role === "lead" ? await getTeamTemplate(user.id, team.id) : null,
  };
}

/** Every active account not yet in the team, for the admin's Leden toevoegen. */
async function adminCandidates(team: { members: { userId: string }[] }) {
  const inTeam = new Set(team.members.map((m) => m.userId));
  return (await listPeople({ status: "active", limit: MAX }))
    .filter((p) => p.kind === "user" && !inTeam.has(p.id))
    .map((p) => ({ id: p.id, name: p.name ?? p.email ?? p.id, email: p.email }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

type Result = { saved: true } | { error: string } | { link: string } | Response;
const done = (r: { ok: true } | { error: string }): Result =>
  "ok" in r ? { saved: true } : { error: r.error };

export async function teamPageAction(request: Request, teamId: string): Promise<Result> {
  const s = await standing(request, teamId);
  // notFound before anything is read from the form; a member changes nothing.
  if (!s || s.role === "member") throw notFound();
  const { role, user, team } = s;
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  const userId = String(fd.get("userId") ?? "");
  const programmeId = String(fd.get("programmeId") ?? "");

  if (intent === "addMembers") {
    const ids = [...new Set(fd.getAll("userIds").map(String))].slice(0, MAX);
    if (ids.length === 0) return { error: "noneSelected" };
    if (role === "lead") return done(await leadAddMembers(user.id, team.id, ids));
    // Only existing accounts; an unknown id is skipped.
    for (const id of ids) if (await getUserById(id)) await addMember(team.id, id);
    return { saved: true };
  }
  if (intent === "removeMember") {
    if (role === "lead") return done(await leadRemoveMember(user.id, team.id, userId));
    await removeMember(team.id, userId);
    return { saved: true };
  }
  if (intent === "linkProgramme") {
    const ids = [...new Set(fd.getAll("programmeId").map(String))].slice(0, 100);
    if (ids.length === 0) return { error: "noneSelected" };
    let linked = 0;
    for (const id of ids) if (await linkProgrammeTeam(user, id, team.id)) linked++;
    return linked ? { saved: true } : { error: "unknown" };
  }
  if (intent === "unlinkProgramme") {
    return (await unlinkProgrammeTeam(user, programmeId, team.id)) === "unlinked"
      ? { saved: true }
      : { error: "unknown" };
  }
  if (intent === "settings" && "settings" in team) {
    // Within the instance's limits: only what is not Off is offered and changed.
    const next = applyTeamSettingsForm(team.settings, fd, await getTeamSettingsOffer());
    if ("error" in next) return next;
    if (role === "lead") return done(await leadSetSettings(user.id, team.id, next));
    await setTeamSettings(team.id, next);
    return { saved: true };
  }
  if (role === "lead") return leadOnly(request, intent, user.id, team.id, fd, userId);
  // Expensive models for this team (BESLUIT-2026-11-18-5): the admin's alone.
  if (intent === "teamExtraModels" && "settings" in team) {
    await setTeamSettings(team.id, applyTeamExtraModels(team.settings, fd));
    return { saved: true };
  }
  return adminOnly(intent, user, team.id, fd, userId);
}

async function leadOnly(
  request: Request,
  intent: string,
  callerId: string,
  teamId: string,
  fd: FormData,
  userId: string,
): Promise<Result> {
  if (intent === "makeLead") return done(await leadMakeLead(callerId, teamId, userId));
  if (intent === "stepDown") {
    await leadStepDown(callerId, teamId);
    // This page no longer has your buttons: back to the overview of your teams.
    return redirectWithFlash("/teams", "steppedDown");
  }
  if (intent === "invite") {
    const note = String(fd.get("note") ?? "").trim() || null;
    const res = await leadCreateInvite(callerId, teamId, {
      note,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
    });
    if (!("token" in res)) throw notFound();
    return { link: `${new URL(request.url).origin}/invite/${res.token}` };
  }
  return { error: "unknown" };
}

async function adminOnly(
  intent: string,
  admin: { id: string; role: string },
  teamId: string,
  fd: FormData,
  userId: string,
): Promise<Result> {
  if (intent === "rename") {
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return { error: "nameRequired" };
    await renameTeam(teamId, name);
    return { saved: true };
  }
  if (intent === "setLead") {
    await setLead(teamId, userId, fd.get("lead") === "1");
    return { saved: true };
  }
  if (intent === "belongs") return chooseBelongs(admin, teamId, fd);
  if (intent === "delete") {
    await deleteTeam(teamId);
    return redirectWithFlash("/teams", "teamDeleted");
  }
  return { error: "unknown" };
}

/**
 * "Waar hoort dit team bij?" (plan step 5): its programmes, a faculty or the whole institution.
 * A team in programmes belongs to them; a faculty or the institution comes only after its
 * programmes are taken off (Bastiaan, 2026-11-16), so a click never unlinks anything.
 */
async function chooseBelongs(
  admin: { id: string; role: string },
  teamId: string,
  fd: FormData,
): Promise<Result> {
  const belongs = String(fd.get("belongs") ?? "");
  if (!["programmes", "division", "institution"].includes(belongs)) return { error: "unknown" };
  const divisionId = belongs === "division" ? String(fd.get("divisionId") ?? "") || null : null;
  if (belongs === "division" && !divisionId) return { error: "chooseDivision" };
  if (belongs !== "programmes") {
    const inProgrammes = (await listProgrammes(admin, MAX)).some((p) => p.teamIds.includes(teamId));
    if (inProgrammes) return { error: "hasProgrammes" };
  }
  return (await setTeamDivision(admin, teamId, divisionId))
    ? { saved: true }
    : { error: "unknown" };
}
