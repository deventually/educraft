import { z } from "zod";
import { IsoDateSchema } from "~/lib/calendar/weeks";
import { BLOOM_LEVELS } from "./bloom";
import {
  ACTIVITY_KINDS,
  ASSESSMENT_KINDS,
  ITEM_FORMATS,
  type CourseData,
  HOURS_PER_EC,
} from "./types";

/** Boundary limits for a course (brief P20, "Het model"). */
export const COURSE_LIMITS = {
  id: 100,
  text: 1_000,
  title: 200,
  outcomes: 30,
  activities: 100,
  assessments: 30,
  week: 60,
  ec: 60,
  items: 200,
  itemLabel: 20,
  points: 1_000,
} as const;

const Id = z.string().min(1).max(COURSE_LIMITS.id);
const Bloom = z.enum(BLOOM_LEVELS);
const Week = z.number().int().min(1).max(COURSE_LIMITS.week);
const Hours = z
  .number()
  .min(0)
  .max(COURSE_LIMITS.ec * HOURS_PER_EC);

/** Shape only: which keys and options are allowed comes from the pack (`packTags.ts`). */
const PackTagsSchema = z
  .record(
    z.string().min(1).max(60),
    z.union([
      z.string().min(1).max(200),
      z.array(z.string().min(1).max(200)).max(30),
      z.number().int().min(0).max(10),
    ]),
  )
  .refine((tags) => Object.keys(tags).length <= 20);

const OutcomeSchema = z.object({
  id: Id,
  text: z.string().min(1).max(COURSE_LIMITS.text),
  bloom: Bloom.optional(),
  packTags: PackTagsSchema.optional(),
});

const ActivitySchema = z.object({
  id: Id,
  title: z.string().min(1).max(COURSE_LIMITS.title),
  week: Week.optional(),
  kind: z.enum(ACTIVITY_KINDS),
  outcomeIds: z.array(Id).max(COURSE_LIMITS.outcomes),
  hours: Hours.optional(),
});

const ItemSchema = z.object({
  id: Id,
  label: z.string().min(1).max(COURSE_LIMITS.itemLabel),
  outcomeId: Id,
  bloom: Bloom.optional(),
  format: z.enum(ITEM_FORMATS).optional(),
  points: z.number().min(0).max(COURSE_LIMITS.points).optional(),
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
  hours: Hours.optional(),
  items: z.array(ItemSchema).max(COURSE_LIMITS.items).optional(),
});

export const CourseDataSchema = z
  .object({
    ec: z.number().positive().max(COURSE_LIMITS.ec).optional(),
    startDate: IsoDateSchema.optional(),
    outcomes: z.array(OutcomeSchema).max(COURSE_LIMITS.outcomes),
    activities: z.array(ActivitySchema).max(COURSE_LIMITS.activities),
    assessments: z.array(AssessmentSchema).max(COURSE_LIMITS.assessments),
  })
  .superRefine((d, ctx) => {
    // The stored graph is always consistent: unique ids, no dangling references.
    const seen = new Set<string>();
    const questions = d.assessments.flatMap((a) => a.items ?? []);
    for (const item of [...d.outcomes, ...d.activities, ...d.assessments, ...questions]) {
      if (seen.has(item.id)) ctx.addIssue({ code: "custom", message: `Duplicate id: ${item.id}` });
      seen.add(item.id);
    }
    const outcomeIds = new Set(d.outcomes.map((o) => o.id));
    const refs = [
      ...d.activities.flatMap((a) => a.outcomeIds),
      ...d.assessments.flatMap((a) => a.coverage.map((c) => c.outcomeId)),
      ...questions.map((q) => q.outcomeId),
    ];
    for (const ref of refs)
      if (!outcomeIds.has(ref))
        ctx.addIssue({ code: "custom", message: `Unknown learning outcome: ${ref}` });
  }) satisfies z.ZodType<CourseData>;

export function emptyCourseData(): CourseData {
  return { outcomes: [], activities: [], assessments: [] };
}
