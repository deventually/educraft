import type { RubricCriterion, RubricData } from "./schema";
import { type LevelChoice, scoreRubric } from "./score";

/**
 * Calibrating with a second rater (P34.1). Pure: no AI, no network, nothing stored. Two raters
 * score the same works with one rubric; this sets their levels side by side. It reports facts
 * (agreement, distance, kappa, grades), never who is right.
 */
export interface RaterWork {
  /** Free code for the work, e.g. "A1"; paired trimmed and case-insensitive. */
  code: string;
  choice: LevelChoice;
}

export interface CriterionAgreement {
  id: string;
  title: string;
  /** Works where both raters chose a level of this criterion. */
  works: number;
  exact: number;
  /** Null without works. */
  exactPercent: number | null;
  /** One ordered level apart. */
  oneOff: number;
  twoOrMore: number;
  /** Mean distance in ordered levels; 0 without works. */
  meanDistance: number;
  /** Linear weighted Cohen's kappa; null under MIN_WORKS_FOR_KAPPA works. */
  kappa: number | null;
}

export interface WorkComparison {
  code: string;
  /** Null when that rater's fill-in is incomplete or cannot be graded. */
  gradeA: number | null;
  gradeB: number | null;
  /** gradeB − gradeA, or null when either is missing. */
  difference: number | null;
}

export type AgendaLine =
  | { kind: "criterion"; id: string; title: string; exact: number; works: number }
  | { kind: "work"; code: string; difference: number };

export interface Calibration {
  criteria: CriterionAgreement[];
  works: WorkComparison[];
  /** Codes only rater A (or B) has; they do not count. */
  onlyA: string[];
  onlyB: string[];
  /** Codes that appear more than once in one list; only the first counts. */
  duplicates: string[];
  /** What to talk about: criteria with the biggest difference, then works; at most AGENDA_MAX. */
  agenda: AgendaLine[];
}

/** Below this many paired works kappa says too little to show. */
export const MIN_WORKS_FOR_KAPPA = 5;
const AGENDA_MAX = 10;

const key = (code: string) => code.trim().toUpperCase();

function index(list: readonly RaterWork[], duplicates: Set<string>): Map<string, RaterWork> {
  const map = new Map<string, RaterWork>();
  for (const w of list) {
    const k = key(w.code);
    if (!k) continue;
    if (map.has(k)) duplicates.add(w.code.trim());
    else map.set(k, { ...w, code: w.code.trim() });
  }
  return map;
}

/** Level id → rank 0..k−1 by points (ties keep rubric order). */
function ranks(c: RubricCriterion): Map<string, number> {
  const sorted = c.levels
    .map((l, i) => ({ l, i }))
    .sort((x, y) => x.l.points - y.l.points || x.i - y.i);
  return new Map(sorted.map(({ l }, r) => [l.id, r]));
}

/** Linear weighted kappa over rank pairs with k categories. */
function weightedKappa(pairs: readonly [number, number][], k: number): number | null {
  const n = pairs.length;
  if (n < MIN_WORKS_FOR_KAPPA || k < 2) return null;
  const w = (i: number, j: number) => 1 - Math.abs(i - j) / (k - 1);
  const share = (side: 0 | 1) =>
    Array.from({ length: k }, (_, r) => pairs.filter((p) => p[side] === r).length / n);
  const a = share(0);
  const b = share(1);
  const po = pairs.reduce((s, [i, j]) => s + w(i, j), 0) / n;
  let pe = 0;
  a.forEach((ai, i) => {
    b.forEach((bj, j) => {
      pe += w(i, j) * ai * bj;
    });
  });
  if (1 - pe < 1e-12) return 1; // both raters used one and the same level throughout
  return (po - pe) / (1 - pe);
}

function agreement(
  c: RubricCriterion,
  paired: readonly [RaterWork, RaterWork][],
): CriterionAgreement {
  const rank = ranks(c);
  const pairs: [number, number][] = [];
  for (const [a, b] of paired) {
    const ra = rank.get(a.choice[c.id] ?? "");
    const rb = rank.get(b.choice[c.id] ?? "");
    if (ra !== undefined && rb !== undefined) pairs.push([ra, rb]);
  }
  const distances = pairs.map(([i, j]) => Math.abs(i - j));
  const works = pairs.length;
  const exact = distances.filter((d) => d === 0).length;
  return {
    id: c.id,
    title: c.title,
    works,
    exact,
    exactPercent: works ? Math.round((exact / works) * 100) : null,
    oneOff: distances.filter((d) => d === 1).length,
    twoOrMore: distances.filter((d) => d >= 2).length,
    meanDistance: works ? distances.reduce((s, d) => s + d, 0) / works : 0,
    kappa: weightedKappa(pairs, c.levels.length),
  };
}

export function calibrate(
  data: RubricData,
  listA: readonly RaterWork[],
  listB: readonly RaterWork[],
): Calibration {
  const dup = new Set<string>();
  const a = index(listA, dup);
  const b = index(listB, dup);
  const paired: [RaterWork, RaterWork][] = [];
  for (const [k, wa] of a) {
    const wb = b.get(k);
    if (wb) paired.push([wa, wb]);
  }
  const criteria = data.criteria.map((c) => agreement(c, paired));
  const works = paired.map(([wa, wb]): WorkComparison => {
    const gradeA = scoreRubric(data, wa.choice).grade;
    const gradeB = scoreRubric(data, wb.choice).grade;
    const difference = gradeA !== null && gradeB !== null ? gradeB - gradeA : null;
    return { code: wa.code, gradeA, gradeB, difference };
  });
  const agenda: AgendaLine[] = [
    ...criteria
      .filter((c) => c.meanDistance > 0)
      .sort((x, y) => y.meanDistance - x.meanDistance)
      .map(
        (c): AgendaLine => ({
          kind: "criterion",
          id: c.id,
          title: c.title,
          exact: c.exact,
          works: c.works,
        }),
      ),
    ...works
      .filter((w): w is WorkComparison & { difference: number } => !!w.difference)
      .sort((x, y) => Math.abs(y.difference) - Math.abs(x.difference))
      .map((w): AgendaLine => ({ kind: "work", code: w.code, difference: w.difference })),
  ].slice(0, AGENDA_MAX);
  return {
    criteria,
    works,
    onlyA: [...a].filter(([k]) => !b.has(k)).map(([, w]) => w.code),
    onlyB: [...b].filter(([k]) => !a.has(k)).map(([, w]) => w.code),
    duplicates: [...dup],
    agenda,
  };
}
