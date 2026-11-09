import { z } from "zod";

/** Boundary limits for a rubric (brief P23.2). */
export const RUBRIC_LIMITS = {
  name: 200,
  criteria: 30,
  minLevels: 2,
  maxLevels: 6,
  title: 200,
  text: 1_000,
  points: 100,
  weight: 100,
} as const;

export interface RubricLevel {
  id: string;
  label: string;
  points: number;
  description: string;
}

export interface RubricCriterion {
  id: string;
  title: string;
  /** Multiplier for this criterion's points; absent = 1. */
  weight?: number;
  levels: RubricLevel[];
  /** The lowest level means "fail, whatever the total" (used when filling in, P23.3). */
  knockout?: boolean;
}

/** How a rubric total becomes a grade (P23.3); maxPoints comes from the rubric itself. */
export interface RubricGrade {
  passPercent: number;
  passGrade: number;
  minGrade: number;
  maxGrade: number;
  decimals: 0 | 1 | 2;
}

export interface RubricData {
  criteria: RubricCriterion[];
  passRule?: "total" | "no-fail-on-knockout";
  /** Absent = the grade calculator's defaults (DEFAULT_RUBRIC_GRADE). */
  grade?: RubricGrade;
}

const points = z.number().finite().min(0).max(RUBRIC_LIMITS.points);

const RubricLevelSchema = z
  .object({
    id: z.uuid(),
    label: z.string().max(RUBRIC_LIMITS.title),
    points,
    description: z.string().max(RUBRIC_LIMITS.text),
  })
  .strict();

const RubricCriterionSchema = z
  .object({
    id: z.uuid(),
    title: z.string().max(RUBRIC_LIMITS.title),
    weight: z.number().finite().min(0).max(RUBRIC_LIMITS.weight).optional(),
    levels: z.array(RubricLevelSchema).min(RUBRIC_LIMITS.minLevels).max(RUBRIC_LIMITS.maxLevels),
    knockout: z.boolean().optional(),
  })
  .strict();

const RubricGradeSchema = z
  .object({
    passPercent: z.number().finite().gt(0).lt(100),
    passGrade: z.number().finite().min(0).max(100),
    minGrade: z.number().finite().min(0).max(100),
    maxGrade: z.number().finite().min(0).max(100),
    decimals: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  })
  .strict()
  .refine((g) => g.minGrade < g.passGrade && g.passGrade < g.maxGrade, {
    message: "Grade order",
  });

/** The boundary for every rubric write: limits, UUID ids, unique ids, no unknown keys. */
export const RubricDataSchema = z
  .object({
    criteria: z.array(RubricCriterionSchema).min(1).max(RUBRIC_LIMITS.criteria),
    passRule: z.enum(["total", "no-fail-on-knockout"]).optional(),
    grade: RubricGradeSchema.optional(),
  })
  .strict()
  .refine(
    (d) => {
      const ids = d.criteria.flatMap((c) => [c.id, ...c.levels.map((l) => l.id)]);
      return new Set(ids).size === ids.length;
    },
    { message: "Duplicate id" },
  );

/** The highest possible score: per criterion its best level × weight. Feeds the grade calculator. */
export function maxPoints(data: RubricData): number {
  return data.criteria.reduce(
    (sum, c) => sum + Math.max(...c.levels.map((l) => l.points)) * (c.weight ?? 1),
    0,
  );
}
