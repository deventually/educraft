/**
 * What the import proposal shows beyond the editable rows: the module details, and
 * per row what a test blueprint or marking model adds (success criteria, test details, parts).
 * The extras travel as JSON in `<key>.extra` and are checked again on the server
 * (`importExtras.ts`); the teacher edits them in the course afterwards.
 */
import { useId } from "react";
import { Input, Label, Textarea } from "~/components/ui";
import type { ImportAssessment, ImportOutcome, ImportProposal } from "~/lib/courses/import";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

/** The module details, ticked to take over; empty fields in the course only. */
export function ModuleChoice({ module }: { module: NonNullable<ImportProposal["module"]> }) {
  const t = useT();
  const ti = t.courses.import;
  const m = t.courseDocuments.module;
  const id = useId();
  const short: { name: "code" | "studyYear" | "phase" | "leader" | "examiners"; max: number }[] = [
    { name: "code", max: COURSE_LIMITS.code },
    { name: "studyYear", max: COURSE_LIMITS.code },
    { name: "phase", max: COURSE_LIMITS.title },
    { name: "leader", max: COURSE_LIMITS.title },
    { name: "examiners", max: COURSE_LIMITS.title },
  ];
  return (
    <fieldset className="rounded-md border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium text-slate-900">{ti.moduleTitle}</legend>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="module.pick" defaultChecked />
        {ti.moduleTake}
      </label>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {short.map((f) => (
          <div key={f.name}>
            <Label htmlFor={`${id}-${f.name}`}>{m[f.name]}</Label>
            <Input
              id={`${id}-${f.name}`}
              name={`module.${f.name}`}
              maxLength={f.max}
              defaultValue={module[f.name]}
              className="mt-1"
            />
          </div>
        ))}
      </div>
      {(["description", "literature"] as const).map((name) => (
        <div key={name} className="mt-3">
          <Label htmlFor={`${id}-${name}`}>{m[name]}</Label>
          <Textarea
            id={`${id}-${name}`}
            name={`module.${name}`}
            rows={3}
            maxLength={COURSE_LIMITS.longText}
            defaultValue={module[name]}
            className="mt-1"
          />
        </div>
      ))}
    </fieldset>
  );
}

/** For a row the course already has: tick to fill in only what is still empty. */
export function CompleteBox({ name }: { name: string }) {
  const ti = useT().courses.import;
  return (
    <>
      <p className="text-sm text-slate-600">{ti.existingFill}</p>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name={name} defaultChecked />
        {ti.complete}
      </label>
    </>
  );
}

export const outcomeHasExtras = (o: ImportOutcome) => o.criteria.length > 0;
export const assessmentHasExtras = (a: ImportAssessment) =>
  Object.keys(a.details).length > 0 || a.parts.length > 0;

/** A list of lines, each marked when it is not verbatim in the document. */
function Lines({ label, lines }: { label?: string; lines: { text: string; check: boolean }[] }) {
  const ti = useT().courses.import;
  if (!lines.length) return null;
  return (
    <ul aria-label={label} className="list-disc space-y-1 pl-5 text-sm text-slate-700">
      {lines.map((l) => (
        <li key={l.text}>
          {l.text}
          {l.check && <span className="text-amber-800"> ({ti.checkShort})</span>}
        </li>
      ))}
    </ul>
  );
}

/** The success criteria of an outcome, with the hidden field that carries them. */
export function CriteriaPreview({ outcome: o }: { outcome: ImportOutcome }) {
  const t = useT();
  const criteria = o.criteria.map(({ code, text }) => (code ? { code, text } : { text }));
  return (
    <>
      <input type="hidden" name={`${o.key}.extra`} value={JSON.stringify({ criteria })} />
      <Lines
        label={t.courseDocuments.criteria.label}
        lines={o.criteria.map((k) => ({
          text: k.code ? `${k.code} ${k.text}` : k.text,
          check: !k.verbatim,
        }))}
      />
    </>
  );
}

/** The details and parts of a test, with the hidden field that carries them. */
export function AssessmentExtrasPreview({ assessment: a }: { assessment: ImportAssessment }) {
  const t = useT();
  const h = t.courseDocuments.header;
  const mm = t.courseDocuments.markingModel;
  const d = a.details;
  const parts = a.parts.map(({ verbatim: _v, ...p }) => p);
  const details = [
    d.form ? `${h.form}: ${d.form}` : "",
    d.owner ? `${h.owner}: ${d.owner}` : "",
    d.grading ? `${h.grading}: ${t.courseDocuments.gradings[d.grading]}` : "",
    d.passMark !== undefined ? `${h.passMark}: ${fmt(h.percent, { n: d.passMark })}` : "",
    ...(d.conditions ?? []).map((c) => `${h.conditions}: ${c}`),
    d.resit ? `${h.resit}: ${d.resit}` : "",
    d.conduct ? `${h.conduct}: ${d.conduct}` : "",
  ]
    .filter(Boolean)
    .map((text) => ({ text, check: false }));
  const partLines = a.parts.map((p) => ({
    text: [
      p.title,
      p.outcomeKeys.length
        ? fmt(mm.outcomes, { list: p.outcomeKeys.map((k) => k.slice(1)).join(", ") })
        : "",
      p.weight !== undefined ? fmt(mm.weight, { n: p.weight }) : "",
      p.knockOut ? mm.knockOutYes : "",
    ]
      .filter(Boolean)
      .join(" · "),
    check: !p.verbatim,
  }));
  return (
    <>
      <input type="hidden" name={`${a.key}.extra`} value={JSON.stringify({ details: d, parts })} />
      <Lines lines={details} />
      <Lines label={t.courses.import.partsTitle} lines={partLines} />
    </>
  );
}
