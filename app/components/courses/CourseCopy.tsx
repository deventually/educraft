import { useId } from "react";
import { Form } from "react-router";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";
import { Button, Card, Input, Label } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

/** One labelled text field with its hint. */
function Field({
  id,
  name,
  label,
  hint,
  type = "text",
  defaultValue,
  maxLength,
  required,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  type?: "text" | "date";
  defaultValue?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        maxLength={maxLength}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-1"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * "Kopiëren voor een nieuwe uitvoering", on the overview tab for the owner: a copy of the
 * course for its next run, with the study year, semester or period and start date the teacher
 * chooses. The start date starts empty: last run's date is never the next one.
 */
export function CourseCopy({
  name,
  data,
}: {
  name: string;
  data: Pick<CourseData, "studyYear" | "phase">;
}) {
  const c = useT().courseCopy;
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {c.heading}
      </h2>
      <Card className="mt-3 p-4">
        <p className="max-w-[65ch] text-sm text-slate-600">{c.intro}</p>
        <Form method="post" className="mt-4 space-y-3">
          <input type="hidden" name="intent" value="copy-run" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id={`${id}-name`}
              name="name"
              label={c.name}
              hint={c.nameHint}
              defaultValue={name}
              maxLength={COURSE_LIMITS.title}
              required
            />
            <Field
              id={`${id}-year`}
              name="studyYear"
              label={c.studyYear}
              defaultValue={data.studyYear}
              maxLength={COURSE_LIMITS.code}
            />
            <Field
              id={`${id}-phase`}
              name="phase"
              label={c.phase}
              hint={c.phaseHint}
              defaultValue={data.phase}
              maxLength={COURSE_LIMITS.title}
            />
            <Field
              id={`${id}-start`}
              name="startDate"
              type="date"
              label={c.startDate}
              hint={c.startDateHint}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            {c.submit}
          </Button>
        </Form>
      </Card>
    </section>
  );
}

/** On the Controle tab of a fresh copy: check last run's course before teaching it again. */
export function CopiedNotice() {
  const c = useT().courseCopy;
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
      <h2 id={id} className="text-base font-medium text-slate-900">
        {c.copiedTitle}
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-slate-700">{c.copiedBody}</p>
    </section>
  );
}
