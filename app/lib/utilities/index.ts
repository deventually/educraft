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
  /**
   * Slug of an AI tool that explains this utility's result ("Laat uitleggen", P24.5). The
   * utility computes; the tool only explains the numbers it is handed.
   */
  explainWith?: string;
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
  {
    id: "rubric",
    slug: "rubric",
    name: { nl: "Rubrics maken en bewaren", en: "Make and keep rubrics" },
    summary: {
      nl: "Zet criteria en niveaus in een rubric, vul hem per student in en reken om naar een cijfer. Namen blijven in je browser. Zonder AI.",
      en: "Put criteria and levels in a rubric, fill it in per student and turn it into a grade. Names stay in your browser. No AI.",
    },
    icon: "table",
    keywords: [
      "rubric",
      "beoordelingsmodel",
      "beoordelingsformulier",
      "criteria",
      "assessment form",
      "invullen",
      "nakijken",
      "fill in",
    ],
  },
  {
    id: "item-analysis",
    slug: "item-analysis",
    name: { nl: "Toetsuitslag per vraag analyseren", en: "Analyse test results per question" },
    summary: {
      nl: "Plak de scores na een toets en zie per vraag de p-waarde, Rit en Rir, en Cronbachs alfa. Namen gaan er vooraf uit. Zonder AI; een AI-uitleg kan erbij.",
      en: "Paste the scores after a test and see the p-value, Rit and Rir per question, and Cronbach's alpha. Names are removed first. No AI; an AI explanation is optional.",
    },
    icon: "chart-column",
    keywords: [
      "toetsanalyse",
      "itemanalyse",
      "p-waarde",
      "rit",
      "rir",
      "cronbach",
      "alfa",
      "betrouwbaarheid",
      "item analysis",
      "reliability",
      "test analysis",
    ],
    explainWith: "test-analysis",
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
