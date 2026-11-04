import type { Locale } from "~/lib/i18n";

const TAG: Record<Locale, string> = { nl: "nl-NL", en: "en-GB" };

/** A number with up to two decimals, in the locale's notation (16,5 / 16.5). */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(TAG[locale], {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value);
}

/** A grade with a fixed number of decimals (1,0 / 10,0). */
export function formatGrade(value: number, decimals: number, locale: Locale): string {
  return new Intl.NumberFormat(TAG[locale], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false,
  }).format(value);
}

/** Parse what a teacher typed: accepts a decimal comma; empty or junk → NaN. */
export function parseNumber(raw: string): number {
  const s = raw.trim().replace(",", ".");
  if (s === "" || !/^-?\d*\.?\d+$/.test(s)) return Number.NaN;
  return Number(s);
}

/** Copy text to the clipboard; resolves false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
