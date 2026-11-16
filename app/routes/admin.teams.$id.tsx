import { Link, useActionData } from "react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { Route } from "./+types/admin.teams.$id";
import { requireRole } from "~/server/auth.server";
import {
  addMember,
  deleteTeam,
  getTeamWithMembers,
  removeMember,
  renameTeam,
  setLead,
  setTeamSettings,
} from "~/server/repositories/teams.server";
import { getUserById, listPeople } from "~/server/repositories/users.server";
import {
  getDivisionKind,
  listDivisions,
  setTeamDivision,
  teamDivisionId,
} from "~/server/repositories/organisation.server";
import { listProgrammes } from "~/server/repositories/programmes.server";
import {
  linkProgrammeTeam,
  programmeChoices,
  unlinkProgrammeTeam,
} from "~/server/repositories/programmeTeams.server";
import { divisionWord } from "~/lib/organisation/kinds";
import { getLocale } from "~/lib/i18n/locale.server";
import { loc } from "~/lib/i18n/localized";
import { applyTeamSettingsForm, getTeamSettingsOffer } from "~/server/teamSettings.server";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { teamError } from "~/components/teams/teamError";
import { useFormToast } from "~/components/Toast";
import { Input, Label } from "~/components/ui";
import { AddDialog } from "~/components/connections/AddDialog";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { TeamSettingsForm } from "~/components/features/TeamSettingsForm";
import { TeamDivisionForm } from "~/components/teams/TeamDivisionForm";
import { TeamProgrammes } from "~/components/teams/TeamProgrammes";
import { redirectWithFlash } from "~/server/flash.server";

/** The most people one "add" may carry; the candidate list is capped the same. */
const MAX_PEOPLE = 500;

