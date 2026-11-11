/**
 * The total row of a question-level matrix (brief P26, 26.1). Pure. Each
 * outcome's share is of the points when any question has points, else of the
 * number of questions; shares are rounded whole percentages.
 */
import { BLOOM_LEVELS, type BloomLevel } from "./bloom";
import type { Assessment, AssessmentItem } from "./types";

export interface ItemTotals {
  count: number;
  points: number;
  byOutcome: { outcomeId: string; count: number; points: number; share: number }[];
}

export function itemTotals(a: Assessment): ItemTotals {
  const items = a.items ?? [];
  const points = items.reduce((s, i) => s + (i.points ?? 0), 0);
  const order = [...new Set(items.map((i) => i.outcomeId))];
  const byOutcome = order.map((outcomeId) => {
    const own = items.filter((i) => i.outcomeId === outcomeId);
    const ownPoints = own.reduce((s, i) => s + (i.points ?? 0), 0);
    const share = points > 0 ? ownPoints / points : own.length / items.length;
    return { outcomeId, count: own.length, points: ownPoints, share: Math.round(share * 100) };
  });
  return { count: items.length, points, byOutcome };
}

/**
 * The two-way blueprint of one test: learning outcomes in the rows, cognitive levels in the
 * columns (only the levels used, in Bloom order, then `null` for questions without a level).
 * Each cell is points when any question has points, else the number of questions. Pure.
 */
export interface BloomGrid {
  levels: (BloomLevel | null)[];
  byPoints: boolean;
  rows: { outcomeId: string; cells: number[]; total: number }[];
  totals: { cells: number[]; total: number };
}

export function bloomGrid(a: Assessment): BloomGrid {
  const items = a.items ?? [];
  const byPoints = items.some((i) => (i.points ?? 0) > 0);
  const used = new Set(items.map((i) => i.bloom ?? null));
  const levels = [...BLOOM_LEVELS.filter((l) => used.has(l)), ...(used.has(null) ? [null] : [])];
  const weight = (i: AssessmentItem) => (byPoints ? (i.points ?? 0) : 1);
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const rows = [...new Set(items.map((i) => i.outcomeId))].map((outcomeId) => {
    const cells = levels.map((level) =>
      sum(
        items.filter((i) => i.outcomeId === outcomeId && (i.bloom ?? null) === level).map(weight),
      ),
    );
    return { outcomeId, cells, total: sum(cells) };
  });
  const cells = levels.map((_, c) => sum(rows.map((r) => r.cells[c] ?? 0)));
  return { levels, byPoints, rows, totals: { cells, total: sum(cells) } };
}
