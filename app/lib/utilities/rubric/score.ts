import { z } from "zod";
import { DEFAULT_SCALE, parseGradeScale, pointsToGrade } from "../grade";
import { maxPoints, RUBRIC_LIMITS, type RubricData, type RubricGrade } from "./schema";

/**
 * Filling in a rubric (P23.3). Pure: no AI, no network. A fill-in is a map criterion id → level
 * id; it lives in the browser with the student's name and comment until the batch is closed.
 * What the server may keep is a `RubricScore`: only criterion → level pairs, nothing else.
 */
export type LevelChoice = Readonly<Record<string, string>>;

export const DEFAULT_RUBRIC_GRADE: RubricGrade = {
  passPercent: DEFAULT_SCALE.passPercent,
  passGrade: DEFAULT_SCALE.passGrade,
  minGrade: DEFAULT_SCALE.minGrade,
  maxGrade: DEFAULT_SCALE.maxGrade,
  decimals: DEFAULT_SCALE.decimals,
};

export const rubricGradeSettings = (data: RubricData): RubricGrade =>
  data.grade ?? DEFAULT_RUBRIC_GRADE;

/** The grade for a total, or null when the rubric's maximum cannot be graded (0 or too large). */
export function rubricGrade(data: RubricData, total: number): number | null {
  const parsed = parseGradeScale({ maxPoints: maxPoints(data), ...rubricGradeSettings(data) });
  if (!parsed.ok) return null;
  return pointsToGrade(Math.min(Math.max(total, 0), parsed.scale.maxPoints), parsed.scale);
}

export interface RubricOutcome {
  total: number;
  max: number;
  /** Every criterion has a level. */
  complete: boolean;
  /** A knock-out criterion sits on its lowest level (and the pass rule counts knock-outs). */
  knockoutFailed: boolean;
  /** Null while incomplete or when the maximum cannot be graded. */
  grade: number | null;
  /** Null while incomplete. */
  passed: boolean | null;
}

export function scoreRubric(data: RubricData, choice: LevelChoice): RubricOutcome {
  let total = 0;
  let complete = true;
  let knockoutFailed = false;
  const countsKnockout = data.passRule !== "total";
  for (const c of data.criteria) {
    const level = c.levels.find((l) => l.id === choice[c.id]);
    if (!level) {
      complete = false;
      continue;
    }
    total += level.points * (c.weight ?? 1);
    const lowest = Math.min(...c.levels.map((l) => l.points));
    if (countsKnockout && c.knockout && level.points === lowest) knockoutFailed = true;
  }
  const max = maxPoints(data);
  if (!complete) return { total, max, complete, knockoutFailed, grade: null, passed: null };
  const grade = rubricGrade(data, total);
  const settings = rubricGradeSettings(data);
  const passedOnPoints =
    grade !== null ? grade >= settings.passGrade : total >= (max * settings.passPercent) / 100;
  return { total, max, complete, knockoutFailed, grade, passed: !knockoutFailed && passedOnPoints };
}

const Pair = z.object({ criterionId: z.uuid(), levelId: z.uuid() }).strict();

/** One closed fill-in as the server keeps it: no name, no code, no comment, no date. */
export const RubricScoreSchema = z.array(Pair).min(1).max(RUBRIC_LIMITS.criteria);
export type RubricScore = z.infer<typeof RubricScoreSchema>;

/** The most fill-ins one batch may close at once. */
const MAX_BATCH = 200;

export const RubricScoresSchema = z.array(RubricScoreSchema).min(1).max(MAX_BATCH);

/** A complete fill-in as criterion → level pairs (rubric order), or null when incomplete. */
export function toScore(data: RubricData, choice: LevelChoice): RubricScore | null {
  const pairs: RubricScore = [];
  for (const c of data.criteria) {
    const level = c.levels.find((l) => l.id === choice[c.id]);
    if (!level) return null;
    pairs.push({ criterionId: c.id, levelId: level.id });
  }
  return pairs;
}

/** True when a score names every criterion of this rubric exactly once, each with one of its levels. */
export function matchesRubric(data: RubricData, score: RubricScore): boolean {
  if (score.length !== data.criteria.length) return false;
  const seen = new Set<string>();
  for (const { criterionId, levelId } of score) {
    const c = data.criteria.find((x) => x.id === criterionId);
    if (!c || seen.has(criterionId) || !c.levels.some((l) => l.id === levelId)) return false;
    seen.add(criterionId);
  }
  return true;
}

/** Below this many closed fill-ins the overview stays hidden, so one student is not recognisable. */
export const MIN_SCORES_FOR_INSIGHT = 5;

export interface LevelDistribution {
  total: number;
  criteria: {
    id: string;
    title: string;
    levels: { id: string; label: string; count: number }[];
  }[];
}

/** How often each level was chosen, per criterion; null under MIN_SCORES_FOR_INSIGHT fill-ins. */
export function levelDistribution(
  data: RubricData,
  scores: readonly RubricScore[],
): LevelDistribution | null {
  if (scores.length < MIN_SCORES_FOR_INSIGHT) return null;
  const counts = new Map<string, number>();
  for (const score of scores)
    for (const { criterionId, levelId } of score) {
      const key = `${criterionId}:${levelId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  return {
    total: scores.length,
    criteria: data.criteria.map((c) => ({
      id: c.id,
      title: c.title,
      levels: c.levels.map((l) => ({
        id: l.id,
        label: l.label,
        count: counts.get(`${c.id}:${l.id}`) ?? 0,
      })),
    })),
  };
}
