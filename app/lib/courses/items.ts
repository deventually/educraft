/**
 * The total row of a question-level matrix (brief P26, 26.1). Pure. Each
 * outcome's share is of the points when any question has points, else of the
 * number of questions; shares are rounded whole percentages.
 */
import type { Assessment } from "./types";

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
