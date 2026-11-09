import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useLocale, useT } from "~/lib/i18n/useT";

/**
 * Under an unexpected error: what a teacher passes on to the admin. The exact time (to the
 * second) and the page let the owner find the error on "Recente fouten". The time is the
 * reader's own clock, set after hydration, so the server's time zone never shows.
 */
export function ErrorReportHint({ now }: { now?: Date }) {
  const t = useT().error;
  const locale = useLocale();
  const { pathname } = useLocation();
  const [at, setAt] = useState<Date | null>(now ?? null);
  useEffect(() => {
    setAt((current) => current ?? new Date());
  }, []);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <p className="text-slate-700">{t.reportHint}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-slate-500">{t.reportTime}</dt>
        <dd className="text-slate-900">
          {at?.toLocaleString(locale === "en" ? "en-GB" : "nl-NL", {
            dateStyle: "medium",
            timeStyle: "medium",
          })}
        </dd>
        <dt className="text-slate-500">{t.reportPage}</dt>
        <dd className="min-w-0">
          <code className="break-all text-xs text-slate-900">{pathname}</code>
        </dd>
      </dl>
    </div>
  );
}
