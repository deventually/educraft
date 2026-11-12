import { useEffect, useId, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { AiCallField } from "~/components/AiLeaveGuard";
import { Button, Card, HelpText, Label, Textarea } from "~/components/ui";
import { DESIGN_LESSONS_LIMITS, type LessonsProposal } from "~/lib/courses/designLessons";
import type { CourseSchedule } from "~/lib/courses/types";
import { useT } from "~/lib/i18n/useT";
import { NumberField } from "./fields";
import { LessonsProposalForm } from "./LessonsProposalForm";
import { AiNotes } from "./ProposalForm";

type LessonsAction = { ok: boolean; intent?: string; proposal?: unknown } | undefined;

/**
 * The lesson series of the last `design-lessons`, kept across a failed apply (the teacher's
 * choice is not lost) and cleared after a successful `design-lessons-apply`.
 */
export function useLessonsProposal(actionData: LessonsAction): LessonsProposal | null {
  const [proposal, setProposal] = useState<LessonsProposal | null>(null);
  useEffect(() => {
    if (!actionData?.ok) return;
    if (actionData.intent === "design-lessons" && actionData.proposal)
      setProposal(actionData.proposal as LessonsProposal);
    if (actionData.intent === "design-lessons-apply") setProposal(null);
  }, [actionData]);
  return proposal;
}

/**
 * The course wizard, step 3 (backwards design: how do they get there?). Shown while the course
 * has outcomes and tests and no lessons: the AI proposes lessons and assignments per week, and
 * the teacher ticks what goes in. The weeks and sessions per week are asked only while the
 * schedule has none.
 */
export function CourseDesignLessons({
  schedule,
  proposal,
  notes,
  onLater,
}: {
  schedule: CourseSchedule | undefined;
  /** The last lesson series proposed, until the teacher applies it. */
  proposal: LessonsProposal | null;
  /** What the AI still needs, when it proposed nothing. */
  notes?: string;
  /** "Later": the page drops the proposal; the step stays here on the overview. */
  onLater: () => void;
}) {
  const l = useT().courseDesign.lessons;
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const nav = useNavigation();
  const busy = nav.state === "submitting" && nav.formData?.get("intent") === "design-lessons";
  const askWeeks = schedule?.weeks === undefined;
  const askSessions = schedule?.sessionsPerWeek === undefined;
  return (
    <section aria-labelledby={`${id}-title`}>
      <h2
        id={`${id}-title`}
        ref={heading}
        tabIndex={-1}
        className="text-lg font-medium text-slate-900"
      >
        {l.title}
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{l.intro}</p>
      <Card className="mt-3 p-4">
        <Form method="post" className="grid gap-3">
          <input type="hidden" name="intent" value="design-lessons" />
          <AiCallField />
          {(askWeeks || askSessions) && (
            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                {askWeeks && <NumberField id={`${id}-weeks`} name="weeks" label={l.weeks} />}
                {askSessions && (
                  <NumberField
                    id={`${id}-sessions`}
                    name="sessionsPerWeek"
                    label={l.sessionsPerWeek}
                  />
                )}
              </div>
              <HelpText>{l.numbersHelp}</HelpText>
            </div>
          )}
          <div>
            <Label htmlFor={`${id}-wishes`}>{l.wishes}</Label>
            <Textarea
              id={`${id}-wishes`}
              name="wishes"
              rows={2}
              maxLength={DESIGN_LESSONS_LIMITS.wishes}
              aria-describedby={`${id}-wishes-help`}
              className="mt-1"
            />
            <HelpText id={`${id}-wishes-help`}>{l.wishesHelp}</HelpText>
          </div>
          <div>
            <Button type="submit" disabled={busy}>
              {l.submit}
            </Button>
          </div>
        </Form>
        {notes && !proposal && <AiNotes notes={notes} />}
        {proposal && (
          <LessonsProposalForm
            proposal={proposal}
            onLater={() => {
              onLater();
              // The form goes; keyboard focus lands on the step instead of the page top.
              heading.current?.focus();
            }}
          />
        )}
      </Card>
    </section>
  );
}
