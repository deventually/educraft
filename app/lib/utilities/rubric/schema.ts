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

export interface RubricData {
  criteria: RubricCriterion[];
  passRule?: "total" | "no-fail-on-knockout";
}

const points = z.number().finite().min(0).max(RUBRIC_LIMITS.points);

export const RubricLevelSchema = z
  .object({
    id: z.uuid(),
    label: z.string().max(RUBRIC_LIMITS.title),
    points,
    description: z.string().max(RUBRIC_LIMITS.text),
  })
  .strict();

export const RubricCriterionSchema = z
  .object({
    id: z.uuid(),
    title: z.string().max(RUBRIC_LIMITS.title),
    weight: z.number().finite().min(0).max(RUBRIC_LIMITS.weight).optional(),
    levels: z.array(RubricLevelSchema).min(RUBRIC_LIMITS.minLevels).max(RUBRIC_LIMITS.maxLevels),
    knockout: z.boolean().optional(),
  })
  .strict();

/** The boundary for every rubric write: limits, UUID ids, unique ids, no unknown keys. */
export const RubricDataSchema = z
  .object({
    criteria: z.array(RubricCriterionSchema).min(1).max(RUBRIC_LIMITS.criteria),
    passRule: z.enum(["total", "no-fail-on-knockout"]).optional(),
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
