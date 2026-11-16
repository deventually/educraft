import { useId } from "react";
import { Form, Link, redirect, useActionData } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/programmes.$id";
import {
  kindOptions,
  loadProgramme,
  placementFromForm,
  programmeFromForm,
} from "~/server/programmes.server";
import {
  getProgramme,
  placeCourse,
  removeCourse,
  updateProgramme,
} from "~/server/repositories/programmes.server";
import { listCourses } from "~/server/repositories/courses.server";
import { listTeams } from "~/server/repositories/teams.server";
import {
  linkProgrammeTeam,
  unlinkProgrammeTeam,
} from "~/server/repositories/programmeTeams.server";
import { createLine, listLines } from "~/server/repositories/learningLines.server";
import { LearningLinesSection } from "~/components/programmes/LearningLinesSection";
import { programmeKindLabel, ProgrammeInputSchema } from "~/lib/programmes/schema";
import { Button, Card } from "~/components/ui";
import { useFormToast } from "~/components/Toast";
import { ProgrammeFields } from "~/components/programmes/ProgrammeFields";
import { ProgrammeCourses } from "~/components/programmes/ProgrammeCourses";
import { ProgrammeTeams } from "~/components/programmes/ProgrammeTeams";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.programme.name ?? "Opleiding"} — LimeOnIt` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, programme } = await loadProgramme(request, params.id);
  const locale = getLocale(request);
  const m = getMessages(locale).programmes;
  const kind = `${programme.sector}:${programme.track ?? ""}`;
  const kinds = await kindOptions(user, locale);
  // A programme keeps its level even when the admin later switches that sector off.
  if (!kinds.some((k) => k.value === kind))
    kinds.unshift({ value: kind, label: programmeKindLabel({ ...programme, form: null }, locale) });
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
    teamOptions: programme.canManage
      ? (await listTeams())
          .filter((t) => !programme.teamIds.includes(t.id))
          .map((t) => ({
            id: t.id,
            label: t.name,
            hint:
              t.members.length === 1
                ? m.memberOne
                : fmt(m.memberCount, { count: t.members.length }),
          }))
      : [],
    canPlace: programme.isMember,
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
    return (await updateProgramme(user, programme.id, parsed.data))
      ? { ok: true as const, message: m.toastSaved }
      : { ok: false as const, error: m.errorNotAllowed };
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
    if (!programme.canManage) return { ok: false as const, error: m.errorNotAllowed };
    if (intent === "unlink-team") {
      const result = await unlinkProgrammeTeam(user, programme.id, String(fd.get("teamId") ?? ""));
      if (result === "unlinked") return { ok: true as const, message: m.teamRemoved };
      return {
        ok: false as const,
        error: result === "lastTeam" ? m.errorLastTeam : m.errorNotFound,
      };
    }
    const chosen = ids("teamId");
    if (chosen.length === 0) return { ok: false as const, error: m.errorNoChoice };
    let n = 0;
    for (const id of chosen) if (await linkProgrammeTeam(user, programme.id, id)) n++;
    return n ? added(n, m.teamAdded, m.teamsAdded) : { ok: false as const, error: m.errorNotFound };
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
  const p = useT().programmes;
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

  return (
    <div className="w-full min-w-0">
      <Link
        to="/programmes"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {p.back}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900">
        {programme.name}
      </h1>
      <p className="mt-1 text-slate-600">
        {programme.kindLabel} · {programme.teamCount > 1 ? p.teams : p.team} {programme.teamName}
      </p>

      <div className="mt-6 space-y-10">
        <ProgrammeCourses id={id} programme={programme} available={available} canPlace={canPlace} />

        <ProgrammeTeams programme={programme} teamOptions={teamOptions} />

        <LearningLinesSection
          programmeId={programme.id}
          lines={lines}
          courses={programme.courses}
          canManage={programme.canManage}
        />

        {programme.canManage && (
          <section aria-labelledby={`${id}-settings`}>
            <h2 id={`${id}-settings`} className="text-lg font-medium text-slate-900">
              {p.settingsTitle}
            </h2>
            <Card className="mt-3 p-4">
              <Form method="post" className="grid gap-4 sm:grid-cols-3">
                <input type="hidden" name="intent" value="settings" />
                <ProgrammeFields
                  id={`${id}-settings`}
                  kinds={kinds}
                  defaults={{ name: programme.name, kind: programme.kind, form: programme.form }}
                />
                <div className="sm:col-span-3">
                  <Button type="submit" size="sm" variant="secondary">
                    {p.save}
                  </Button>
                </div>
              </Form>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
