import type { Locale } from "~/lib/i18n";
import { type LocalizedText, loc } from "~/lib/i18n/localized";

/**
 * Small book/technique name under a tool's task-first title. Plain text (no
 * live region, no extra role): the heading stays the accessible name and this
 * is supporting context read right after it.
 */
export function ToolSubtitle({
  subtitle,
  locale,
  className = "",
}: {
  subtitle?: LocalizedText;
  locale: Locale;
  className?: string;
}) {
  if (!subtitle) return null;
  return <p className={`text-xs text-slate-500 ${className}`.trim()}>{loc(subtitle, locale)}</p>;
}
