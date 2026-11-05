import { Link } from "react-router";
import { AlertTriangle, CircleCheck, CircleX } from "lucide-react";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmtDate, outcomeLabel } from "~/lib/portfolio/format";
import {
  type ReadinessFix,
  type ReadinessItem,
  type ReadinessLevel,
  readinessSummary,
} from "~/lib/portfolio/readiness";
import type { Framework } from "~/lib/portfolio/types";

/** "Nog 3 punten open, waarvan 2 blokkerend." or "Alles klaar om in te leveren." */
function useSummaryText(items: ReadinessItem[]): { open: number; text: string } {
  const t = useT().portfolioReadiness;
  const { open, blocking } = readinessSummary(items);
  if (open === 0) return { open, text: t.allDone };
  const head = open === 1 ? t.openOne : fmt(t.open, { n: open });
  return { open, text: `${head}${blocking ? fmt(t.blocking, { n: blocking }) : ""}.` };
}

/** Above the export button: the same summary, as a link to the check. Nothing when all is done. */
export function ReadinessSummaryLink({ items }: { items: ReadinessItem[] }) {
  const { open, text } = useSummaryText(items);
  if (open === 0) return null;
  return (
    <a
      href="#readiness"
      className="w-full text-sm font-medium text-violet-700 underline underline-offset-2"
    >
      {text}
    </a>
  );
}

const ICON: Record<ReadinessLevel, { Icon: typeof CircleCheck; className: string }> = {
  ok: { Icon: CircleCheck, className: "text-emerald-700" },
  warn: { Icon: AlertTriangle, className: "text-amber-700" },
  block: { Icon: CircleX, className: "text-red-700" },
};

function fixHref(base: string, fix: ReadinessFix): string {
  switch (fix.to) {
    case "framework":
      return `${base}/framework`;
    case "evidence":
      return `${base}/outcome/${fix.outcomeId}#evidence-title`;
    case "chapter":
      return `${base}/outcome/${fix.outcomeId}#chapter-${fix.outcomeId}`;
    case "criterion":
      return `${base}/outcome/${fix.outcomeId}#status-${fix.criterionId}`;
    case "references":
      return "#references-title";
    case "export":
      return "#export";
  }
}

/**
 * "Klaar om in te leveren?" (P29.1): every check with an icon and a word (never
 * colour alone), the outcome it is about, and a "Los op" link to where you fix it.
 * A self-check is a checkbox that saves itself. Advice only: the export always works.
 */
export function ReadinessCheck({
  dossierId,
  items,
  framework,
}: {
  dossierId: string;
  items: ReadinessItem[];
  framework: Framework;
}) {
  const t = useT();
  const tr = t.portfolioReadiness;
  const locale = useLocale();
  const { text: summary } = useSummaryText(items);
  const base = `/portfolio/${dossierId}`;
  const outcomes = new Map(framework.outcomes.map((o) => [o.id, o]));
  const criterion = (id?: string) =>
    framework.outcomes.flatMap((o) => o.criteria).find((c) => c.id === id)?.text ?? "";

  return (
    <section id="readiness" className="mt-8 scroll-mt-4" aria-labelledby="readiness-title">
      <h2 id="readiness-title" className="text-lg font-medium text-slate-900">
        {tr.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{tr.intro}</p>
      <p className="mt-2 font-medium text-slate-900">{summary}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => {
          const { Icon, className } = ICON[item.level];
          const outcome = item.outcomeId ? outcomes.get(item.outcomeId) : undefined;
          const text = fmt(tr.items[item.code][item.level === "ok" ? "ok" : "problem"], {
            criterion: criterion(item.criterionId),
            detail: item.detail ?? "",
            count: item.count ?? 0,
            limit: item.limit ?? 0,
          });
          return (
            <li
              // Items of one code differ by their subject; the index keeps keys unique.
              // biome-ignore lint/suspicious/noArrayIndexKey: the list is derived, never reordered
              key={`${item.code}-${i}`}
              className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-slate-900">{tr.level[item.level]}: </span>
                {item.tick ? (
                  <AutoSaveForm
                    intent="tickReadiness"
                    hidden={{ code: item.code }}
                    errorMessage={(code) => (typeof code === "string" ? code : undefined)}
                    className="inline"
                  >
                    <label className="inline text-slate-800">
                      <input
                        type="checkbox"
                        name="ticked"
                        value="on"
                        defaultChecked={item.tickedAt !== undefined}
                        className="mr-2 align-middle"
                      />
                      <span id={`readiness-${i}`}>{text}</span>
                    </label>
                  </AutoSaveForm>
                ) : (
                  <span id={`readiness-${i}`} className="text-slate-800">
                    {text}
                  </span>
                )}
                {outcome && <span className="block text-slate-600">{outcomeLabel(outcome)}</span>}
                {item.tickedAt !== undefined && (
                  <span className="block text-slate-600">
                    {fmt(tr.ticked, { date: fmtDate(item.tickedAt, locale) })}
                  </span>
                )}
                {item.code === "min-constructed-items" && item.tickedAt === undefined && (
                  <span className="block text-slate-600">
                    {fmt(tr.counted, { count: item.count ?? 0 })}
                  </span>
                )}
              </div>
              {item.fix && item.level !== "ok" && (
                <Link
                  to={fixHref(base, item.fix)}
                  aria-describedby={`readiness-${i}`}
                  className="shrink-0 font-medium text-violet-700 underline underline-offset-2"
                >
                  {tr.fix}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
