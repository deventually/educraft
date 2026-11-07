import { Form, Link } from "react-router";
import type { CoachReview, Criterion, CriterionStatus, Verdict } from "~/lib/portfolio/types";
import { fmtDate } from "~/lib/portfolio/format";
import { Button } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { cn } from "~/lib/utils";

const VERDICT_STYLE: Record<Verdict, string> = {
  shown: "bg-emerald-50 text-emerald-800 border-emerald-200",
  partial: "bg-amber-50 text-amber-900 border-amber-200",
  missing: "bg-slate-100 text-slate-800 border-slate-200",
};

/**
 * The coach on an outcome page: "Laat beoordelen" with "Lees proef" beside
 * it, and the latest review per criterion. Advice only; the one action it
 * offers is the teacher's own "mark as shown".
 */
export function CoachPanel({
  dossierId,
  outcomeId,
  criteria,
  status,
  confirmed,
  hasChapter,
  stored,
  proofread,
}: {
  dossierId: string;
  outcomeId: string;
  criteria: Criterion[];
  status: Record<string, CriterionStatus>;
  confirmed: boolean;
  hasChapter: boolean;
  stored?: {
    at: number;
    model: string;
    modelName: string;
    provisional?: true;
    review: CoachReview;
  };
  /** True once the chapter was proofread: the button then says "again". */
  proofread?: boolean;
}) {
  const tp = useT().portfolio;
  const t = tp.coach;
  const locale = useLocale();
  const byId = new Map(criteria.map((c, i) => [c.id, { c, n: i + 1 }]));

  return (
    <section className="mt-8" aria-labelledby="coach-title">
      <h2 id="coach-title" className="text-lg font-medium text-slate-900">
        {t.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t.intro}</p>

      {!confirmed && (
        <p className="mt-3 text-sm text-slate-700">
          {t.needsConfirm}{" "}
          <Link
            to={`/portfolio/${dossierId}/framework`}
            className="font-medium text-violet-700 underline underline-offset-2"
          >
            {tp.frameworkLink}
          </Link>
        </p>
      )}
      {/* Proofreading sits beside the coach; it needs no confirmed framework. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {confirmed && (
          <Form method="post">
            <input type="hidden" name="intent" value="review" />
            <input type="hidden" name="outcomeId" value={outcomeId} />
            <Button type="submit" disabled={!hasChapter}>
              {stored ? t.rerun : t.run}
            </Button>
          </Form>
        )}
        <Form method="post">
          <input type="hidden" name="intent" value="proofread" />
          <input type="hidden" name="outcomeId" value={outcomeId} />
          <Button type="submit" variant="secondary" disabled={!hasChapter}>
            {proofread ? tp.proofread.rerun : tp.proofread.run}
          </Button>
        </Form>
      </div>
      {!hasChapter && <p className="mt-1 text-sm text-slate-600">{t.needsChapter}</p>}

      {stored && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">
            {fmt(t.reviewedAt, { date: fmtDate(stored.at, locale), model: stored.modelName })}
            {stored.provisional && (
              <>
                {" "}
                <strong className="font-medium text-amber-900">{t.reviewedProvisional}</strong>
              </>
            )}
          </p>
          {stored.review.overall && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <h3 className="text-sm font-medium text-violet-900">{t.overall}</h3>
              <p className="mt-1 text-slate-900">{stored.review.overall}</p>
            </div>
          )}
          <ol className="space-y-3">
            {stored.review.criteria.flatMap((r) => {
              const entry = byId.get(r.criterionId);
              if (!entry) return [];
              const { c, n } = entry;
              return [
                <li
                  key={r.criterionId}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <h3 className="text-sm font-medium text-slate-900">
                    {n}. {c.text}
                  </h3>
                  <p
                    className={cn(
                      "mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      VERDICT_STYLE[r.verdict],
                    )}
                  >
                    {t.verdict[r.verdict]}
                  </p>
                  {r.quote && (
                    <figure className="mt-3">
                      <figcaption className="text-xs font-medium text-slate-600">
                        {t.quote}
                      </figcaption>
                      <blockquote className="mt-1 border-l-4 border-violet-200 pl-3 text-sm italic text-slate-800">
                        {r.quote}
                      </blockquote>
                    </figure>
                  )}
                  {r.quoteUnverified && (
                    <p className="mt-2 text-sm text-slate-700">{t.quoteUnverified}</p>
                  )}
                  {r.gap && (
                    <div className="mt-3">
                      <h4 className="text-xs font-medium text-slate-600">{t.gap}</h4>
                      <p className="text-sm text-slate-800">{r.gap}</p>
                    </div>
                  )}
                  {r.strengthen.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-medium text-slate-600">{t.strengthen}</h4>
                      <ul className="list-disc pl-5 text-sm text-slate-800">
                        {r.strengthen.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.evidenceNeeded.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-medium text-slate-600">{t.evidenceNeeded}</h4>
                      <ul className="list-disc pl-5 text-sm text-slate-800">
                        {r.evidenceNeeded.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {status[c.id] === "shown" ? (
                    <p className="mt-3 text-sm text-slate-600">{t.alreadyShown}</p>
                  ) : (
                    <Form method="post" className="mt-3">
                      <input type="hidden" name="intent" value="setStatus" />
                      <input type="hidden" name="criterionId" value={c.id} />
                      <input type="hidden" name="status" value="shown" />
                      <Button
                        type="submit"
                        variant="secondary"
                        size="sm"
                        aria-label={`${t.markShown}: ${n}`}
                      >
                        {t.markShown}
                      </Button>
                    </Form>
                  )}
                </li>,
              ];
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
