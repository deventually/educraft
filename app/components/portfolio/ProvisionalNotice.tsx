import { useT } from "~/lib/i18n/useT";

/**
 * Says the AI works on the national starting point (a provisional framework), on every page where
 * it gives a verdict: the outcome page (coach, draft) and the rehearsal.
 */
export function ProvisionalNotice({ className = "" }: { className?: string }) {
  const t = useT().portfolio;
  return (
    <p
      className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}
    >
      {t.provisionalNotice}
    </p>
  );
}