/**
 * One team's page (admin): name, members and leads, add several colleagues at once by
 * ticking them in a dialog, remove one after a confirm, the division it belongs under, its programmes, the team's choices (P28.3) and delete. The team is the one
 * in the URL; a `teamId` in a form is ignored.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const admin = await requireRole(request, "admin");
  const team = await getTeamWithMembers(params.id);
  if (!team) throw new Response("Not found", { status: 404 });
  const [people, offer, divisions, divisionId, kind, programmes] = await Promise.all([
    listPeople({ status: "active", limit: MAX_PEOPLE }),
    getTeamSettingsOffer(),
    listDivisions(),
    teamDivisionId(team.id),
    getDivisionKind(),
    listProgrammes(admin, 500),
  ]);
  const inTeam = new Set(team.members.map((m) => m.userId));
  const candidates = people
    .filter((p) => p.kind === "user" && !inTeam.has(p.id))
    .map((p) => ({ id: p.id, name: p.name ?? p.email ?? p.id, email: p.email }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    team,
    candidates,
    offer,
    divisions: divisions.map(({ id, name }) => ({ id, name })),
    divisionId,
    divisionWord: loc(divisionWord(kind), getLocale(request)),
    // The team's programmes, and the others an admin may link it to (BESLUIT-2026-11-16-1).
    programmes: programmes
      .filter((p) => p.teamIds.includes(team.id))
      .map(({ id, name }) => ({ id, name })),
    otherProgrammes: await programmeChoices(admin, team.id),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const admin = await requireRole(request, "admin");
  const team = await getTeamWithMembers(params.id);
  if (!team) throw new Response("Not found", { status: 404 });
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  const userId = String(fd.get("userId") ?? "");

  if (intent === "rename") {
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return { error: "nameRequired" as const };
    await renameTeam(team.id, name);
    return { saved: true as const };
  }
  if (intent === "addMembers") {
    const ids = [...new Set(fd.getAll("userIds").map(String))].slice(0, MAX_PEOPLE);
    if (ids.length === 0) return { error: "noneSelected" as const };
    for (const id of ids) {
      // Only existing accounts; an unknown id is skipped.
      if (await getUserById(id)) await addMember(team.id, id);
    }
    return { saved: true as const };
  }
  if (intent === "removeMember") {
    await removeMember(team.id, userId);
    return { saved: true as const };
  }
  if (intent === "setLead") {
    await setLead(team.id, userId, fd.get("lead") === "1");
    return { saved: true as const };
  }
  if (intent === "division") {
    const divisionId = String(fd.get("divisionId") ?? "") || null;
    return (await setTeamDivision(admin, team.id, divisionId))
      ? { saved: true as const }
      : { error: "unknown" as const };
  }
  const programmeId = String(fd.get("programmeId") ?? "");
  if (intent === "linkProgramme") {
    const ids = [...new Set(fd.getAll("programmeId").map(String))].slice(0, 100);
    if (ids.length === 0) return { error: "noneSelected" as const };
    let linked = 0;
    for (const id of ids) if (await linkProgrammeTeam(admin, id, team.id)) linked++;
    return linked ? { saved: true as const } : { error: "unknown" as const };
  }
  if (intent === "unlinkProgramme") {
    return (await unlinkProgrammeTeam(admin, programmeId, team.id)) === "unlinked"
      ? { saved: true as const }
      : { error: "unknown" as const };
  }
  if (intent === "settings") {
    const next = applyTeamSettingsForm(team.settings, fd, await getTeamSettingsOffer());
    if ("error" in next) return next;
    await setTeamSettings(team.id, next);
    return { saved: true as const };
  }
  if (intent === "delete") {
    await deleteTeam(team.id);
    return redirectWithFlash("/admin/teams", "teamDeleted");
  }
  return { error: "unknown" as const };
}

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";
const h3 = "text-sm font-semibold text-slate-800";
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const th = "px-4 py-2.5 font-semibold";

export default function AdminTeam({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const tt = t.teams;
  const { team, candidates, offer, divisions, divisionId, divisionWord } = loaderData;
  const { programmes, otherProgrammes } = loaderData;
  const actionData = useActionData<typeof action>();
  const errorOf = (code: string | true) =>
    typeof code === "string" ? teamError(t, code) : undefined;

  useFormToast(actionData, {
    result: (d) =>
      !d
        ? null
        : "error" in d && d.error
          ? { variant: "error", message: teamError(t, d.error) }
          : { variant: "success", message: t.admin.console.saved },
  });

  return (
    <div className="space-y-6">
      <Link
        to="/admin/teams"
        className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {tt.allTeams}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className={h2}>{team.name}</h2>
        <ConfirmDialog
          triggerLabel={tt.delete}
          triggerIcon={<Trash2 className="size-3.5" aria-hidden />}
          title={fmt(tt.deleteTitle, { name: team.name })}
          description={tt.deleteBody}
          confirmLabel={tt.deleteConfirm}
          cancelLabel={t.confirm.cancel}
          fields={{ intent: "delete" }}
        />
      </div>

      <section className={card}>
        <AutoSaveForm intent="rename" errorMessage={errorOf} className="max-w-sm">
          <Label htmlFor="team-name">{tt.nameLabel}</Label>
          <Input
            id="team-name"
            name="name"
            type="text"
            defaultValue={team.name}
            maxLength={100}
            className="mt-1"
          />
        </AutoSaveForm>
        <div className="mt-4">
          <TeamDivisionForm
            divisions={divisions}
            divisionId={divisionId}
            divisionWord={divisionWord}
            errorMessage={errorOf}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <TeamProgrammes team={team} programmes={programmes} choices={otherProgrammes} canCreate />
      </section>

      <section className={`${card} space-y-5`} aria-labelledby="team-members">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="team-members" className={h3}>
            {tt.members}
          </h3>
          <AddDialog
            triggerLabel={tt.addMembersHeading}
            title={fmt(tt.addMembersTitle, { team: team.name })}
            description={tt.addMembersHint}
            intent="addMembers"
            pick={{
              name: "userIds",
              options: candidates.map((c) => ({
                id: c.id,
                label: c.name,
                hint: c.email ?? undefined,
              })),
              empty: tt.noCandidates,
            }}
          />
        </div>
        {team.members.length === 0 ? (
          <p className="text-sm text-slate-500">{tt.noMembers}</p>
        ) : (
          <div className="relative overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{`${tt.members} — ${team.name}`}</caption>
              <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className={th}>
                    {tt.colName}
                  </th>
                  <th scope="col" className={th}>
                    {tt.colEmail}
                  </th>
                  <th scope="col" className={th}>
                    {tt.colLead}
                  </th>
                  <th scope="col" className={th}>
                    <span className="sr-only">{t.connections.remove}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {team.members.map((m) => (
                  <tr key={m.userId} className="border-t border-slate-50">
                    <th scope="row" className="px-4 py-2 font-medium">
                      <Link
                        to={`/admin/users/${m.userId}`}
                        className="rounded text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                      >
                        {m.name}
                      </Link>
                    </th>
                    <td className="px-4 py-2 text-slate-600">{m.email ?? "—"}</td>
                    <td className="px-4 py-2">
                      <AutoSaveForm
                        intent="setLead"
                        hidden={{ userId: m.userId }}
                        errorMessage={errorOf}
                      >
                        <input
                          type="checkbox"
                          name="lead"
                          value="1"
                          defaultChecked={m.isLead}
                          aria-label={fmt(tt.leadLabel, { name: m.name })}
                          className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                        />
                      </AutoSaveForm>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <ConfirmDialog
                        triggerLabel={t.connections.remove}
                        triggerContext={m.name}
                        triggerVariant="ghost"
                        title={fmt(tt.memberRemoveTitle, { name: m.name, team: team.name })}
                        description={tt.memberRemoveBody}
                        confirmLabel={t.connections.remove}
                        confirmVariant="primary"
                        cancelLabel={t.confirm.cancel}
                        fields={{ intent: "removeMember", userId: m.userId }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={card} aria-labelledby="team-features">
        <h3 id="team-features" className={h3}>
          {t.features.teamFeaturesHeading}
        </h3>
        <p className="mt-1 text-xs text-slate-500">{t.features.teamFeaturesIntro}</p>
        <div className="mt-3">
          <TeamSettingsForm
            idPrefix={`team-${team.id}`}
            settings={team.settings}
            offer={offer}
            errorMessage={errorOf}
          />
        </div>
      </section>
    </div>
  );
}
