/**
 * The module guide (modulewijzer) and handbook (modulehandleiding) on the course page: the module
 * details in their own form (`set-module`) and the export of both. The learning outcomes, success
 * criteria, activities and tests in them come from the rest of the course.
 */
import { useId } from "react";
import { Form } from "react-router";
import { ExportPanel } from "~/components/export/ExportMenu";
import { Button, Card, Input, Label, Textarea } from "~/components/ui";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";
import { useT } from "~/lib/i18n/useT";

type Field = "code" | "studyYear" | "phase" | "leader" | "examiners";

export function ModuleGuideSection({ courseId, data }: { courseId: string; data: CourseData }) {
  const t = useT();
  const m = t.courseDocuments.module;
  const g = t.courseDocuments.moduleGuide;
  const id = useId();
  const fields: { name: Field; label: string; max: number; hint?: string }[] = [
    { name: "code", label: m.code, max: COURSE_LIMITS.code },
    { name: "studyYear", label: m.studyYear, max: COURSE_LIMITS.code, hint: m.studyYearHint },
    { name: "phase", label: m.phase, max: COURSE_LIMITS.title, hint: m.phaseHint },
    { name: "leader", label: m.leader, max: COURSE_LIMITS.title },
    { name: "examiners", label: m.examiners, max: COURSE_LIMITS.title },
  ];
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {g.heading}
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{g.intro}</p>
      <Card className="mt-3 space-y-4 p-4">
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="set-module" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <div key={f.name}>
                <Label htmlFor={`${id}-${f.name}`}>{f.label}</Label>
                <Input
                  id={`${id}-${f.name}`}
                  name={f.name}
                  maxLength={f.max}
                  defaultValue={data[f.name] ?? ""}
                  aria-describedby={f.hint ? `${id}-${f.name}-hint` : undefined}
                  className="mt-1"
                />
                {f.hint && (
                  <p id={`${id}-${f.name}-hint`} className="mt-1 text-xs text-slate-500">
                    {f.hint}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div>
            <Label htmlFor={`${id}-description`}>{m.description}</Label>
            <Textarea
              id={`${id}-description`}
              name="description"
              rows={5}
              maxLength={COURSE_LIMITS.longText}
              defaultValue={data.description ?? ""}
              aria-describedby={`${id}-description-hint`}
              className="mt-1"
            />
            <p id={`${id}-description-hint`} className="mt-1 text-xs text-slate-500">
              {m.descriptionHint}
            </p>
          </div>
          <div>
            <Label htmlFor={`${id}-literature`}>{m.literature}</Label>
            <Textarea
              id={`${id}-literature`}
              name="literature"
              rows={3}
              maxLength={COURSE_LIMITS.longText}
              defaultValue={data.literature ?? ""}
              aria-describedby={`${id}-literature-hint`}
              className="mt-1"
            />
            <p id={`${id}-literature-hint`} className="mt-1 text-xs text-slate-500">
              {m.literatureHint}
            </p>
          </div>
          <Button type="submit" size="sm" variant="secondary">
            {t.courses.save}
          </Button>
        </Form>
        <ExportPanel url={`/courses/${courseId}/documents/module-guide/export`} label={g.export} />
        <ExportPanel
          url={`/courses/${courseId}/documents/module-handbook/export`}
          label={t.courseDocuments.moduleHandbook.export}
        />
      </Card>
    </section>
  );
}
