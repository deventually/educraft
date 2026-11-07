import { Form, Link } from "react-router";
import { fmtDate, outcomeLabel } from "~/lib/portfolio/format";
import type { Outcome } from "~/lib/portfolio/types";
import { Button } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export interface DossierReviewRow {
  outcomeId: string;
  at: number;
  modelName: string;
  shown: number;
  partial: number;
  missing: number;
  overall: string;
}

/**
 * Step 5, "Beoordeel het hele dossier": one button that runs the coach over
 * every chapter, and the latest verdicts per outcome with a link to the
 * chapter's own assessment. Advice only; it never sets a status.
 */
export function DossierReviewPanel({
  dossierId,
  outcomes,
  rows,
  canRun,
}: {
  dossierId: string;
  outcomes: Outcome[];
  rows: DossierReviewRow[];
  /** A confirmed framework and at least one chapter with text. */
  canRun: boolean;
}) {
  const tp = useT().portfolio;
  const t = tp.dossierReview;
  const locale = useLocale();
  const byId = new Map(outcomes.map((o) => [o.id, o]));
  const reviewed = new Set(rows.map((r) => r.outcomeId));
  const notReviewed = outcomes.filter((o) => !reviewed.has(o.id)).map(outcomeLabel);
  return (
    <section className="mt-8" aria-labelledby="dossier-review-title">
      <h2 id="dossier-review-title" className="text-lg font-medium text-slate-900">
        {t.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t.intro}</p>
      <Form method="post" className="mt-3">
        <input type="hidden" name="intent" value="reviewAll" />
        <Button type="submit" variant="secondary" disabled={!canRun}>
          {rows.length > 0 ? t.rerun : t.run}
        </Button>
      </Form>
      {rows.length > 0 && (
        <ul className="mt-4 space-y-3">
          {rows.flatMap((r) => {
            const o = byId.get(r.outcomeId);
            if (!o) return [];
            const label = outcomeLabel(o);
            return [
              <li
                key={r.outcomeId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h3 className="font-medium text-slate-900">{label}</h3>
                <p className="mt-1 text-sm text-slate-800">
                  {fmt(t.counts, { shown: r.shown, partial: r.partial, missing: r.missing })}
                </p>
                {r.overall && <p className="mt-2 text-sm text-slate-800">{r.overall}</p>}
                <p className="mt-2 text-xs text-slate-600">
                  {fmt(tp.coach.reviewedAt, {
                    date: fmtDate(r.at, locale),
                    model: r.modelName,
                  })}
                </p>
                <Link
                  to={`/portfolio/${dossierId}/outcome/${r.outcomeId}#coach-title`}
                  className="mt-2 inline-block text-sm font-medium text-violet-700 underline underline-offset-2"
                >
                  {fmt(t.open, { outcome: label })}
                </Link>
              </li>,
            ];
          })}
        </ul>
      )}
      {rows.length > 0 && notReviewed.length > 0 && (
        <p className="mt-3 text-sm text-slate-600">
          {fmt(t.notReviewed, { items: notReviewed.join("; ") })}
        </p>
      )}
    </section>
  );
}
