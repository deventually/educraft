import { useId } from "react";
import { Form, Link, redirect, useActionData } from "react-router";
import { GraduationCap, Trash2 } from "lucide-react";
import type { Route } from "./+types/courses._index";
import { requireCourseUser } from "~/server/courses.server";
import { createCourse, deleteCourse, listCourses } from "~/server/repositories/courses.server";
import { listProfiles } from "~/server/repositories/profiles.server";
import { copySharedItem } from "~/server/repositories/shares.server";
import { sharedWithMe } from "~/server/sharing.server";
import { SharedWithMe } from "~/components/sharing/SharedWithMe";
import { checkAlignment } from "~/lib/courses/alignment";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { Button, Card, Input, Label, Select } from "~/components/ui";
import { EmptyState } from "~/components/EmptyState";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useFormToast } from "~/components/Toast";
import { useT } from "~/lib/i18n/useT";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { fmt } from "~/lib/i18n/format";

export function meta() {
  return [{ title: "Cursussen — LimeOnIt" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireCourseUser(request);
  const courses = (await listCourses(user.id)).map((c) => ({
    id: c.id,
    name: c.name,
    outcomes: c.data.outcomes.length,
    findings: checkAlignment(c.data).length,
  }));
  const profiles = (await listProfiles(user.id)).map((p) => ({ id: p.id, name: p.name }));
  // "Van mijn team" (P28.4): colleagues' courses shared with the viewer's teams.
  const shared = await sharedWithMe(user, "course");
  return { courses, profiles, shared };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireCourseUser(request);
  const fd = await request.formData();
  const m = getMessages(getLocale(request)).courses;
  const intent = fd.get("intent");
  if (intent === "delete") {
    const deleted = await deleteCourse(user.id, String(fd.get("id") ?? ""));
    return deleted
      ? { ok: true as const, intent: "delete" as const }
      : { ok: false as const, error: m.errorNotFound };
  }
  if (intent === "copy-shared") {
    const copyId = await copySharedItem(user.id, "course", String(fd.get("id") ?? ""));
    if (!copyId)
      return { ok: false as const, error: getMessages(getLocale(request)).sharing.errorNotFound };
    return redirect(`/courses/${copyId}`);
  }
  if (intent === "create") {
    const name = String(fd.get("name") ?? "").trim();
    if (!name || name.length > COURSE_LIMITS.title)
      return { ok: false as const, error: m.errorName };
    const contextProfileId = String(fd.get("contextProfileId") ?? "") || null;
    const course = await createCourse(user.id, { name, contextProfileId }).catch(() => null);
    if (!course) return { ok: false as const, error: m.errorInvalid };
    return redirect(`/courses/${course.id}`);
  }
  return { ok: false as const, error: m.errorInvalid };
}

export default function CourseList({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const c = t.courses;
  const id = useId();
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    result: (d) => {
      if (!d) return null;
      if (!d.ok) return { variant: "error", message: d.error };
      return { variant: "success", message: c.toastDeleted };
    },
  });
  const { courses, profiles, shared = [] } = loaderData;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {c.heading}
      </h1>
      <p className="mt-2 max-w-[65ch] text-slate-600">{c.intro}</p>
      <p className="mt-2 text-sm">
        <Link
          to="/help/courses"
          className="font-medium text-violet-700 underline underline-offset-2"
        >
          {c.help}
        </Link>
      </p>

      <Card className="mt-6 p-5">
        <h2 className="text-lg font-medium text-slate-900">{c.createTitle}</h2>
        <Form method="post" className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="intent" value="create" />
          <div>
            <Label htmlFor={`${id}-name`}>{c.name}</Label>
            <Input
              id={`${id}-name`}
              name="name"
              required
              maxLength={COURSE_LIMITS.title}
              placeholder={c.namePlaceholder}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={`${id}-profile`}>{c.profile}</Label>
            <Select id={`${id}-profile`} name="contextProfileId" className="mt-1">
              <option value="">{c.profileNone}</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">{c.create}</Button>
          </div>
        </Form>
      </Card>

      {courses.length === 0 ? (
        <EmptyState
          icon={<GraduationCap aria-hidden />}
          title={c.emptyTitle}
          body={c.emptyBody}
          action={{
            label: c.createTitle,
            onClick: () => document.getElementById(`${id}-name`)?.focus(),
          }}
        />
      ) : (
        <section className="mt-8" aria-labelledby={`${id}-list`}>
          <h2 id={`${id}-list`} className="text-lg font-medium text-slate-900">
            {c.listTitle}
          </h2>
          <ul className="mt-3 space-y-3">
            {courses.map((course) => (
              <li
                key={course.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <Link
                    to={`/courses/${course.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {course.name}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {fmt(c.summary, { outcomes: course.outcomes, findings: course.findings })}
                  </p>
                </div>
                <ConfirmDialog
                  triggerLabel={`${c.delete}: ${course.name}`}
                  triggerIcon={<Trash2 className="size-4" aria-hidden />}
                  triggerIconOnly
                  title={c.deleteTitle}
                  description={c.deleteBody}
                  confirmLabel={c.delete}
                  cancelLabel={t.confirm.cancel}
                  fields={{ intent: "delete", id: course.id }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      <SharedWithMe items={shared} viewHref={(id) => `/courses/shared/${id}`} />
    </div>
  );
}
