import { Form } from "react-router";
import type { ProofreadSuggestion } from "~/lib/portfolio/types";
import { fmtDate } from "~/lib/portfolio/format";
import { Button } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export interface ProofreadView {
  at: number;
  modelName: string;
  /** Only proposals whose span is still in the chapter; `index` is the stored position. */
  suggestions: (ProofreadSuggestion & { index: number })[];
}

/**
 * The latest proofreading of a chapter: per proposal the sentence as it is now,
 * what is wrong, and the better version. The teacher takes it over (exactly that
 * span changes in the saved chapter) or ignores it.
 */
export function ProofreadPanel({ outcomeId, view }: { outcomeId: string; view: ProofreadView }) {
  const t = useT().portfolio.proofread;
  const locale = useLocale();
  return (
    <section className="mt-8" aria-labelledby="proofread-title">
      <h2 id="proofread-title" className="text-lg font-medium text-slate-900">
        {t.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t.intro}</p>
      <p className="mt-2 text-sm text-slate-600">
        {fmt(t.readAt, { date: fmtDate(view.at, locale), model: view.modelName })}
      </p>
      {view.suggestions.length === 0 ? (
        <p className="mt-3 text-sm text-slate-700">{t.empty}</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {view.suggestions.map((s, i) => (
            <li
              key={`${s.index}:${s.quote}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="inline-block rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                {t.issue[s.issue]}
              </p>
              {s.explanation && <p className="mt-2 text-sm text-slate-800">{s.explanation}</p>}
              <dl className="mt-3 grid gap-2 text-sm">
                <div>
                  <dt className="text-xs font-medium text-slate-600">{t.now}</dt>
                  <dd className="mt-1 border-l-4 border-slate-200 pl-3 text-slate-800">
                    {s.quote}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-600">{t.better}</dt>
                  <dd className="mt-1 border-l-4 border-emerald-300 pl-3 text-slate-900">
                    {s.suggestion}
                  </dd>
                </div>
              </dl>
              <Form method="post" className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="outcomeId" value={outcomeId} />
                <input type="hidden" name="index" value={s.index} />
                <Button
                  type="submit"
                  name="intent"
                  value="takeProofread"
                  size="sm"
                  aria-label={fmt(t.takeLabel, { n: i + 1 })}
                >
                  {t.take}
                </Button>
                <Button
                  type="submit"
                  name="intent"
                  value="skipProofread"
                  variant="secondary"
                  size="sm"
                  aria-label={fmt(t.skipLabel, { n: i + 1 })}
                >
                  {t.skip}
                </Button>
              </Form>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
