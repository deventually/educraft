import { useId } from "react";
import { Form } from "react-router";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import {
  type Assessment,
  type AssessmentPart,
  type CourseData,
  GRADINGS,
} from "~/lib/courses/types";
import { ExportPanel } from "~/components/export/ExportMenu";
import { Button, Card, Input, Label, Select, Textarea } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { NumberField, OutcomeChecks, useOutcomeName } from "./fields";
import { ItemActions } from "./ItemActions";

const SUMMARY =
  "cursor-pointer text-sm font-medium text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-500";

/** A labelled text area with a hint below it. */
function TextField({
  id,
  name,
  label,
  hint,
  value,
  max,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  value?: string;
  max: number;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        name={name}
        rows={2}
        maxLength={max}
        defaultValue={value ?? ""}
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

/** The details the blueprint and the marking model need: form, owner, grading, conditions. */
function DetailsForm({ assessment: a }: { assessment: Assessment }) {
  const t = useT();
  const d = t.courseDocuments.details;
  const id = useId();
  return (
    <Form method="post" className="space-y-3">
      <input type="hidden" name="intent" value="update-assessment-details" />
      <input type="hidden" name="id" value={a.id} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor={`${id}-form`}>{d.form}</Label>
          <Input
            id={`${id}-form`}
            name="form"
            maxLength={COURSE_LIMITS.title}
            defaultValue={a.form ?? ""}
            aria-describedby={`${id}-form-hint`}
            className="mt-1"
          />
          <p id={`${id}-form-hint`} className="mt-1 text-xs text-slate-500">
            {d.formHint}
          </p>
        </div>
        <div>
          <Label htmlFor={`${id}-owner`}>{d.owner}</Label>
          <Input
            id={`${id}-owner`}
            name="owner"
            maxLength={COURSE_LIMITS.title}
            defaultValue={a.owner ?? ""}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={`${id}-grading`}>{d.grading}</Label>
          <Select
            id={`${id}-grading`}
            name="grading"
            defaultValue={a.grading ?? ""}
            className="mt-1"
          >
            <option value="">{d.gradingNone}</option>
            {GRADINGS.map((g) => (
              <option key={g} value={g}>
                {t.courseDocuments.gradings[g]}
              </option>
            ))}
          </Select>
        </div>
        <NumberField id={`${id}-pass`} name="passMark" label={d.passMark} value={a.passMark} />
      </div>
      <TextField
        id={`${id}-conditions`}
        name="conditions"
        label={d.conditions}
        hint={d.conditionsHint}
        value={a.conditions?.join("\n")}
        max={COURSE_LIMITS.conditions * (COURSE_LIMITS.text + 1)}
      />
      <TextField
        id={`${id}-conduct`}
        name="conduct"
        label={d.conduct}
        hint={d.conductHint}
        value={a.conduct}
        max={COURSE_LIMITS.longText}
      />
      <TextField
        id={`${id}-resit`}
        name="resit"
        label={d.resit}
        value={a.resit}
        max={COURSE_LIMITS.longText}
      />
      <Button type="submit" size="sm" variant="secondary">
        {t.courses.save}
      </Button>
    </Form>
  );
}

function PartForm({
  data,
  assessment,
  part,
}: {
  data: CourseData;
  assessment: Assessment;
  part?: AssessmentPart;
}) {
  const t = useT();
  const p = t.courseDocuments.parts;
  const id = useId();
  return (
    <Form method="post" className="space-y-3">
      <input type="hidden" name="intent" value={part ? "update-part" : "add-part"} />
      <input type="hidden" name="assessmentId" value={assessment.id} />
      {part && <input type="hidden" name="id" value={part.id} />}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div>
          <Label htmlFor={`${id}-title`}>{p.name}</Label>
          <Input
            id={`${id}-title`}
            name="title"
            required
            maxLength={COURSE_LIMITS.title}
            defaultValue={part?.title}
            className="mt-1"
          />
        </div>
        <NumberField id={`${id}-weight`} name="weight" label={p.weight} value={part?.weight} />
      </div>
      <OutcomeChecks
        legend={p.outcomes}
        name="outcomeIds"
        outcomes={data.outcomes}
        checked={part?.outcomeIds ?? []}
      />
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="knockOut"
          value="on"
          defaultChecked={!!part?.knockOut}
          className="mt-1"
        />
        <span>{p.knockOut}</span>
      </label>
      <TextField
        id={`${id}-pass`}
        name="pass"
        label={p.pass}
        hint={p.passHint}
        value={part?.pass}
        max={COURSE_LIMITS.longText}
      />
      <TextField
        id={`${id}-fail`}
        name="fail"
        label={p.fail}
        hint={p.failHint}
        value={part?.fail}
        max={COURSE_LIMITS.longText}
      />
      <Button type="submit" size="sm" variant={part ? "secondary" : "primary"}>
        {part ? t.courses.save : p.add}
        {!part && <span className="sr-only">: {assessment.title}</span>}
      </Button>
    </Form>
  );
}

function PartsList({ data, assessment: a }: { data: CourseData; assessment: Assessment }) {
  const t = useT();
  const p = t.courseDocuments.parts;
  const m = t.courseDocuments.markingModel;
  const outcomeName = useOutcomeName();
  const parts = a.parts ?? [];
  const short = (outcomeId: string) =>
    outcomeName(data.outcomes.findIndex((o) => o.id === outcomeId));
  return (
    <details className="mt-2 [&[open]>summary]:mb-3">
      <summary className={SUMMARY}>
        {fmt(p.summary, { n: parts.length })}
        <span className="sr-only">: {a.title}</span>
      </summary>
      {parts.length === 0 ? (
        <p className="text-sm text-slate-600">{p.empty}</p>
      ) : (
        <ul className="space-y-2">
          {parts.map((part) => (
            <li key={part.id} className="rounded-lg border border-slate-200 p-3">
              <p className="font-medium text-slate-900">{part.title}</p>
              <p className="text-sm text-slate-600">
                {[
                  part.outcomeIds.map(short).join(", "),
                  part.weight !== undefined ? fmt(m.weight, { n: part.weight }) : "",
                  part.knockOut ? m.knockOut : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <ItemActions
                name={part.title}
                id={part.id}
                removeIntent="remove-part"
                fields={{ assessmentId: a.id }}
              >
                <PartForm data={data} assessment={a} part={part} />
              </ItemActions>
            </li>
          ))}
        </ul>
      )}
      <Card className="mt-3 p-4">
        <p className="mb-2 text-sm font-medium text-slate-800">{p.addTitle}</p>
        <PartForm data={data} assessment={a} />
      </Card>
    </details>
  );
}

/**
 * Under each test: its details and parts, and the documents made from them (the blueprint for
 * every test, the marking model once it has parts). The documents are built without AI.
 */
export function TestDocuments({
  courseId,
  data,
  assessment: a,
}: {
  courseId: string;
  data: CourseData;
  assessment: Assessment;
}) {
  const t = useT();
  const d = t.courseDocuments;
  const base = `/courses/${encodeURIComponent(courseId)}/assessments/${encodeURIComponent(a.id)}`;
  return (
    <>
      <details className="mt-2 [&[open]>summary]:mb-3">
        <summary className={SUMMARY}>
          {d.details.summary}
          <span className="sr-only">: {a.title}</span>
        </summary>
        <DetailsForm assessment={a} />
      </details>
      <PartsList data={data} assessment={a} />
      <div className="mt-3 space-y-2">
        <ExportPanel url={`${base}/blueprint/export`} label={d.blueprint.export} />
        {a.parts?.length ? (
          <ExportPanel url={`${base}/marking-model/export`} label={d.markingModel.export} />
        ) : null}
      </div>
    </>
  );
}
