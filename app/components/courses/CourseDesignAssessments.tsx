import { useId } from "react";
import { Form, useNavigation } from "react-router";
import { AiCallField } from "~/components/AiLeaveGuard";
import { Button, Card, HelpText, Label, Textarea } from "~/components/ui";
import { DESIGN_ASSESSMENTS_LIMITS } from "~/lib/courses/designAssessments";
import type { ImportProposal } from "~/lib/courses/import";
import { useT } from "~/lib/i18n/useT";
import { AiNotes, ProposalForm } from "./ProposalForm";

/**
 * The course wizard, step 2 (backwards design: how do you know they can do it?). Shown while
 * the course has outcomes and no tests: the AI proposes a test programme over those outcomes,
 * optionally from the school's own assessment forms, and the teacher ticks what goes in.
 */
export function CourseDesignAssessments({
  proposal,
  notes,
}: {
  /** The last test programme proposed, until the teacher applies it. */
  proposal: ImportProposal | null;
  /** What the AI still needs, when it proposed nothing. */
  notes?: string;
}) {
  const a = useT().courseDesign.assessments;
  const id = useId();
  const nav = useNavigation();
  const busy = nav.state === "submitting" && nav.formData?.get("intent") === "design-assessments";
  return (
    <section aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-medium text-slate-900">
        {a.title}
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{a.intro}</p>
      <Card className="mt-3 p-4">
        <Form method="post" className="grid gap-3">
          <input type="hidden" name="intent" value="design-assessments" />
          <AiCallField />
          <div>
            <Label htmlFor={`${id}-forms`}>{a.forms}</Label>
            <Textarea
              id={`${id}-forms`}
              name="forms"
              rows={2}
              maxLength={DESIGN_ASSESSMENTS_LIMITS.forms}
              aria-describedby={`${id}-forms-help`}
              className="mt-1"
            />
            <HelpText id={`${id}-forms-help`}>{a.formsHelp}</HelpText>
          </div>
          <div>
            <Button type="submit" disabled={busy}>
              {a.submit}
            </Button>
          </div>
        </Form>
        {notes && !proposal && <AiNotes notes={notes} />}
        {proposal && <ProposalForm proposal={proposal} />}
      </Card>
    </section>
  );
}
