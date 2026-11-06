import { useEffect, useId, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { DOC_ACCEPT_ATTR, fileToText } from "~/lib/documents/extract";
import {
  IMPORT_DOCUMENT_MAX,
  type ImportAssessment,
  type ImportOutcome,
  type ImportProposal,
} from "~/lib/courses/import";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { ASSESSMENT_KINDS } from "~/lib/courses/types";
import { Button, Card, HelpText, Input, Label, Select, Textarea } from "~/components/ui";
import { BloomSelect, NumberField } from "./fields";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

type ImportAction = { ok: boolean; intent?: string; proposal?: ImportProposal } | undefined;

/**
 * The proposal of the last `import-extract`, kept across a failed apply (the
 * teacher's choice is not lost) and cleared after a successful `import-apply`.
 */
export function useImportProposal(actionData: ImportAction): ImportProposal | null {
  const [proposal, setProposal] = useState<ImportProposal | null>(null);
  useEffect(() => {
    if (!actionData?.ok) return;
    if (actionData.intent === "import-extract" && actionData.proposal)
      setProposal(actionData.proposal);
    if (actionData.intent === "import-apply") setProposal(null);
  }, [actionData]);
  return proposal;
}

/**
 * "Import from a course catalogue or study guide" (brief P26, 26.3). The file
 * is read in the browser (`fileToText`); only its text is posted (intent
 * `import-extract`). The answer is a proposal the teacher ticks and edits;
 * `import-apply` adds what is ticked. Works without JS by pasting.
 */
export function CourseImport({
  courseName,
  startOpen,
  proposal,
  notes,
}: {
  courseName: string;
  startOpen: boolean;
  proposal: ImportProposal | null;
  /** The AI's explanation when the last `import-extract` found nothing to import. */
  notes?: string;
}) {
  const ti = useT().courses.import;
  const nav = useNavigation();
  const busy = nav.state === "submitting" && nav.formData?.get("intent") === "import-extract";
  const [value, setValue] = useState("");
  const [failed, setFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useId();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setValue((await fileToText(file)).text.trim().slice(0, IMPORT_DOCUMENT_MAX));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section aria-labelledby={`${id}-title`}>
      <Card className="p-4">
        <details open={startOpen || !!proposal || !!notes}>
          <summary className="cursor-pointer text-lg font-medium text-slate-900">
            <span id={`${id}-title`}>{ti.title}</span>
          </summary>
          <p className="mt-2 text-sm text-slate-600">{ti.body}</p>
          <Form method="post" className="mt-4 grid gap-3">
            <input type="hidden" name="intent" value="import-extract" />
            <div>
              <Label htmlFor={`${id}-text`}>{ti.text}</Label>
              <Textarea
                id={`${id}-text`}
                name="documentText"
                rows={6}
                required
                value={value}
                maxLength={IMPORT_DOCUMENT_MAX}
                onChange={(e) => setValue(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`${id}-file`}>{ti.file}</Label>
              <input
                ref={fileRef}
                id={`${id}-file`}
                type="file"
                accept={DOC_ACCEPT_ATTR}
                aria-describedby={`${id}-file-help`}
                onChange={onFile}
                className="mt-1 block text-sm text-slate-700"
              />
              <HelpText id={`${id}-file-help`}>{failed ? ti.fileFailed : ti.fileHelp}</HelpText>
            </div>
            <div>
              <Label htmlFor={`${id}-name`}>{ti.courseName}</Label>
              <Input
                id={`${id}-name`}
                name="courseName"
                defaultValue={courseName}
                maxLength={COURSE_LIMITS.title}
                aria-describedby={`${id}-name-help`}
                className="mt-1"
              />
              <HelpText id={`${id}-name-help`}>{ti.courseNameHint}</HelpText>
            </div>
            <div>
              <Button type="submit" disabled={busy}>
                {ti.extract}
              </Button>
            </div>
          </Form>
          {notes && !proposal && <AiNotes notes={notes} />}
          {proposal && <ProposalForm proposal={proposal} />}
        </details>
      </Card>
    </section>
  );
}

function ProposalForm({ proposal }: { proposal: ImportProposal }) {
  const ti = useT().courses.import;
  const id = useId();
  return (
    <Form
      method="post"
      aria-labelledby={`${id}-title`}
      className="mt-6 space-y-4 border-t border-slate-200 pt-4"
    >
      <input type="hidden" name="intent" value="import-apply" />
      <h3 id={`${id}-title`} className="text-base font-medium text-slate-900">
        {ti.proposalTitle}
      </h3>
      <p className="text-sm text-slate-600">{ti.proposalIntro}</p>
      {proposal.notes && <AiNotes notes={proposal.notes} />}
      {proposal.outcomes.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900">{ti.outcomesTitle}</h4>
          {proposal.outcomes.map((o, i) => (
            <OutcomeRow key={o.key} outcome={o} n={i + 1} />
          ))}
        </div>
      )}
      {proposal.assessments.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900">{ti.assessmentsTitle}</h4>
          {proposal.weightsOff && <p className="text-sm text-amber-800">{ti.weightsOff}</p>}
          {proposal.assessments.map((a, i) => (
            <AssessmentRow key={a.key} assessment={a} n={i + 1} outcomes={proposal.outcomes} />
          ))}
        </div>
      )}
      <Button type="submit">{ti.apply}</Button>
    </Form>
  );
}

