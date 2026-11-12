import type { Locale } from "~/lib/i18n";
import type { RubricData } from "./schema";
import { MIN_SCORES_FOR_INSIGHT, type RubricScore } from "./score";

/**
 * The group in numbers (brief P36.1): per round (a month of closed fill-ins) and per criterion,
 * how often each level was chosen and how many works sat on the lowest level. Counted here, in
 * code, so a prompt (P36.2) only receives the numbers and never has to count. No AI, no names.
 * Hidden under MIN_SCORES_FOR_INSIGHT, as P23.3 asks.
 */
export interface GroupSummary {
  month: string;
  total: number;
  criteria: {
    id: string;
    title: string;
    /** Fill-ins in this round that scored this criterion (one added later has fewer). */
    scored: number;
    /** Works on the criterion's lowest-scoring level. */
    lowest: number;
    lowestPercent: number;
    levels: { id: string; label: string; count: number }[];
  }[];
}

interface RoundScore {
  month: string;
  levels: RubricScore;
}

/** Each round with its number of fill-ins, newest first. */
export function rubricRounds(scores: readonly RoundScore[]): { month: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of scores) counts.set(s.month, (counts.get(s.month) ?? 0) + 1);
  return [...counts]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

export function groupSummary(
  data: RubricData,
  scores: readonly RoundScore[],
  month: string,
): GroupSummary | null {
  const round = scores.filter((s) => s.month === month);
  if (round.length < MIN_SCORES_FOR_INSIGHT) return null;
  const counts = new Map<string, number>();
  for (const s of round)
    for (const { criterionId, levelId } of s.levels) {
      const key = `${criterionId}:${levelId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  const criteria = data.criteria.map((c, order) => {
    const levels = c.levels.map((l) => ({
      id: l.id,
      label: l.label,
      count: counts.get(`${c.id}:${l.id}`) ?? 0,
    }));
    const minPoints = Math.min(...c.levels.map((l) => l.points));
    const lowest = c.levels
      .filter((l) => l.points === minPoints)
      .reduce((n, l) => n + (counts.get(`${c.id}:${l.id}`) ?? 0), 0);
    const scored = levels.reduce((n, l) => n + l.count, 0);
    const lowestPercent = scored === 0 ? 0 : Math.round((lowest / scored) * 100);
    return { id: c.id, title: c.title, scored, lowest, lowestPercent, levels, order };
  });
  criteria.sort((a, b) => b.lowestPercent - a.lowestPercent || a.order - b.order);
  return {
    month,
    total: round.length,
    criteria: criteria.map(({ order: _order, ...c }) => c),
  };
}

const WORDS = {
  nl: {
    head: (month: string, n: number) => `Ronde ${month}, ${n} werken, beoordeeld met de rubric.`,
    line: (title: string, low: number, of: number, pct: number) =>
      `${title}: ${low} van ${of} op het laagste niveau (${pct}%)`,
    levels: "Niveaus",
  },
  en: {
    head: (month: string, n: number) =>
      `Round ${month}, ${n} pieces of work, assessed with the rubric.`,
    line: (title: string, low: number, of: number, pct: number) =>
      `${title}: ${low} of ${of} on the lowest level (${pct}%)`,
    levels: "Levels",
  },
} as const;

/** The summary as plain text for a prompt: worst criterion first, every number from code. */
export function groupSummaryText(summary: GroupSummary, locale: Locale): string {
  const w = WORDS[locale];
  const lines = summary.criteria.map(
    (c) =>
      `- ${w.line(c.title, c.lowest, c.scored, c.lowestPercent)}. ${w.levels}: ${c.levels
        .map((l) => `${l.label} ${l.count}`)
        .join(", ")}.`,
  );
  return [w.head(summary.month, summary.total), ...lines].join("\n");
}
