import { useId } from "react";
import { Form, Link } from "react-router";
import { CalendarPlus } from "lucide-react";
import { Button, Card, Input, Label } from "~/components/ui";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import type { BlueprintOffer } from "~/lib/courses/blueprintImport";
import type { CourseData } from "~/lib/courses/types";
import { type LocalizedText, loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { BlueprintImport } from "./BlueprintImport";
import { LINKED_WORK_ANCHOR } from "~/lib/courses/tabs";

export interface LinkedWorkItem {
  generationId: string;
  toolName: LocalizedText | string;
  itemTitle: string | null;
  createdAt: Date | string;
  /** A blueprint that can become a test's questions (P26.2). */
  blueprint?: BlueprintOffer;
  /** A lesson plan at no lesson yet: it can become a lesson of this course. */
  asLesson?: boolean;
}

/** "Gekoppeld werk" (P20.4): what the teacher made with the tools for this course. */
export function LinkedWorkSection({ work, data }: { work: LinkedWorkItem[]; data: CourseData }) {
  const t = useT();
  const locale = useLocale();
  const m = t.courses.links;
  const headingId = useId();
  const dateLocale = locale === "en" ? "en-GB" : "nl-NL";
  return (
    <section id={LINKED_WORK_ANCHOR} aria-labelledby={headingId}>
      <h2 id={headingId} className="text-lg font-medium text-slate-900">
        {m.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{m.intro}</p>
      {work.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{m.empty}</p>
      ) : (
        <Card className="mt-3">
          <ul className="divide-y divide-slate-100">
            {work.map((w) => (
              <li
                key={w.generationId}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {typeof w.toolName === "string" ? w.toolName : loc(w.toolName, locale)}
                  </p>
                  <p className="text-xs text-slate-600">
                    {new Date(w.createdAt).toLocaleDateString(dateLocale, { dateStyle: "medium" })}
                    {w.itemTitle && ` · ${w.itemTitle}`}
                  </p>
                </div>
                <Link
                  to="/projects"
                  className="text-sm font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  {m.openInWork}
                </Link>
                {w.asLesson && <AddAsLesson generationId={w.generationId} />}
                {w.blueprint && (
                  <BlueprintImport data={data} generationId={w.generationId} offer={w.blueprint} />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

/** "Neem op als les": the work becomes a lesson on "Lessen en toetsen", kept at it. */
function AddAsLesson({ generationId }: { generationId: string }) {
  const m = useT().resultActions;
  const titleId = useId();
  return (
    <Form method="post" className="flex w-full flex-wrap items-end gap-2">
      <input type="hidden" name="intent" value="addAsLesson" />
      <input type="hidden" name="id" value={generationId} />
      <div className="w-full min-w-0 sm:w-auto sm:flex-1">
        <Label htmlFor={titleId}>{m.lessonTitle}</Label>
        <Input id={titleId} name="title" required maxLength={COURSE_LIMITS.title} />
      </div>
      <Button type="submit" variant="secondary" size="sm">
        <CalendarPlus className="size-4" aria-hidden />
        {m.addAsLesson}
      </Button>
    </Form>
  );
}
