import { z } from "zod";
import { BLOOM_LEVELS } from "./bloom";
import { ACTIVITY_KINDS, ASSESSMENT_KINDS, type CourseData } from "./types";

/** Boundary limits for a course (brief P20, "Het model"). */
export const COURSE_LIMITS = {
  id: 100,
  text: 1_000,
  title: 200,
  outcomes: 30,
  activities: 100,
  assessments: 30,
  week: 60,
} as const;

const Id = z.string().min(1).max(COURSE_LIMITS.id);
const Bloom = z.enum(BLOOM_LEVELS);
const Week = z.number().int().min(1).max(COURSE_LIMITS.week);

const OutcomeSchema = z.object({
  id: Id,
  text: z.string().min(1).max(COURSE_LIMITS.text),
  bloom: Bloom.optional(),
});

const ActivitySchema = z.object({
  id: Id,
  title: z.string().min(1).max(COURSE_LIMITS.title),
  week: Week.optional(),
  kind: z.enum(ACTIVITY_KINDS),
  outcomeIds: z.array(Id).max(COURSE_LIMITS.outcomes),
});

const AssessmentSchema = z.object({
  id: Id,
  title: z.string().min(1).max(COURSE_LIMITS.title),
  week: Week.optional(),
  kind: z.enum(ASSESSMENT_KINDS),
  weight: z.number().min(0).max(100).optional(),
  coverage: z
    .array(z.object({ outcomeId: Id, bloom: Bloom.optional() }))
    .max(COURSE_LIMITS.outcomes),
});

export const CourseDataSchema = z
  .object({
    outcomes: z.array(OutcomeSchema).max(COURSE_LIMITS.outcomes),
    activities: z.array(ActivitySchema).max(COURSE_LIMITS.activities),
    assessments: z.array(AssessmentSchema).max(COURSE_LIMITS.assessments),
  })
  .superRefine((d, ctx) => {
    // The stored graph is always consistent: unique ids, no dangling references.
    const seen = new Set<string>();
    for (const item of [...d.outcomes, ...d.activities, ...d.assessments]) {
      if (seen.has(item.id)) ctx.addIssue({ code: "custom", message: `Duplicate id: ${item.id}` });
      seen.add(item.id);
    }
    const outcomeIds = new Set(d.outcomes.map((o) => o.id));
    const refs = [
      ...d.activities.flatMap((a) => a.outcomeIds),
      ...d.assessments.flatMap((a) => a.coverage.map((c) => c.outcomeId)),
    ];
    for (const ref of refs)
      if (!outcomeIds.has(ref))
        ctx.addIssue({ code: "custom", message: `Unknown learning outcome: ${ref}` });
  }) satisfies z.ZodType<CourseData>;

export function emptyCourseData(): CourseData {
  return { outcomes: [], activities: [], assessments: [] };
}
