import { useId } from "react";
import { Form, Link, useActionData } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/programmes.$id";
import {
  kindOptions,
  loadProgramme,
  placementFromForm,
  programmeFromForm,
} from "~/server/programmes.server";
import {
  placeCourse,
  removeCourse,
  updateProgramme,
} from "~/server/repositories/programmes.server";
import { listCourses } from "~/server/repositories/courses.server";
import { programmeKindLabel, ProgrammeInputSchema } from "~/lib/programmes/schema";
import { Button, Card, Label, Select } from "~/components/ui";
import { useFormToast } from "~/components/Toast";
import { ProgrammeFields } from "~/components/programmes/ProgrammeFields";
import { PlacementFields, usePlacementText } from "~/components/programmes/PlacementFields";
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
  const kind = `${programme.sector}:${programme.track ?? ""}`;
  const kinds = await kindOptions(user, locale);
  // A programme keeps its level even when the admin later switches that sector off.
  if (!kinds.some((k) => k.value === kind))
    kinds.unshift({ value: kind, label: programmeKindLabel({ ...programme, form: null }, locale) });
  const inProgramme = new Set(programme.courses.map((c) => c.courseId));
  // Only your own courses can go in; placing shares them with the team.
  const available = (await listCourses(user.id, 500))
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
      canManage: programme.canManage,
      courses: programme.courses.map(({ ownerId, ...c }) => ({ ...c, mine: ownerId === user.id })),
    },
    kinds,
    available,
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
  if (intent === "place") {
    const placement = placementFromForm(fd);
    if (!placement) return { ok: false as const, error: m.errorPlacement };
    return (await placeCourse(user, programme.id, courseId, placement))
      ? { ok: true as const, message: m.toastPlaced }
      : { ok: false as const, error: m.errorNotFound };
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
  const { programme, kinds, available } = loaderData;
  const placementText = usePlacementText();

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
        {programme.kindLabel} · {p.team} {programme.teamName}
      </p>

      <div className="mt-6 space-y-10">
        <section aria-labelledby={`${id}-courses`}>
          <h2 id={`${id}-courses`} className="text-lg font-medium text-slate-900">
            {p.courses.title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{p.courses.intro}</p>
          {programme.courses.length === 0 ? (
            <p className="mt-3 text-slate-600">{p.courses.empty}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {programme.courses.map((c) => (
                <li
                  key={c.courseId}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>
                      {c.mine ? (
                        <Link
                          to={`/courses/${c.courseId}`}
                          className="font-medium text-slate-900 underline-offset-2 hover:underline"
                        >
                          {c.name}
                        </Link>
                      ) : (
                        <Link
                          to={`/courses/shared/${c.courseId}`}
                          className="font-medium text-slate-900 underline-offset-2 hover:underline"
                        >
                          {c.name}
                        </Link>
                      )}
                      {!c.mine && (
                        <span className="ml-2 text-sm text-slate-600">
                          {fmt(p.owner, { name: c.ownerName })}
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-slate-600">{placementText(c)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    {c.mine && (
                      <Form method="post" className="flex flex-wrap items-end gap-3">
                        <input type="hidden" name="intent" value="place" />
                        <input type="hidden" name="courseId" value={c.courseId} />
                        <PlacementFields
                          id={`${id}-${c.courseId}`}
                          year={c.year}
                          period={c.period}
                          label={c.name}
                        />
                        <Button type="submit" size="sm" variant="secondary">
                          {p.save}
                          <span className="sr-only"> ({c.name})</span>
                        </Button>
                      </Form>
                    )}
                    {(c.mine || programme.canManage) && (
                      <Form method="post">
                        <input type="hidden" name="intent" value="remove" />
                        <input type="hidden" name="courseId" value={c.courseId} />
                        <Button type="submit" size="sm" variant="ghost">
                          {p.remove}
                          <span className="sr-only"> ({c.name})</span>
                        </Button>
                      </Form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby={`${id}-add`}>
          <h2 id={`${id}-add`} className="text-lg font-medium text-slate-900">
            {p.addTitle}
          </h2>
          {available.length === 0 ? (
            <p className="mt-2 text-slate-600">{p.addNone}</p>
          ) : (
            <Card className="mt-3 p-4">
              <Form method="post" className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="intent" value="place" />
                <div className="w-full sm:w-auto sm:min-w-48 sm:flex-1">
                  <Label htmlFor={`${id}-course`}>{p.course}</Label>
                  <Select id={`${id}-course`} name="courseId" className="mt-1">
                    {available.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <PlacementFields id={`${id}-new`} />
                <Button type="submit" size="sm">
                  {p.add}
                </Button>
              </Form>
              <p className="mt-2 text-xs text-slate-500">{p.yearPeriodHint}</p>
              <p className="mt-1 text-xs text-slate-500">
                {fmt(p.sharesWith, { team: programme.teamName })}
              </p>
            </Card>
          )}
        </section>

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
