/**
 * The review form of a proposed lesson series (the course wizard, step 3), grouped by week: the
 * teacher ticks and edits each lesson, `design-lessons-apply` adds what is ticked. The outcomes
 * and disciplines are the course's own, by id; what no lesson teaches, or teaches only after its
 * test, is named above the lessons.
 */
import { useId } from "react";
import { Form } from "react-router";
import type { LessonsProposal, ProposedLesson } from "~/lib/courses/designLessons";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { ACTIVITY_KINDS } from "~/lib/courses/types";
import { Input, Label, Select, Textarea } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { NumberField } from "./fields";
import { AiNotes, ProposalButtons } from "./ProposalForm";

export function LessonsProposalForm({
  proposal,
  onLater,
}: {
  proposal: LessonsProposal;
  /** The wizard's way out: leave this proposal for now. */
  onLater?: () => void;
}) {
  const t = useT();
  const l = t.courseDesign.lessons;
  const id = useId();
  const number = new Map(proposal.outcomes.map((o, i) => [o.id, i + 1]));
  const untaught = proposal.outcomes
    .filter((o) => proposal.untaught.includes(o.id))
    .map((o) => `${number.get(o.id)}. ${o.text}`);
  // Lessons are sorted by week; a lesson without a week comes last.
  const weeks = [...new Set(proposal.lessons.map((x) => x.week))];
  return (
    <Form
      method="post"
      aria-labelledby={`${id}-title`}
      className="mt-6 space-y-4 border-t border-slate-200 pt-4"
    >
      <input type="hidden" name="intent" value="design-lessons-apply" />
      <h3 id={`${id}-title`} className="text-base font-medium text-slate-900">
        {t.courseDesign.proposalTitle}
      </h3>
      <p className="text-sm text-slate-600">{l.proposalIntro}</p>
      {proposal.notes && <AiNotes notes={proposal.notes} />}
      {untaught.length > 0 && (
        <p className="text-sm text-amber-800">{fmt(l.untaught, { list: untaught.join("; ") })}</p>
      )}
      {proposal.late.map((x) => (
        <p key={`${x.outcomeId}-${x.assessment}`} className="text-sm text-amber-800">
          {fmt(l.late, { n: number.get(x.outcomeId) ?? "?", week: x.week, test: x.assessment })}
        </p>
      ))}
      {weeks.map((week) => (
        <div key={week ?? "none"} className="space-y-3">
          <h4 className="font-medium text-slate-900">
            {week === undefined ? l.noWeek : fmt(l.week, { n: week })}
          </h4>
          {proposal.lessons.map((lesson, i) =>
            lesson.week === week ? (
              <LessonRow key={lesson.key} lesson={lesson} n={i + 1} proposal={proposal} />
            ) : null,
          )}
        </div>
      ))}
      <ProposalButtons label={l.apply} onLater={onLater} />
    </Form>
  );
}

function LessonRow({
  lesson: x,
  n,
  proposal,
}: {
  lesson: ProposedLesson;
  n: number;
  proposal: LessonsProposal;
}) {
  const t = useT();
  const c = t.courses;
  const a = c.activities;
  const id = useId();
  const covered = new Set(x.outcomeIds);
  return (
    <fieldset className="rounded-md border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium text-slate-900">
        {fmt(t.courseDesign.lessons.lessonN, { n })}
      </legend>
      <input type="hidden" name="lessonKey" value={x.key} />
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name={`${x.key}.pick`} defaultChecked />
          {c.import.addTo}
        </label>
        <div className="grid gap-3 sm:grid-cols-[3fr_1fr_1fr]">
          <div>
            <Label htmlFor={`${id}-title`}>{c.title}</Label>
            <Input
              id={`${id}-title`}
              name={`${x.key}.title`}
              required
              maxLength={COURSE_LIMITS.title}
              defaultValue={x.title}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={`${id}-kind`}>{c.kind}</Label>
            <Select id={`${id}-kind`} name={`${x.key}.kind`} defaultValue={x.kind} className="mt-1">
              {ACTIVITY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {a.kinds[k]}
                </option>
              ))}
            </Select>
          </div>
          <NumberField id={`${id}-week`} name={`${x.key}.week`} label={c.week} value={x.week} />
        </div>
        <div>
          <Label htmlFor={`${id}-goal`}>{a.goal}</Label>
          <Textarea
            id={`${id}-goal`}
            name={`${x.key}.goal`}
            rows={2}
            maxLength={COURSE_LIMITS.goal}
            defaultValue={x.goal ?? ""}
            className="mt-1"
          />
        </div>
        {proposal.disciplines.length > 0 && (
          <div>
            <Label htmlFor={`${id}-discipline`}>{a.discipline}</Label>
            <Select
              id={`${id}-discipline`}
              name={`${x.key}.discipline`}
              defaultValue={x.disciplineId ?? ""}
              className="mt-1"
            >
              <option value="">{a.disciplineNone}</option>
              {proposal.disciplines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <fieldset>
          <legend className="text-sm text-slate-700">{a.outcomesLegend}</legend>
          <div className="mt-1 space-y-1">
            {proposal.outcomes.map((o, i) => (
              <label key={o.id} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name={`${x.key}.outcomes`}
                  value={o.id}
                  defaultChecked={covered.has(o.id)}
                  className="mt-1"
                />
                <span>
                  {fmt(c.import.outcomeN, { n: i + 1 })}: {o.text}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </fieldset>
  );
}
