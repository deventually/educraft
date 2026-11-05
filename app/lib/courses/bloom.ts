/**
 * The revised Bloom taxonomy (Anderson & Krathwohl, 2001), lowest to highest.
 * Stored as English slugs, shown bilingually.
 */
import type { Locale } from "~/lib/i18n";

export const BLOOM_LEVELS = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
] as const;
export type BloomLevel = (typeof BLOOM_LEVELS)[number];

const LABELS: Record<BloomLevel, Record<Locale, string>> = {
  remember: { nl: "onthouden", en: "remember" },
  understand: { nl: "begrijpen", en: "understand" },
  apply: { nl: "toepassen", en: "apply" },
  analyze: { nl: "analyseren", en: "analyze" },
  evaluate: { nl: "evalueren", en: "evaluate" },
  create: { nl: "creëren", en: "create" },
};

/** 0 (remember) … 5 (create). */
export function bloomRank(level: BloomLevel): number {
  return BLOOM_LEVELS.indexOf(level);
}

export function bloomLabel(level: BloomLevel, locale: Locale): string {
  return LABELS[level][locale];
}
