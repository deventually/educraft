import { Form, Link } from "react-router";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import {
  type AnchorKind,
  type AnchorOption,
  type AnchorView,
  anchorQuestion,
  anchorValue,
} from "~/lib/portfolio/anchors";
import { outcomeLabel } from "~/lib/portfolio/format";
import { LIMITS } from "~/lib/portfolio/schema";
import type { Anchor, Outcome } from "~/lib/portfolio/types";
import { Button, Card, HelpText, Label, Select, Textarea } from "~/components/ui";

export interface AnchorCourse {
  id: string;
  name: string;
  options: AnchorOption[];
}

/**
 * Step 3 of the start wizard: per learning outcome, the module, lesson or test it is about
 * (from the teacher's courses), a short description, or both. One form for all outcomes.
 */
export function AnchorForm({
  outcomes,
  anchors,
  courses,
}: {
  outcomes: Outcome[];
  anchors: Record<string, Anchor>;
  courses: AnchorCourse[];
}) {
  const ta = useT().portfolioStart.anchors;
  const kindLabel: Record<AnchorKind, string> = {
    module: ta.kindModule,
    lesson: ta.kindLesson,
    test: ta.kindTest,
  };
  const optionLabel = (o: AnchorOption) =>
    o.kind === "module" ? kindLabel.module : `${kindLabel[o.kind]}: ${o.title}`;

  return (
    <Card className="mt-6 p-5">
      <h2 className="text-lg font-medium text-slate-900">{ta.title}</h2>
      <p className="mt-1 text-sm text-slate-600">{ta.intro}</p>
      {outcomes.length === 0 ? (
        <p className="mt-3 text-sm text-slate-700">{ta.noOutcomes}</p>
      ) : (
        <Form method="post" className="mt-4 grid gap-6">
          <input type="hidden" name="intent" value="anchors" />
          {courses.length === 0 && (
            <p className="text-sm text-slate-700">
              {ta.noCourses}{" "}
              <Link
                to="/courses"
                className="font-medium text-violet-700 underline underline-offset-2"
              >
                {ta.noCoursesLink}
              </Link>
            </p>
          )}
          {outcomes.map((o) => {
            const anchor = anchors[o.id];
            const p = `anchor-${o.id}`;
            return (
              <fieldset key={o.id} className="grid gap-3 rounded-xl border border-slate-200 p-4">
                <legend className="px-1 font-medium text-slate-900">{outcomeLabel(o)}</legend>
                <p className="text-sm text-slate-700">{ta.hint[anchorQuestion(o)]}</p>
                {courses.length > 0 && (
                  <div>
                    <Label htmlFor={p}>{ta.choose}</Label>
                    <Select
                      id={p}
                      name={p}
                      defaultValue={anchor?.course ? anchorValue(anchor.course) : ""}
                    >
                      <option value="">{ta.none}</option>
                      {courses.map((c) => (
                        <optgroup key={c.id} label={c.name}>
                          {c.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {optionLabel(opt)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </div>
                )}
                <div>
                  <Label htmlFor={`description-${o.id}`}>{ta.describe}</Label>
                  <Textarea
                    id={`description-${o.id}`}
                    name={`description-${o.id}`}
                    rows={2}
                    maxLength={LIMITS.anchorDescription}
                    defaultValue={anchor?.description ?? ""}
                    aria-describedby={`description-${o.id}-help`}
                  />
                  <HelpText id={`description-${o.id}-help`}>{ta.describeHelp}</HelpText>
                </div>
              </fieldset>
            );
          })}
          <div>
            <Button type="submit">{ta.save}</Button>
          </div>
        </Form>
      )}
    </Card>
  );
}

/** "Waar gaat dit over?" on an outcome's overview: its anchor, and where to change it. */
export function AnchorSummary({
  view,
  changeHref,
}: {
  view: AnchorView | null;
  changeHref: string;
}) {
  const to = useT().portfolioStart.outcome;
  if (!view) return null;
  const what = view.gone
    ? to.gone
    : view.kind && view.course
      ? fmt(to[view.kind], { course: view.course, item: view.item ?? "" })
      : null;
  return (
    <section className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm" aria-labelledby="anchor-title">
      <h2 id="anchor-title" className="font-medium text-slate-900">
        {to.label}
      </h2>
      {what && <p className="mt-1 text-slate-800">{what}</p>}
      {view.description && (
        <p className="mt-1 whitespace-pre-line text-slate-700">{view.description}</p>
      )}
      <Link
        to={changeHref}
        className="mt-2 inline-block font-medium text-violet-700 underline underline-offset-2"
      >
        {to.change}
      </Link>
    </section>
  );
}
