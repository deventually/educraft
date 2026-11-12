/**
 * The review form of a proposal (an import or an AI design), with its rows: the teacher ticks
 * and edits, `import-apply` adds what is ticked.
 */
import { Fragment, useId } from "react";
import { Form } from "react-router";
import type { ImportAssessment, ImportOutcome, ImportProposal } from "~/lib/courses/import";
import { BLOOM_LEVELS, type BloomLevel, bloomLabel } from "~/lib/courses/bloom";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { ASSESSMENT_KINDS } from "~/lib/courses/types";
import { Button, Input, Label, Select, Textarea } from "~/components/ui";
import { BloomSelect, NumberField } from "./fields";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import {
  AssessmentExtrasPreview,
  assessmentHasExtras,
  CompleteBox,
  CriteriaPreview,
  ModuleChoice,
  outcomeHasExtras,
} from "./ImportExtras";

/**
 * A design proposal (`source: "design"`) is the AI's own text: ticked, without "not in the
 * document". A test programme (wizard step 2) is over the course's own outcomes: they travel as
 * hidden fields for the coverage, the weights are marked as the AI's, and an outcome no summative
 * test covers is named above the tests.
 */
export function ProposalForm({
  proposal,
  onLater,
}: {
  proposal: ImportProposal;
  /** The wizard's way out: leave this proposal for now (steps 2 and 3). */
  onLater?: () => void;
}) {
  const t = useT();
  const ti = t.courses.import;
  const d = t.courseDesign;
  const designed = proposal.source === "design";
  // Wizard step 2: only tests are proposed; the outcomes are already in the course.
  const programme = designed && proposal.outcomes.every((o) => o.existing);
  const id = useId();
  const uncovered = proposal.outcomes
    .map((o, i) => ({ ...o, n: i + 1 }))
    .filter((o) => proposal.uncovered?.includes(o.key));
  return (
    <Form
      method="post"
      aria-labelledby={`${id}-title`}
      className="mt-6 space-y-4 border-t border-slate-200 pt-4"
    >
      <input type="hidden" name="intent" value="import-apply" />
      {/* Applied in the wizard: the next step's proposal follows (`nextDesignStep`). */}
      {designed && <input type="hidden" name="wizard" value="on" />}
      <h3 id={`${id}-title`} className="text-base font-medium text-slate-900">
        {designed ? d.proposalTitle : ti.proposalTitle}
      </h3>
      <p className="text-sm text-slate-600">
        {programme ? d.assessments.proposalIntro : designed ? d.proposalIntro : ti.proposalIntro}
      </p>
      {proposal.notes && <AiNotes notes={proposal.notes} />}
      {proposal.module && <ModuleChoice module={proposal.module} />}
      {programme
        ? proposal.outcomes.map((o) => (
            <Fragment key={o.key}>
              <input type="hidden" name="outcomeKey" value={o.key} />
              <input type="hidden" name={`${o.key}.text`} value={o.text} />
            </Fragment>
          ))
        : proposal.outcomes.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-slate-900">{ti.outcomesTitle}</h4>
              {proposal.outcomes.map((o, i) => (
                <OutcomeRow key={o.key} outcome={o} n={i + 1} designed={designed} />
              ))}
            </div>
          )}
      {proposal.assessments.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900">{ti.assessmentsTitle}</h4>
          {uncovered.length > 0 && (
            <p className="text-sm text-amber-800">
              {fmt(d.assessments.uncovered, {
                list: uncovered.map((o) => `${o.n}. ${o.text}`).join("; "),
              })}
            </p>
          )}
          {proposal.weightsOff && (
            <p className="text-sm text-amber-800">
              {designed ? d.assessments.weightsOff : ti.weightsOff}
            </p>
          )}
          {proposal.assessments.map((a, i) => (
            <AssessmentRow
              key={a.key}
              assessment={a}
              n={i + 1}
              outcomes={proposal.outcomes}
              designed={designed}
            />
          ))}
        </div>
      )}
      <ProposalButtons label={ti.apply} onLater={onLater} />
    </Form>
  );
}

/** The model's own remarks on the document, as a labelled region. */
export function AiNotes({ notes }: { notes: string }) {
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

function OutcomeRow({
  outcome: o,
  n,
  designed,
}: {
  outcome: ImportOutcome;
  n: number;
  designed: boolean;
}) {
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
          {outcomeHasExtras(o) ? (
            <CompleteBox name={`${o.key}.pick`} />
          ) : (
            <p className="mt-1 text-sm text-slate-600">{ti.existing}</p>
          )}
          <CriteriaPreview outcome={o} />
        </>
      ) : (
        <div className="space-y-2">
          <PickBox name={`${o.key}.pick`} checked={o.verbatim || designed} label={ti.addTo} />
          {!o.verbatim && !designed && <p className="text-sm text-amber-800">{ti.check}</p>}
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
          <CriteriaPreview outcome={o} designed={designed} />
        </div>
      )}
    </fieldset>
  );
}

/**
 * The level a test assesses a covered outcome at, the outcome's own level first; it goes into
 * the coverage (`applyImport`) and is ignored for an outcome the test does not cover.
 */
function CoverBloom({ name, value, n }: { name: string; value?: BloomLevel; n: number }) {
  const t = useT();
  const locale = useLocale();
  return (
    <Select
      name={name}
      defaultValue={value ?? ""}
      aria-label={fmt(t.courses.import.coverBloom, { n })}
      className="w-auto text-sm"
    >
      <option value="">{t.courses.bloomNone}</option>
      {BLOOM_LEVELS.map((level) => (
        <option key={level} value={level}>
          {bloomLabel(level, locale)}
        </option>
      ))}
    </Select>
  );
}

function AssessmentRow({
  assessment: a,
  n,
  outcomes,
  designed,
}: {
  assessment: ImportAssessment;
  n: number;
  outcomes: ImportOutcome[];
  /** The AI proposed the weight: the label says so. */
  designed: boolean;
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
        {a.existing && assessmentHasExtras(a) ? (
          <CompleteBox name={`${a.key}.pick`} />
        ) : a.existing ? (
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
            label={designed ? t.courseDesign.assessments.weight : c.assessments.weight}
            value={a.weight}
          />
          <NumberField id={`${id}-week`} name={`${a.key}.week`} label={c.week} value={a.week} />
        </div>
        {outcomes.length > 0 && (
          <fieldset>
            <legend className="text-sm text-slate-700">{ti.covers}</legend>
            <div className="mt-1 space-y-1">
              {outcomes.map((o, i) => (
                <div key={o.key} className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <label className="flex flex-1 basis-64 items-start gap-2 text-sm text-slate-700">
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
                  <CoverBloom name={`${a.key}.bloom.${o.key}`} value={o.bloom} n={i + 1} />
                </div>
              ))}
            </div>
          </fieldset>
        )}
        <AssessmentExtrasPreview assessment={a} />
      </div>
    </fieldset>
  );
}

/** Apply, and in the wizard also "Later": leave the proposal; the step stays on the overview. */
export function ProposalButtons({ label, onLater }: { label: string; onLater?: () => void }) {
  const d = useT().courseDesign;
  const id = useId();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{label}</Button>
        {onLater && (
          <Button
            type="button"
            variant="secondary"
            onClick={onLater}
            aria-describedby={`${id}-later`}
          >
            {d.later}
          </Button>
        )}
      </div>
      {onLater && (
        <p id={`${id}-later`} className="text-sm text-slate-600">
          {d.laterHelp}
        </p>
      )}
    </div>
  );
}
