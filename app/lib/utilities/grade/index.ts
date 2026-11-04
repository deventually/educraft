import { z } from "zod";

/**
 * Points → grade (P23.1). Pure functions, no AI, no network. There is no national rule for the
 * pass mark in Dutch higher education (each programme's OER decides), so every choice is a
 * setting; the defaults are only a starting point.
 */
export interface GradeScale {
  /** Maximum score, > 0. */
  maxPoints: number;
  /** Share of the (guess-corrected) score needed to pass, 0 < p < 100. */
  passPercent: number;
  passGrade: number;
  minGrade: number;
  maxGrade: number;
  decimals: 0 | 1 | 2;
  /**
   * Multiple-choice guessing correction. The expected score from pure guessing is
   * maxPoints / options (with equal points per question), and it earns the minimum grade.
   */
  guessing?: { options: number };
}

export const DEFAULT_SCALE: Omit<GradeScale, "maxPoints"> = {
  passPercent: 55,
  passGrade: 5.5,
  minGrade: 1,
  maxGrade: 10,
  decimals: 1,
};

/** Highest maxPoints we tabulate (keeps the table finite and readable). */
export const MAX_POINTS_LIMIT = 1000;

export type GradeScaleError = "maxPoints" | "passPercent" | "gradeOrder" | "options" | "decimals";

const finite = z.number().finite();

const GradeScaleSchema = z
  .object({
    maxPoints: finite.positive().max(MAX_POINTS_LIMIT),
    passPercent: finite.gt(0).lt(100),
    passGrade: finite,
    minGrade: finite,
    maxGrade: finite,
    decimals: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    guessing: z
      .object({ options: z.number().int().min(2).max(10) })
      .strict()
      .optional(),
  })
  .strict()
  .refine((s) => s.minGrade < s.passGrade && s.passGrade < s.maxGrade, { path: ["gradeOrder"] });

/** Validate a scale at the UI boundary; the error names the field so the UI can translate it. */
export function parseGradeScale(
  input: unknown,
): { ok: true; scale: GradeScale } | { ok: false; error: GradeScaleError } {
  const result = GradeScaleSchema.safeParse(input);
  if (result.success) return { ok: true, scale: result.data };
  const first = result.error.issues[0]?.path[0];
  const error: GradeScaleError =
    first === "guessing"
      ? "options"
      : first === "maxPoints" || first === "passPercent" || first === "decimals"
        ? first
        : "gradeOrder";
  return { ok: false, error };
}

function assertScale(scale: GradeScale): void {
  const result = parseGradeScale(scale);
  if (!result.ok) throw new RangeError(`Invalid grade scale: ${result.error}`);
}

/** Expected score from pure guessing (0 without a guessing correction). */
export function guessScore(scale: GradeScale): number {
  return scale.guessing ? scale.maxPoints / scale.guessing.options : 0;
}

/** Points at the pass mark. */
export function cutScore(scale: GradeScale): number {
  const guess = guessScore(scale);
  return guess + ((scale.maxPoints - guess) * scale.passPercent) / 100;
}

/** Round half up at `decimals`, robust to binary floating point (1.05 → 1.1). */
function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(Number((value * f).toPrecision(12))) / f;
}

export function pointsToGrade(points: number, scale: GradeScale): number {
  assertScale(scale);
  if (!Number.isFinite(points) || points < 0 || points > scale.maxPoints) {
    throw new RangeError(`Points out of range: ${points}`);
  }
  const guess = guessScore(scale);
  const cut = cutScore(scale);
  let grade: number;
  if (points <= guess) grade = scale.minGrade;
  else if (points <= cut)
    grade =
      scale.minGrade + ((points - guess) / (cut - guess)) * (scale.passGrade - scale.minGrade);
  else
    grade =
      scale.passGrade +
      ((points - cut) / (scale.maxPoints - cut)) * (scale.maxGrade - scale.passGrade);
  const rounded = round(grade, scale.decimals);
  return Math.min(scale.maxGrade, Math.max(scale.minGrade, rounded));
}

/** Every whole point from 0 to maxPoints, plus maxPoints itself when it is not whole. */
export function gradeTable(scale: GradeScale): { points: number; grade: number }[] {
  assertScale(scale);
  const points = Array.from({ length: Math.floor(scale.maxPoints) + 1 }, (_, i) => i);
  if (!Number.isInteger(scale.maxPoints)) points.push(scale.maxPoints);
  return points.map((p) => ({ points: p, grade: pointsToGrade(p, scale) }));
}
