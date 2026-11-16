import { useId } from "react";
import { redirect, useActionData } from "react-router";
import type { Route } from "./+types/programmes.$id";
import {
  kindOptions,
  loadProgramme,
  placementFromForm,
  programmeFromForm,
} from "~/server/programmes.server";
import {
  deleteProgramme,
  getProgramme,
  placeCourse,
  removeCourse,
  updateProgramme,
} from "~/server/repositories/programmes.server";
import { listCourses } from "~/server/repositories/courses.server";
import { listTeams, listTeamsForUser } from "~/server/repositories/teams.server";
import {
  linkProgrammeTeam,
  unlinkProgrammeTeam,
} from "~/server/repositories/programmeTeams.server";
import { createLine, listLines } from "~/server/repositories/learningLines.server";
import { LearningLinesSection } from "~/components/programmes/LearningLinesSection";
import { programmeKindLabel, ProgrammeInputSchema } from "~/lib/programmes/schema";
import { useFormToast } from "~/components/Toast";
import { ProgrammeCourses } from "~/components/programmes/ProgrammeCourses";
import { ProgrammeDetails } from "~/components/programmes/ProgrammeDetails";
import { Breadcrumb } from "~/components/Breadcrumb";
import { Tabs } from "~/components/Tabs";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { redirectWithFlash } from "~/server/flash.server";
import {
  getDivisionKind,
  listDivisions,
  setProgrammeDivision,
} from "~/server/repositories/organisation.server";
import { divisionWord } from "~/lib/organisation/kinds";
import { loc } from "~/lib/i18n/localized";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.programme.name ?? "Opleiding"} — LimeOnIt` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, programme } = await loadProgramme(request, params.id);
  const locale = getLocale(request);
  const m = getMessages(locale).programmes;
  const leads = new Set((await listTeamsForUser(user.id)).filter((t) => t.isLead).map((t) => t.id));
  const kind = `${programme.sector}:${programme.track ?? ""}`;
  const kinds = await kindOptions(user, locale);
  // A programme keeps its level even when the admin later switches that sector off.
  if (!kinds.some((k) => k.value === kind))
    kinds.unshift({ value: kind, label: programmeKindLabel({ ...programme, form: null }, locale) });
  const divisions = (await listDivisions()).map(({ id, name }) => ({ id, name }));
  const inProgramme = new Set(programme.courses.map((c) => c.courseId));
  // Only courses you own or co-own can go in; placing shares them with your teams of the
  // programme (BESLUIT-2026-11-10-5, BESLUIT-2026-11-16-1). An editor's courses are not theirs to place.
  const managed = (await listCourses(user.id, 500)).filter((c) => c.role !== "editor");
  const mine = new Set(managed.map((c) => c.id));
  const available = managed
    .filter((c) => !inProgramme.has(c.id))
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  return {
    programme: {
      id: programme.id,
      name: programme.name,
      kind,
      form: programme.form ?? "",
      kindLabel: programmeKindLabel(programme, locale),
      teamName: programme.teamName,
      teamCount: programme.teams.length,
      teams: programme.teams,
      divisionId: programme.divisionId,
      divisionName: divisions.find((d) => d.id === programme.divisionId)?.name ?? null,
      canManage: programme.canManage,
      courses: programme.courses.map(({ ownerId: _owner, ...c }) => ({
        ...c,
        mine: mine.has(c.courseId),
      })),
    },
    kinds,
    available,
    // The teams that can still be added: for an admin or a lead of the programme only
    // (BESLUIT-2026-11-16-4). Names and sizes, never who is in them.
    // The teams this person may add (BESLUIT-2026-11-16-4): an admin any team, a lead only
    // the teams they lead. Names and sizes, never who is in them.
    teamOptions: (await listTeams())
      .filter((t) => !programme.teamIds.includes(t.id))
      .filter((t) => user.role === "admin" || leads.has(t.id))
      .map((t) => ({
        id: t.id,
        label: t.name,
        hint:
          t.members.length === 1 ? m.memberOne : fmt(m.memberCount, { count: t.members.length }),
      })),
    // The teams whose Weghalen this person may use: an admin all, a lead their own.
    myTeamIds: user.role === "admin" ? programme.teamIds : [...leads],
    canPlace: programme.isMember,
    // Only an admin deletes a programme (BESLUIT-2026-11-16-4).
    canDelete: user.role === "admin",
    isAdmin: user.role === "admin",
    // An admin chooses the faculty in Gegevens (plan step 4).
    divisions: user.role === "admin" ? divisions : [],
    divisionWord: loc(divisionWord(await getDivisionKind()), locale),
    lines: await Promise.all(
      (await listLines(user, programme.id)).map(async (l) => {
        // A line of another programme says where it comes from, when the user reads that one.
        const from =
          l.programmeId === programme.id
            ? undefined
            : (await getProgramme(user, l.programmeId))?.name;
        return {
          id: l.id,
          name: l.name,
          courses: l.courseIds.length,
          ...(from ? { from } : {}),
        };
      }),
    ),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, programme } = await loadProgramme(request, params.id);
  const fd = await request.formData();
  const m = getMessages(getLocale(request)).programmes;
  const intent = fd.get("intent");
  const courseId = String(fd.get("courseId") ?? "");
  if (intent === "settings") {
    const parsed = ProgrammeInputSchema.safeParse(programmeFromForm(fd));
    if (!parsed.success) return { ok: false as const, error: m.errorInvalid };
    if (!(await updateProgramme(user, programme.id, parsed.data)))
      return { ok: false as const, error: m.errorNotAllowed };
    // The faculty, when the form had the field (an admin with faculties).
    if (fd.has("divisionId"))
      await setProgrammeDivision(user, programme.id, String(fd.get("divisionId")) || null);
    return { ok: true as const, message: m.toastSaved };
  }
  if (intent === "line-create") {
    const l = getMessages(getLocale(request)).programmes.lines;
    const name = String(fd.get("name") ?? "").trim();
    const ids = fd.getAll("courseId").map(String);
    if (!programme.canManage) return { ok: false as const, error: l.errorNotAllowed };
    if (!name || name.length > 200) return { ok: false as const, error: l.errorName };
    const line = ids.length ? await createLine(user, programme.id, name, ids) : null;
    if (!line) return { ok: false as const, error: l.errorCourses };
    return redirect(`/programmes/${programme.id}/lines/${line.id}`);
  }
  if (intent === "place") {
    const placement = placementFromForm(fd);
    if (!placement) return { ok: false as const, error: m.errorPlacement };
    return (await placeCourse(user, programme.id, courseId, placement))
      ? { ok: true as const, message: m.toastPlaced }
      : { ok: false as const, error: m.errorNotFound };
  }
  const ids = (name: string) => [...new Set(fd.getAll(name).map(String))].slice(0, 100);
  const added = (n: number, one: string, many: string) => ({
    ok: true as const,
    message: n === 1 ? one : fmt(many, { count: n }),
  });
  if (intent === "add-courses") {
    const placement = placementFromForm(fd);
    if (!placement) return { ok: false as const, error: m.errorPlacement };
    const chosen = ids("courseId");
    if (chosen.length === 0) return { ok: false as const, error: m.errorNoChoice };
    let n = 0;
    for (const id of chosen) if (await placeCourse(user, programme.id, id, placement)) n++;
    return n
      ? added(n, m.courseAdded, m.coursesAdded)
      : { ok: false as const, error: m.errorNotFound };
  }
  if (intent === "link-teams" || intent === "unlink-team") {
    // The repository decides: an admin any team, a lead only their own (BESLUIT-2026-11-16-4).
    if (intent === "unlink-team") {
      const result = await unlinkProgrammeTeam(user, programme.id, String(fd.get("teamId") ?? ""));
      return result === "unlinked"
        ? { ok: true as const, message: m.teamRemoved }
        : { ok: false as const, error: m.errorOwnTeam };
    }
    const chosen = ids("teamId");
    if (chosen.length === 0) return { ok: false as const, error: m.errorNoChoice };
    let n = 0;
    for (const id of chosen) if (await linkProgrammeTeam(user, programme.id, id)) n++;
    return n ? added(n, m.teamAdded, m.teamsAdded) : { ok: false as const, error: m.errorOwnTeam };
  }
  if (intent === "delete") {
    if (user.role !== "admin") return { ok: false as const, error: m.errorDeleteAdminOnly };
    if (!(await deleteProgramme(user, programme.id)))
      return { ok: false as const, error: m.errorNotFound };
    return redirectWithFlash("/programmes", "programmeDeleted");
  }
  if (intent === "remove") {
    return (await removeCourse(user, programme.id, courseId))
      ? { ok: true as const, message: m.toastRemoved }
      : { ok: false as const, error: m.errorNotFound };
  }
  return { ok: false as const, error: m.errorInvalid };
}

/** One programme: its details, its courses by year and period, and adding a course. */
export default function ProgrammePage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const p = t.programmes;
  const id = useId();
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    result: (d) => {
      if (!d) return null;
      return d.ok
        ? { variant: "success", message: d.message }
        : { variant: "error", message: d.error };
    },
  });
  const { programme, kinds, available, canPlace, teamOptions = [], lines = [] } = loaderData;
  const myTeamIds = "myTeamIds" in loaderData ? loaderData.myTeamIds : [];
  const isAdmin = "isAdmin" in loaderData && !!loaderData.isAdmin;
  const canDelete = "canDelete" in loaderData && loaderData.canDelete;

  const divisions = "divisions" in loaderData ? loaderData.divisions : [];
  const divisionWord = "divisionWord" in loaderData ? loaderData.divisionWord : undefined;
  const divisionName = "divisionName" in programme ? programme.divisionName : null;

  return (
    <div className="w-full min-w-0">
      <Breadcrumb
        label={t.menu.breadcrumb}
        items={[{ label: p.heading, to: "/programmes" }, { label: programme.name }]}
      />
      <h1 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900">
        {programme.name}
      </h1>
      <p className="mt-1 text-slate-600">
        {[
          programme.kindLabel,
          divisionName,
          programme.teamCount === 0
            ? p.noTeamYet
            : `${programme.teamCount > 1 ? p.teams : p.team} ${programme.teamName}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="mt-6">
        <Tabs
          label={fmt(p.tabsLabel, { programme: programme.name })}
          tabs={[
            {
              id: "courses",
              label: p.tabCourses,
              panel: (
                <ProgrammeCourses
                  id={id}
                  programme={programme}
                  available={available}
                  canPlace={canPlace}
                />
              ),
            },
            {
              id: "lines",
              label: p.tabLines,
              panel: (
                <LearningLinesSection
                  programmeId={programme.id}
                  lines={lines}
                  courses={programme.courses}
                  canManage={programme.canManage}
                />
              ),
            },
            {
              id: "details",
              label: p.tabDetails,
              panel: (
                <ProgrammeDetails
                  id={id}
                  programme={programme}
                  kinds={kinds}
                  teamOptions={teamOptions}
                  myTeamIds={myTeamIds}
                  isAdmin={isAdmin}
                  canDelete={!!canDelete}
                  divisions={divisions}
                  divisionWord={divisionWord}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