/** The model's own remarks on the document, as a labelled region. */
function AiNotes({ notes }: { notes: string }) {
  const ti = useT().courses.import;
  const id = useId();
  return (
    <section
      aria-labelledby={`${id}-notes`}
      className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700"
    >
      <h4 id={`${id}-notes`} className="font-medium">
        {ti.notes}
      </h4>
      <p className="mt-1 whitespace-pre-line">{notes}</p>
    </section>
  );
}

function PickBox({ name, checked, label }: { name: string; checked: boolean; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" name={name} defaultChecked={checked} />
      {label}
    </label>
  );
}

function OutcomeRow({ outcome: o, n }: { outcome: ImportOutcome; n: number }) {
  const t = useT();
  const ti = t.courses.import;
  const id = useId();
  return (
    <fieldset className="rounded-md border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium text-slate-900">{fmt(ti.outcomeN, { n })}</legend>
      <input type="hidden" name="outcomeKey" value={o.key} />
      {o.existing ? (
        <>
          <input type="hidden" name={`${o.key}.text`} value={o.text} />
          <p className="text-sm text-slate-900">{o.text}</p>
          <p className="mt-1 text-sm text-slate-600">{ti.existing}</p>
        </>
      ) : (
        <div className="space-y-2">
          <PickBox name={`${o.key}.pick`} checked={o.verbatim} label={ti.addTo} />
          {!o.verbatim && <p className="text-sm text-amber-800">{ti.check}</p>}
          <div className="grid gap-3 sm:grid-cols-[3fr_1fr]">
            <div>
              <Label htmlFor={`${id}-text`}>{t.courses.outcomes.text}</Label>
              <Textarea
                id={`${id}-text`}
                name={`${o.key}.text`}
                rows={2}
                required
                maxLength={COURSE_LIMITS.text}
                defaultValue={o.text}
                className="mt-1"
              />
            </div>
            <BloomSelect
              id={`${id}-bloom`}
              name={`${o.key}.bloom`}
              value={o.bloom}
              label={ti.bloom}
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}

function AssessmentRow({
  assessment: a,
  n,
  outcomes,
}: {
  assessment: ImportAssessment;
  n: number;
  outcomes: ImportOutcome[];
}) {
  const t = useT();
  const c = t.courses;
  const ti = c.import;
  const id = useId();
  const covered = new Set(a.outcomeKeys);
  return (
    <fieldset className="rounded-md border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium text-slate-900">
        {fmt(ti.assessmentN, { n })}
      </legend>
      <input type="hidden" name="assessmentKey" value={a.key} />
      <div className="space-y-2">
        {a.existing ? (
          <p className="text-sm text-slate-600">{ti.existing}</p>
        ) : (
          <PickBox name={`${a.key}.pick`} checked label={ti.addTo} />
        )}
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Label htmlFor={`${id}-title`}>{c.title}</Label>
            <Input
              id={`${id}-title`}
              name={`${a.key}.title`}
              required
              maxLength={COURSE_LIMITS.title}
              defaultValue={a.title}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={`${id}-kind`}>{c.kind}</Label>
            <Select
              id={`${id}-kind`}
              name={`${a.key}.kind`}
              defaultValue={a.kind ?? "summative"}
              className="mt-1"
            >
              {ASSESSMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {c.assessments.kinds[k]}
                </option>
              ))}
            </Select>
          </div>
          <NumberField
            id={`${id}-weight`}
            name={`${a.key}.weight`}
            label={c.assessments.weight}
            value={a.weight}
          />
          <NumberField id={`${id}-week`} name={`${a.key}.week`} label={c.week} value={a.week} />
        </div>
        {outcomes.length > 0 && (
          <fieldset>
            <legend className="text-sm text-slate-700">{ti.covers}</legend>
            <div className="mt-1 space-y-1">
              {outcomes.map((o, i) => (
                <label key={o.key} className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name={`${a.key}.outcomes`}
                    value={o.key}
                    defaultChecked={covered.has(o.key)}
                    className="mt-1"
                  />
                  <span>
                    {fmt(ti.outcomeN, { n: i + 1 })}: {o.text}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </fieldset>
  );
}
