import { Link } from "react-router";
import { ArrowLeft, FolderCheck } from "lucide-react";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export interface ForCriterion {
  dossierId: string;
  dossierName: string;
  outcomeId: string;
  criterionId: string;
  criterionText: string;
}

/**
 * A narrow bar on a tool page opened from a dossier criterion (P27.2, route step 3):
 * which criterion the work is for, and the way back.
 */
export function DossierBar({ dossierId, dossierName, outcomeId, criterionText }: ForCriterion) {
  const t = useT();
  const tb = t.portfolio.bar;
  return (
    <aside
      aria-label={tb.label}
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm"
    >
      <p className="flex min-w-0 items-start gap-2 text-slate-800">
        <FolderCheck className="mt-0.5 size-4 shrink-0 text-violet-700" aria-hidden />
        <span>
          <span className="font-medium">{tb.for}</span> <em>{criterionText}</em>
        </span>
      </p>
      <Link
        to={`/portfolio/${dossierId}/outcome/${outcomeId}`}
        className="inline-flex items-center gap-1 font-medium text-violet-700 underline underline-offset-2"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {fmt(tb.back, { dossier: dossierName })}
      </Link>
    </aside>
  );
}
