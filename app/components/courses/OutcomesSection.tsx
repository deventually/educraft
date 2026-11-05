import { useId } from "react";
import { Form } from "react-router";
import type { CourseData, LearningOutcome } from "~/lib/courses/types";
import { bloomLabel } from "~/lib/courses/bloom";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { Button, Card, Label, Textarea } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { BloomSelect, useOutcomeName } from "./fields";
import { ItemActions } from "./ItemActions";

function OutcomeForm({ outcome }: { outcome?: LearningOutcome }) {
  const t = useT();
  const id = useId();
  return (
    <Form method="post" className="space-y-3">
      <input type="hidden" name="intent" value={outcome ? "update-outcome" : "add-outcome"} />
      {outcome && <input type="hidden" name="id" value={outcome.id} />}
      <div>
        <Label htmlFor={`${id}-text`}>{t.courses.outcomes.text}</Label>
        <Textarea
          id={`${id}-text`}
          name="text"
          required
          rows={2}
          maxLength={COURSE_LIMITS.text}
          defaultValue={outcome?.text}
          className="mt-1"
        />
      </div>
      <div className="sm:w-60">
        <BloomSelect
          id={`${id}-bloom`}
          name="bloom"
          value={outcome?.bloom}
          label={t.courses.bloomLabel}
        />
      </div>
      <Button type="submit" size="sm" variant={outcome ? "secondary" : "primary"}>
        {outcome ? t.courses.save : t.courses.outcomes.add}
      </Button>
    </Form>
  );
}

export function OutcomesSection({ data }: { data: CourseData }) {
  const t = useT();
  const locale = useLocale();
  const outcomeName = useOutcomeName();
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {t.courses.outcomes.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t.courses.outcomes.intro}</p>
      {data.outcomes.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{t.courses.outcomes.empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.outcomes.map((o, i) => (
            <li key={o.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-slate-900">
                <strong className="font-medium">{outcomeName(i)}</strong> {o.text}
              </p>
              {o.bloom && (
                <p className="text-sm text-slate-600">
                  {t.courses.bloomLabel}: {bloomLabel(o.bloom, locale)}
                </p>
              )}
              <ItemActions name={outcomeName(i)} removeIntent="remove-outcome" id={o.id}>
                <OutcomeForm outcome={o} />
              </ItemActions>
            </li>
          ))}
        </ul>
      )}
      <Card className="mt-3 p-4">
        <OutcomeForm />
      </Card>
    </section>
  );
}
