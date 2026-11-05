import { useId } from "react";
import { Form, Link, redirect, useActionData } from "react-router";
import { ArrowLeft, CopyPlus } from "lucide-react";
import type { Route } from "./+types/courses.shared.$id";
import { requireCourseUser } from "~/server/courses.server";
import {
  copySharedItem,
  getSharedCourse,
  listSharedCourseWork,
} from "~/server/repositories/shares.server";
import { getToolBySlug } from "~/lib/registry";
import { coverageMatrix } from "~/lib/courses/alignment";
import { bloomLabel } from "~/lib/courses/bloom";
import { Button, Card } from "~/components/ui";
import { CoverageMatrix } from "~/components/courses/CoverageMatrix";
import { Markdown } from "~/components/Markdown";
import { useFormToast } from "~/components/Toast";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.course.name ?? "Cursus"} — LimeOnIt` }];
}

/**
 * A colleague's course, shared with your team (P28.4): read only, with "Maak een kopie".
 * Not shared with you (or not any more) is a 404. Work from a tool that handles student
 * work never shows (the repository filters it out).
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireCourseUser(request);
  const course = await getSharedCourse(user.id, params.id);
  if (!course) throw new Response("Not Found", { status: 404 });
  const items = [...course.data.activities, ...course.data.assessments];
  const work = (await listSharedCourseWork(user.id, course.id)).map((w) => ({
    generationId: w.generationId,
    toolName: getToolBySlug(w.toolSlug)?.name ?? { nl: w.toolSlug, en: w.toolSlug },
    itemTitle: items.find((i) => i.id === w.itemId)?.title ?? null,
    createdAt: w.createdAt,
    outputMarkdown: w.outputMarkdown,
  }));
  return { course, matrix: coverageMatrix(course.data), work };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireCourseUser(request);
  const fd = await request.formData();
  if (fd.get("intent") !== "copy") return { ok: false as const, error: "invalid" };
  const copyId = await copySharedItem(user.id, "course", params.id);
  if (!copyId)
    return { ok: false as const, error: getMessages(getLocale(request)).sharing.errorNotFound };
  return redirect(`/courses/${copyId}`);
}

export default function SharedCoursePage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const s = t.sharing;
  const c = t.courses;
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    result: (r) => (r && !r.ok ? { variant: "error", message: r.error } : null),
  });
  const { course, matrix, work } = loaderData;
  const { data } = course;
  const workId = useId();
  const listId = useId();
  const dateLocale = locale === "en" ? "en-GB" : "nl-NL";

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <Link
        to="/courses"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {c.back}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900">
        {course.name}
      </h1>
      <p className="mt-2 max-w-[65ch] text-slate-600">
        {fmt(s.readOnly, { owner: course.ownerName })}
      </p>
      <Form method="post" className="mt-3">
        <input type="hidden" name="intent" value="copy" />
        <Button type="submit" size="sm">
          <CopyPlus className="size-4" aria-hidden />
          {s.copy}
        </Button>
      </Form>

      <div className="mt-8 space-y-10">
        <section aria-labelledby={listId}>
          <h2 id={listId} className="text-lg font-medium text-slate-900">
            {c.outcomes.title}
          </h2>
          {data.outcomes.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">{c.outcomes.empty}</p>
          ) : (
            <ol className="mt-3 list-decimal space-y-1 pl-6 text-slate-800">
              {data.outcomes.map((o) => (
                <li key={o.id}>
                  {o.text}
                  {o.bloom && (
                    <span className="text-sm text-slate-600"> · {bloomLabel(o.bloom, locale)}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
        <CoverageMatrix data={data} matrix={matrix} />
        <section aria-labelledby={workId}>
          <h2 id={workId} className="text-lg font-medium text-slate-900">
            {s.work.title}
          </h2>
          <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{s.work.intro}</p>
          {work.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">{s.work.empty}</p>
          ) : (
            <Card className="mt-3">
              <ul className="divide-y divide-slate-100">
                {work.map((w) => (
                  <li key={w.generationId} className="px-4 py-3">
                    <p className="font-medium text-slate-900">{loc(w.toolName, locale)}</p>
                    <p className="text-xs text-slate-600">
                      {new Date(w.createdAt).toLocaleDateString(dateLocale, {
                        dateStyle: "medium",
                      })}
                      {w.itemTitle && ` · ${w.itemTitle}`}
                    </p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-violet-700">
                        {s.work.show}
                      </summary>
                      <div className="mt-2">
                        <Markdown>{w.outputMarkdown}</Markdown>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
