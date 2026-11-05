import { Link } from "react-router";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import type { HintStep } from "~/lib/portfolio/toolHints";

export interface ToolHintView {
  slug: string;
  name: string;
}

/**
 * Which LimeOnIt tool helps at this moment, and how. Renders nothing without
 * hints: no fitting tool means no suggestion.
 */
export function ToolHints({
  hints,
  step,
  from,
  className = "",
}: {
  hints: ToolHintView[];
  step: HintStep;
  /** P27.2: the tool opens for this criterion and its result can go straight back. */
  from?: { dossierId: string; criterionId: string };
  className?: string;
}) {
  const t = useT();
  const tt = t.portfolio.tools;
  if (hints.length === 0) return null;
  const how = tt.how as Record<string, string>;
  const query = from
    ? `?${new URLSearchParams({ dossier: from.dossierId, criterion: from.criterionId })}`
    : "";
  return (
    <div className={`rounded-xl bg-slate-50 p-3 text-sm ${className}`}>
      <p className="font-medium text-slate-900">
        {step === "evidence" ? tt.title : tt.chapterTitle}
      </p>
      <ul className="mt-1 space-y-1">
        {hints.map((h) => (
          <li key={h.slug} className="text-slate-700">
            <Link
              to={`/tools/${h.slug}${query}`}
              className="font-medium text-violet-700 underline underline-offset-2"
            >
              {fmt(tt.open, { tool: h.name })}
            </Link>
            {how[h.slug] ? ` — ${how[h.slug]}` : null}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-slate-600">{step === "evidence" ? tt.saveHow : tt.thinkHow}</p>
    </div>
  );
}
