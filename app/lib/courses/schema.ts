import { z } from "zod";
import { IsoDateSchema } from "~/lib/calendar/weeks";
import { BLOOM_LEVELS } from "./bloom";
import {
  ACTIVITY_KINDS,
  ASSESSMENT_KINDS,
  DELIVERY_MODES,
  ITEM_FORMATS,
  GRADINGS,
  type CourseData,
  HOURS_PER_EC,
} from "./types";

/** Boundary limits for a course (brief P20, "Het model"). */
export const COURSE_LIMITS = {
  id: 100,
  text: 1_000,
  title: 200,
  /** A lesson goal: one sentence. */
  goal: 300,
  outcomes: 30,
  activities: 100,
  assessments: 30,
  week: 60,
  ec: 60,
  items: 200,
  itemLabel: 20,
  points: 1_000,
  code: 40,
  criteria: 20,
  criterionCode: 20,
  parts: 30,
  conditions: 20,
  longText: 3_000,
  sessionsPerWeek: 20,
  sessionMinutes: { min: 15, max: 600 },
  groupSize: 1_000,
  disciplines: 12,
  hoursPerWeek: 60,
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
  criteria: z
    .array(
      z.object({
        code: z.string().min(1).max(COURSE_LIMITS.criterionCode).optional(),
        text: z.string().min(1).max(COURSE_LIMITS.text),
      }),
    )
    .max(COURSE_LIMITS.criteria)
    .optional(),
});

const ActivitySchema = z.object({
  id: Id,
  title: z.string().min(1).max(COURSE_LIMITS.title),
  week: Week.optional(),
  kind: z.enum(ACTIVITY_KINDS),
  goal: z.string().min(1).max(COURSE_LIMITS.goal).optional(),
  outcomeIds: z.array(Id).max(COURSE_LIMITS.outcomes),
  hours: Hours.optional(),
  disciplineId: Id.optional(),
});

const DisciplineSchema = z.object({
  id: Id,
  name: z.string().min(1).max(COURSE_LIMITS.title),
  teacher: z.string().min(1).max(COURSE_LIMITS.title).optional(),
  hoursPerWeek: z.number().positive().max(COURSE_LIMITS.hoursPerWeek).optional(),
});

const ItemSchema = z.object({
  id: Id,
  label: z.string().min(1).max(COURSE_LIMITS.itemLabel),
  outcomeId: Id,
  bloom: Bloom.optional(),
  format: z.enum(ITEM_FORMATS).optional(),
  points: z.number().min(0).max(COURSE_LIMITS.points).optional(),
});

const PartSchema = z.object({
  id: Id,
  title: z.string().min(1).max(COURSE_LIMITS.title),
  outcomeIds: z.array(Id).max(COURSE_LIMITS.outcomes),
  weight: z.number().min(0).max(100).optional(),
  knockOut: z.boolean().optional(),
  pass: z.string().min(1).max(COURSE_LIMITS.longText).optional(),
  fail: z.string().min(1).max(COURSE_LIMITS.longText).optional(),
});

const ShortText = z.string().min(1).max(COURSE_LIMITS.title);
const LongText = z.string().min(1).max(COURSE_LIMITS.longText);

const AssessmentSchema = z.object({
  id: Id,
  title: z.string().min(1).max(COURSE_LIMITS.title),
  week: Week.optional(),
  kind: z.enum(ASSESSMENT_KINDS),
  weight: z.number().min(0).max(100).optional(),
  supervised: z.boolean().optional(),
  coverage: z
    .array(z.object({ outcomeId: Id, bloom: Bloom.optional() }))
    .max(COURSE_LIMITS.outcomes),
  hours: Hours.optional(),
  items: z.array(ItemSchema).max(COURSE_LIMITS.items).optional(),
  form: ShortText.optional(),
  owner: ShortText.optional(),
  grading: z.enum(GRADINGS).optional(),
  passMark: z.number().min(0).max(100).optional(),
  conditions: z
    .array(z.string().min(1).max(COURSE_LIMITS.text))
    .max(COURSE_LIMITS.conditions)
    .optional(),
  resit: LongText.optional(),
  conduct: LongText.optional(),
  parts: z.array(PartSchema).max(COURSE_LIMITS.parts).optional(),
});

const ScheduleSchema = z.object({
  weeks: z.number().int().min(1).max(COURSE_LIMITS.week).optional(),
  sessionsPerWeek: z.number().int().min(1).max(COURSE_LIMITS.sessionsPerWeek).optional(),
  sessionMinutes: z
    .number()
    .int()
    .min(COURSE_LIMITS.sessionMinutes.min)
    .max(COURSE_LIMITS.sessionMinutes.max)
    .optional(),
  groupSize: z.number().int().min(1).max(COURSE_LIMITS.groupSize).optional(),
  deliveryMode: z.enum(DELIVERY_MODES).optional(),
});

export const CourseDataSchema = z
  .object({
    code: z.string().min(1).max(COURSE_LIMITS.code).optional(),
    studyYear: z.string().min(1).max(COURSE_LIMITS.code).optional(),
    phase: z.string().min(1).max(COURSE_LIMITS.title).optional(),
    leader: z.string().min(1).max(COURSE_LIMITS.title).optional(),
    examiners: z.string().min(1).max(COURSE_LIMITS.title).optional(),
    description: LongText.optional(),
    literature: LongText.optional(),
    ec: z.number().positive().max(COURSE_LIMITS.ec).optional(),
    startDate: IsoDateSchema.optional(),
    schedule: ScheduleSchema.optional(),
    disciplines: z.array(DisciplineSchema).max(COURSE_LIMITS.disciplines).optional(),
    outcomes: z.array(OutcomeSchema).max(COURSE_LIMITS.outcomes),
    activities: z.array(ActivitySchema).max(COURSE_LIMITS.activities),
    assessments: z.array(AssessmentSchema).max(COURSE_LIMITS.assessments),
  })
  .superRefine((d, ctx) => {
    // The stored graph is always consistent: unique ids, no dangling references.
    const seen = new Set<string>();
    const questions = d.assessments.flatMap((a) => a.items ?? []);
    const parts = d.assessments.flatMap((a) => a.parts ?? []);
    for (const item of [...d.outcomes, ...d.activities, ...d.assessments, ...questions, ...parts]) {
      if (seen.has(item.id)) ctx.addIssue({ code: "custom", message: `Duplicate id: ${item.id}` });
      seen.add(item.id);
    }
    const outcomeIds = new Set(d.outcomes.map((o) => o.id));
    const refs = [
      ...d.activities.flatMap((a) => a.outcomeIds),
      ...d.assessments.flatMap((a) => a.coverage.map((c) => c.outcomeId)),
      ...questions.map((q) => q.outcomeId),
      ...parts.flatMap((p) => p.outcomeIds),
    ];
    for (const ref of refs)
      if (!outcomeIds.has(ref))
        ctx.addIssue({ code: "custom", message: `Unknown learning outcome: ${ref}` });
    const disciplineIds = new Set((d.disciplines ?? []).map((x) => x.id));
    for (const a of d.activities)
      if (a.disciplineId !== undefined && !disciplineIds.has(a.disciplineId))
        ctx.addIssue({ code: "custom", message: `Unknown discipline: ${a.disciplineId}` });
  }) satisfies z.ZodType<CourseData>;

export function emptyCourseData(): CourseData {
  return { outcomes: [], activities: [], assessments: [] };
}
