import { useId } from "react";
import { Form, Link, useNavigation } from "react-router";
import { AiCallField } from "~/components/AiLeaveGuard";
import { Button, Card, HelpText, Label, Textarea } from "~/components/ui";
import { DESIGN_LIMITS } from "~/lib/courses/design";
import type { ImportProposal } from "~/lib/courses/import";
import { courseTabHref } from "~/lib/courses/tabs";
import type { CourseData } from "~/lib/courses/types";
import { useT } from "~/lib/i18n/useT";
import { AiNotes, ProposalForm } from "./ProposalForm";
import { NumberField } from "./fields";

const choice = "rounded-md border border-slate-200 p-3";

/**
 * How an empty course starts (the course wizard): design it in broad outline (the AI proposes
 * learning outcomes from a short description), start from a document (the import below), or
 * start empty. `design` is false when the admin switched the wizard off.
 */
export function CourseStart({
  courseId,
  data,
  design,
  proposal,
  notes,
}: {
  courseId: string;
  data: CourseData;
  design: boolean;
  /** The last design proposal, until the teacher applies it. */
  proposal: ImportProposal | null;
  /** What the AI still needs, when it proposed nothing. */
  notes?: string;
}) {
  const t = useT();
  const d = t.courseDesign;
  const s = d.start;
  const id = useId();
  return (
    <section aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-medium text-slate-900">
        {s.title}
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{s.intro}</p>
      <Card className="mt-3 p-4">
        <ul className="space-y-3">
          {design && (
            <li className={choice}>
              <details open={!!proposal || !!notes}>
                <summary className="cursor-pointer">
                  <span className="font-medium text-slate-900">{s.design.title}</span>
                  <span className="mt-1 block text-sm text-slate-600">{s.design.body}</span>
                </summary>
                <DesignForm data={data} />
                {notes && !proposal && <AiNotes notes={notes} />}
                {proposal && <ProposalForm proposal={proposal} />}
              </details>
            </li>
          )}
          <li className={choice}>
            <p className="font-medium text-slate-900">{s.document.title}</p>
            <p className="mt-1 text-sm text-slate-600">{s.document.body}</p>
            <a
              href="#course-import"
              className="mt-2 inline-block text-sm font-medium text-violet-700 underline underline-offset-2"
            >
              {s.document.cta}
            </a>
          </li>
          <li className={choice}>
            <p className="font-medium text-slate-900">{s.blank.title}</p>
            <p className="mt-1 text-sm text-slate-600">{s.blank.body}</p>
            <Link
              to={courseTabHref(courseId, "outcomes")}
              className="mt-2 inline-block text-sm font-medium text-violet-700 underline underline-offset-2"
            >
              {s.blank.cta}
            </Link>
          </li>
        </ul>
      </Card>
    </section>
  );
}

/** Step 1: the description, the EC and the weeks; prefilled from the course. */
function DesignForm({ data }: { data: CourseData }) {
  const d = useT().courseDesign;
  const id = useId();
  const nav = useNavigation();
  const busy = nav.state === "submitting" && nav.formData?.get("intent") === "design-outcomes";
  return (
    <Form method="post" className="mt-4 grid gap-3">
      <input type="hidden" name="intent" value="design-outcomes" />
      <AiCallField />
      <div>
        <Label htmlFor={`${id}-description`}>{d.description}</Label>
        <Textarea
          id={`${id}-description`}
          name="description"
          rows={5}
          required
          maxLength={DESIGN_LIMITS.description}
          defaultValue={data.description ?? ""}
          aria-describedby={`${id}-description-help`}
          className="mt-1"
        />
        <HelpText id={`${id}-description-help`}>{d.descriptionHelp}</HelpText>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField id={`${id}-ec`} name="ec" label={d.ec} value={data.ec} />
        <NumberField id={`${id}-weeks`} name="weeks" label={d.weeks} value={data.schedule?.weeks} />
      </div>
      <HelpText>{d.numbersHelp}</HelpText>
      <div>
        <Button type="submit" disabled={busy}>
          {d.submit}
        </Button>
      </div>
    </Form>
  );
}
