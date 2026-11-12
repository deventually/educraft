import { useId, useState } from "react";
import { Form, Link, redirect, useActionData } from "react-router";
import { Route as RouteIcon, Trash2 } from "lucide-react";
import type { Route } from "./+types/tracks._index";
import { requireTracksUser } from "~/server/tracks.server";
import { createTrack, deleteTrack, listTracks } from "~/server/repositories/tracks.server";
import { listCourses } from "~/server/repositories/courses.server";
import { listAssessmentModels } from "~/server/repositories/assessmentModels.server";
import {
  fitsKind,
  MILESTONES,
  nextStep,
  progress,
  TrackInputSchema,
  type TrackKind,
} from "~/lib/tracks";
import { Button, Card, Input, Label, Select } from "~/components/ui";
import { EmptyState } from "~/components/EmptyState";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useFormToast } from "~/components/Toast";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmtDate } from "~/lib/portfolio/format";

export function meta() {
  return [{ title: "Mijn begeleiding — LimeOnIt" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireTracksUser(request);
  const [tracks, courses, models] = await Promise.all([
    listTracks(user.id),
    listCourses(user.id),
    listAssessmentModels(user.id),
  ]);
  return {
    tracks: tracks.map((t) => ({
      id: t.id,
      code: t.code,
      kind: t.kind,
      next: nextStep(t),
      ...progress(t),
      closedAt: t.closedAt,
    })),
    courses: courses.map((c) => ({ id: c.id, name: c.name })),
    // Only the models for an internship or thesis document (filtered per kind in the form).
    models: models
      .filter(
        (m) =>
          fitsKind(m.data.documentTypes, "internship") || fitsKind(m.data.documentTypes, "thesis"),
      )
      .map((m) => ({ id: m.id, name: m.name, documentTypes: m.data.documentTypes })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireTracksUser(request);
  const fd = await request.formData();
  const m = getMessages(getLocale(request)).tracks;
  const intent = fd.get("intent");
  if (intent === "delete") {
    const deleted = await deleteTrack(user.id, String(fd.get("id") ?? ""));
    return deleted ? { ok: true as const } : { ok: false as const, error: m.errorNotFound };
  }
  if (intent === "create") {
    const input = TrackInputSchema.safeParse({
      code: fd.get("code") ?? "",
      kind: fd.get("kind") ?? "",
      courseId: String(fd.get("courseId") ?? "") || null,
      assessmentModelId: String(fd.get("assessmentModelId") ?? "") || null,
    });
    if (!input.success) return { ok: false as const, error: m.errorInput };
    const track = await createTrack(user.id, input.data);
    if (!track) return { ok: false as const, error: m.errorCourse };
    return redirect(`/tracks/${track.id}`);
  }
  return { ok: false as const, error: m.errorInvalid };
}

export default function TrackList({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const m = t.tracks;
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  const { tracks, courses, models } = loaderData;
  const [kind, setKind] = useState<TrackKind>("internship");
  const hintId = useId();
  useFormToast(actionData, {
    result: (d) => {
      if (!d) return null;
      return d.ok
        ? { variant: "success", message: m.toastDeleted }
        : { variant: "error", message: d.error };
    },
  });
  const kindLabel: Record<TrackKind, string> = {
    internship: m.kindInternship,
    thesis: m.kindThesis,
  };
  const milestoneName = (id: string) =>
    loc(MILESTONES.find((x) => x.id === id)?.name ?? { nl: id, en: id }, locale);

  return (
    <div className="w-full min-w-0">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {m.heading}
      </h1>
      <p className="mt-2 max-w-[70ch] text-slate-600">{m.intro}</p>

      <Card className="mt-6 p-5">
        <h2 className="text-lg font-medium text-slate-900">{m.createTitle}</h2>
        <Form method="post" className="mt-4 space-y-4">
          <input type="hidden" name="intent" value="create" />
          <div>
            <Label htmlFor="track-code">{m.code}</Label>
            <Input
              id="track-code"
              name="code"
              required
              maxLength={40}
              autoComplete="off"
              placeholder={m.codePlaceholder}
              aria-describedby={hintId}
            />
            <p id={hintId} className="mt-1 text-sm text-slate-600">
              {m.codeHint}
            </p>
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">{m.kind}</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {(["internship", "thesis"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="kind"
                    value={k}
                    checked={kind === k}
                    onChange={() => setKind(k)}
                  />
                  {kindLabel[k]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="track-course">{m.course}</Label>
              <Select id="track-course" name="courseId" className="w-full" defaultValue="">
                <option value="">{m.none}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="track-model">{m.model}</Label>
              <Select id="track-model" name="assessmentModelId" className="w-full" defaultValue="">
                <option value="">{m.none}</option>
                {models
                  .filter((x) => fitsKind(x.documentTypes, kind))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </Select>
            </div>
          </div>
          <Button type="submit">{m.create}</Button>
        </Form>
      </Card>

      {tracks.length === 0 ? (
        <EmptyState
          icon={<RouteIcon aria-hidden />}
          title={m.emptyTitle}
          body={m.emptyBody}
          action={{
            label: m.createTitle,
            onClick: () => document.getElementById("track-code")?.focus(),
          }}
        />
      ) : (
        <section className="mt-8" aria-labelledby="track-list">
          <h2 id="track-list" className="text-lg font-medium text-slate-900">
            {m.listTitle}
          </h2>
          <ul className="mt-3 space-y-3">
            {tracks.map((tr) => (
              <li
                key={tr.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <Link
                    to={`/tracks/${tr.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {tr.code}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {kindLabel[tr.kind]} ·{" "}
                    {fmt(m.progressShort, { resolved: tr.resolved, total: tr.total })}
                  </p>
                  <p className="text-sm text-slate-600">
                    {tr.closedAt
                      ? m.closed
                      : tr.next &&
                        `${fmt(m.milestone.next, { milestone: milestoneName(tr.next.milestone) })}${
                          tr.next.due
                            ? ` · ${fmt(m.dueOn, { date: fmtDate(tr.next.due, locale) })}`
                            : ""
                        }`}
                  </p>
                </div>
                <ConfirmDialog
                  triggerLabel={`${m.delete}: ${tr.code}`}
                  triggerIcon={<Trash2 className="size-4" aria-hidden />}
                  triggerIconOnly
                  title={m.deleteTitle}
                  description={m.deleteBody}
                  confirmLabel={m.delete}
                  cancelLabel={t.confirm.cancel}
                  fields={{ intent: "delete", id: tr.id }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
