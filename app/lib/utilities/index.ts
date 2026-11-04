import type { LocalizedText } from "~/lib/i18n/localized";

/**
 * A utility is a teacher tool without AI (P23): it only calculates or organizes. It is not a
 * registry `Tool` (no prompt, no model, no stream), so the AI engine stays untouched. The list is
 * data; each utility's page is an ordinary component picked by slug in `UtilityView`.
 */
export interface Utility {
  /** Stable English slug, e.g. "grade-calculator". */
  id: string;
  /** URL segment under /utilities (English, BESLUIT-2026-06-1). */
  slug: string;
  /** Task first (BESLUIT-2026-11-03-18). */
  name: LocalizedText;
  summary: LocalizedText;
  /** lucide icon name, resolved by ToolIcon. */
  icon: string;
  /** Extra search words for the /tools search box (both languages). */
  keywords: readonly string[];
}

export const UTILITIES: readonly Utility[] = [
  {
    id: "grade-calculator",
    slug: "grade-calculator",
    name: { nl: "Punten omrekenen naar een cijfer", en: "Convert points to a grade" },
    summary: {
      nl: "Bereken de cesuur en een cijfertabel, met of zonder raadkanscorrectie. Zonder AI.",
      en: "Work out the pass mark and a grade table, with or without a guessing correction. No AI.",
    },
    icon: "calculator",
    keywords: [
      "cesuur",
      "normering",
      "cijfer",
      "raadkans",
      "pass mark",
      "grade",
      "grading",
      "guessing",
    ],
  },
];

export function getUtilityBySlug(slug: string): Utility | undefined {
  return UTILITIES.find((u) => u.slug === slug);
}

/** Lower-cased haystack for search: name, summary and keywords in both languages. */
export function utilitySearchText(u: Utility): string {
  const text = (v: LocalizedText) => (typeof v === "string" ? v : `${v.nl} ${v.en}`);
  return [text(u.name), text(u.summary), ...u.keywords].join(" ").toLowerCase();
}
