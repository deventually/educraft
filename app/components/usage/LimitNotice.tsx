import { Link } from "react-router";
import type { AppliedLimit } from "~/lib/usage/limits";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";

export type ViewerLimit = AppliedLimit & { teamName?: string };

/** Whose limit it is, for a sentence: "je eigen limiet", "de limiet van team X", … */
export function useLimitScope() {
  const t = useT();
  return (limit: ViewerLimit) =>
    limit.scope === "team"
      ? fmt(t.usage.limitScope.team, { name: limit.teamName ?? "" })
      : t.usage.limitScope[limit.scope];
}

/**
 * The monthly limit's notice (PR D): from 80% a warning, at 100% that the AI stops. As a
 * share, never in euros. Nothing below 80%. `link` adds a way to the usage page.
 */
export function LimitNotice({ limit, link }: { limit: ViewerLimit | null; link?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const scopeOf = useLimitScope();
  if (!limit || limit.state === "ok") return null;
  const pct = Math.min(limit.share, 1).toLocaleString(locale === "en" ? "en-GB" : "nl-NL", {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const stop = limit.state === "stop";
  return (
    <p
      className={`rounded-xl border px-4 py-3 text-sm ${
        stop
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      {fmt(stop ? t.usage.limitStop : t.usage.limitWarn, { pct, scope: scopeOf(limit) })}
      {link && (
        <>
          {" "}
          <Link to="/usage" className="font-medium underline underline-offset-2">
            {t.nav.usage}
          </Link>
        </>
      )}
    </p>
  );
}
