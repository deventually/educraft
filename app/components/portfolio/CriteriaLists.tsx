import { Form } from "react-router";
import { Button, Label, Select } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { CRITERION_STATUSES, type Criterion, type CriterionStatus } from "~/lib/portfolio/types";

const CARD = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

/** On the outcome's overview: what each criterion asks, and what makes it stronger. */
export function CriteriaOverview({ criteria }: { criteria: Criterion[] }) {
  const t = useT();
  return (
    <section className="mt-8" aria-labelledby="criteria-title">
      <h2 id="criteria-title" className="text-lg font-medium text-slate-900">
        {t.portfolioRoute.tabs.criteriaTitle}
      </h2>
      <ol className="mt-3 space-y-3">
        {criteria.map((c, i) => (
          <li key={c.id} className={CARD}>
            <p className="text-slate-900">
              <span className="font-medium">{i + 1}.</span> {c.text}
            </p>
            {c.strongLevel && (
              <p className="mt-1 text-sm text-slate-600">
                {fmt(t.portfolio.outcome.strongLevel, { text: c.strongLevel })}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** On the assessment tab: the teacher's own status per criterion. Only the teacher sets it. */
export function StatusList({
  criteria,
  status,
}: {
  criteria: Criterion[];
  status: Record<string, CriterionStatus>;
}) {
  const t = useT();
  const to = t.portfolio.outcome;
  return (
    <section className="mt-8" aria-labelledby="status-title">
      <h2 id="status-title" className="text-lg font-medium text-slate-900">
        {t.portfolioRoute.tabs.statusTitle}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{to.criteriaIntro}</p>
      <ol className="mt-3 space-y-3">
        {criteria.map((c, i) => (
          <li key={c.id} className={CARD}>
            <p className="text-slate-900">
              <span className="font-medium">{i + 1}.</span> {c.text}
            </p>
            <Form method="post" className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="intent" value="setStatus" />
              <input type="hidden" name="criterionId" value={c.id} />
              <div>
                <Label htmlFor={`status-${c.id}`}>
                  {to.statusLabel} {i + 1}
                </Label>
                <Select id={`status-${c.id}`} name="status" defaultValue={status[c.id]}>
                  {CRITERION_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {t.portfolio.status[st]}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" variant="secondary" size="sm">
                {to.saveStatus}
              </Button>
            </Form>
          </li>
        ))}
      </ol>
    </section>
  );
}
