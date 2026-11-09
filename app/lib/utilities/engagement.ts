/**
 * The leercheck's arithmetic (brief P31.3). The book's Appendix G rubric ("Complete
 * Cognitive Engagement Rubric Definitions", Van Schaack & Sarlo, pp. 355–356) rates an
 * activity on six principles, each Absent (0), Low (1), Medium (2) or High (3). The AI picks
 * the levels; the total out of 18 and the percentage are computed here, never by the AI.
 *
 * Pure: reads the result's markdown table and nothing else.
 */
import type { OutputLanguage } from "~/lib/registry/types";

export type EngagementPrincipleId =
  | "retrieval"
  | "spacing"
  | "interleaving"
  | "dual-coding"
  | "concrete-examples"
  | "elaboration";

export interface EngagementPrinciple {
  id: EngagementPrincipleId;
  /** The book's name. */
  book: string;
  /** The name the Dutch output uses. */
  nl: string;
}

/** The six principles of Appendix G, in the book's order. */
export const ENGAGEMENT_PRINCIPLES: readonly EngagementPrinciple[] = [
  { id: "retrieval", book: "Retrieval Practice", nl: "Ophalen uit het geheugen" },
  { id: "spacing", book: "Spaced Practice", nl: "Gespreid oefenen" },
  { id: "interleaving", book: "Interleaving", nl: "Afwisselen" },
  { id: "dual-coding", book: "Dual Coding", nl: "Woord en beeld" },
  { id: "concrete-examples", book: "Concrete Examples", nl: "Concrete voorbeelden" },
  { id: "elaboration", book: "Elaboration", nl: "Uitleggen en verbinden" },
];

export const ENGAGEMENT_MAX_LEVEL = 3;

export type EngagementLevels = Record<EngagementPrincipleId, number>;

function principleIn(cell: string): EngagementPrincipleId | null {
  const c = cell.toLowerCase();
  const hits = ENGAGEMENT_PRINCIPLES.filter(
    (p) => c.includes(p.book.toLowerCase()) || c.includes(p.nl.toLowerCase()),
  );
  const [only, ...more] = hits;
  return only && more.length === 0 ? only.id : null;
}

/**
 * One level per principle from the table rows of the result, or null when any principle
 * is missing, appears twice with different levels, or has a level outside 0–3. Null means
 * "don't guess": the note then says so.
 */
export function parseEngagementLevels(markdown: string): EngagementLevels | null {
  const found = new Map<EngagementPrincipleId, number>();
  for (const line of markdown.split("\n")) {
    const row = line.trim();
    if (!row.startsWith("|")) continue;
    const cells = row
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
    const [name, score] = cells;
    if (name === undefined || score === undefined) continue;
    const id = principleIn(name);
    if (!id) continue;
    const m = score.match(/\((\d+)\)/);
    if (!m) return null;
    const level = Number(m[1]);
    if (level > ENGAGEMENT_MAX_LEVEL) return null;
    const before = found.get(id);
    if (before !== undefined && before !== level) return null;
    found.set(id, level);
  }
  if (found.size !== ENGAGEMENT_PRINCIPLES.length) return null;
  return Object.fromEntries(found) as EngagementLevels;
}

export interface EngagementIndex {
  total: number;
  max: number;
  percent: number;
}

/** The sum of the six levels, out of 18, and the rounded percentage (the book's CEI). */
export function engagementIndex(levels: EngagementLevels): EngagementIndex {
  const total = ENGAGEMENT_PRINCIPLES.reduce((sum, p) => sum + levels[p.id], 0);
  const max = ENGAGEMENT_PRINCIPLES.length * ENGAGEMENT_MAX_LEVEL;
  return { total, max, percent: Math.round((total / max) * 100) };
}

const SCORE: Record<OutputLanguage, string> = {
  nl: "Leerscore: {total} van {max} punten ({percent}%).",
  en: "Engagement score: {total} of {max} points ({percent}%).",
};
const UNREADABLE: Record<OutputLanguage, string> = {
  nl: "LimeOnIt kon niet alle zes de niveaus uit de tabel lezen, dus er staat geen score. Tel de niveaus zelf op (hoogstens 18).",
  en: "LimeOnIt found not all six levels in the table, so there is no score. Add up the levels yourself (at most 18).",
};

/** The one-line note under the result, in the output language. */
export function engagementSummary(markdown: string, lang: OutputLanguage): string {
  const levels = parseEngagementLevels(markdown);
  if (!levels) return UNREADABLE[lang];
  const { total, max, percent } = engagementIndex(levels);
  return SCORE[lang]
    .replace("{total}", String(total))
    .replace("{max}", String(max))
    .replace("{percent}", String(percent));
}
