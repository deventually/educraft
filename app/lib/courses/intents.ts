/**
 * The form boundary of the course editor (brief P20, 20.3): one `intent` per
 * `<Form>`, parsed with Zod and applied with the pure edits. Pure (no server, no
 * DB), so the route action stays thin: load the course, apply, save.
 *
 * Field conventions: `outcomeIds` and `coverage` are checkbox groups; the Bloom
 * level of a covered outcome comes from `bloom:<outcomeId>`; an empty number
 * field means "not set"; a decimal comma is accepted.
 */
import { z } from "zod";
import { BLOOM_LEVELS } from "./bloom";
import * as edit from "./edit";
import { COURSE_LIMITS } from "./schema";
import { ACTIVITY_KINDS, ASSESSMENT_KINDS, type CourseData, HOURS_PER_EC } from "./types";

export type CourseIntentError = "invalid" | "not-found";
export type CourseIntentResult =
  | { ok: true; data: CourseData }
  | { ok: false; error: CourseIntentError };

export const COURSE_INTENTS = [
  "add-outcome",
  "update-outcome",
  "remove-outcome",
  "add-activity",
  "update-activity",
  "remove-activity",
  "add-assessment",
  "update-assessment",
  "remove-assessment",
  "set-ec",
] as const;
export type CourseIntent = (typeof COURSE_INTENTS)[number];

const Id = z.string().min(1).max(COURSE_LIMITS.id);
const required = (max: number) => z.string().trim().min(1).max(max);
const bloom = z
  .enum([...BLOOM_LEVELS, ""])
  .optional()
  .transform((v) => (v ? v : undefined));

/** An optional number from a text field: absent or "" means not set. */
export const optionalNumber = (min: number, max: number, int = false) =>
  z
    .string()
    .trim()
    .regex(/^(\d+([.,]\d+)?)?$/)
    .optional()
    .transform((v) => (v ? Number(v.replace(",", ".")) : undefined))
    .refine((n) => n === undefined || (n >= min && n <= max && (!int || Number.isInteger(n))));

const week = optionalNumber(1, COURSE_LIMITS.week, true);
const hours = optionalNumber(0, COURSE_LIMITS.ec * HOURS_PER_EC);
const ids = z.array(Id).max(COURSE_LIMITS.outcomes).default([]);

const activity = z.object({
  title: required(COURSE_LIMITS.title),
  kind: z.enum(ACTIVITY_KINDS),
  week,
  hours,
  outcomeIds: ids,
});
const assessment = z.object({
  title: required(COURSE_LIMITS.title),
  kind: z.enum(ASSESSMENT_KINDS),
  week,
  hours,
  weight: optionalNumber(0, 100),
  coverage: ids,
});

const MULTI = new Set(["outcomeIds", "coverage"]);

function fields(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    if (key === "intent") continue;
    const values = fd.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = MULTI.has(key) ? values : values[0];
  }
  return out;
}

class NotFound extends Error {}

function assertItem(items: { id: string }[], id: string): void {
  if (!items.some((i) => i.id === id)) throw new NotFound(id);
}

/** Coverage from the checked outcomes, each with its optional `bloom:<id>` level. */
function coverageFrom(raw: Record<string, unknown>, outcomeIds: string[]) {
  return outcomeIds.map((outcomeId) => {
    const level = bloom.parse(raw[`bloom:${outcomeId}`]);
    return level ? { outcomeId, bloom: level } : { outcomeId };
  });
}

function run(d: CourseData, intent: CourseIntent, raw: Record<string, unknown>): CourseData {
  switch (intent) {
    case "add-outcome": {
      const v = z.object({ text: required(COURSE_LIMITS.text), bloom }).parse(raw);
      return edit.addOutcome(d, v);
    }
    case "update-outcome": {
      const { id, ...v } = z
        .object({ id: Id, text: required(COURSE_LIMITS.text), bloom })
        .parse(raw);
      assertItem(d.outcomes, id);
      return edit.updateOutcome(d, id, { text: v.text, bloom: v.bloom });
    }
    case "remove-outcome": {
      const { id } = z.object({ id: Id }).parse(raw);
      assertItem(d.outcomes, id);
      return edit.removeOutcome(d, id);
    }
    case "add-activity":
      return edit.addActivity(d, activity.parse(raw));
    case "update-activity": {
      const { id, ...v } = activity.extend({ id: Id }).parse(raw);
      assertItem(d.activities, id);
      // A form sends the whole item: an empty field clears it, so every key is explicit.
      return edit.updateActivity(d, id, {
        title: v.title,
        kind: v.kind,
        week: v.week,
        hours: v.hours,
        outcomeIds: v.outcomeIds,
      });
    }
    case "remove-activity": {
      const { id } = z.object({ id: Id }).parse(raw);
      assertItem(d.activities, id);
      return edit.removeActivity(d, id);
    }
    case "add-assessment": {
      const v = assessment.parse(raw);
      return edit.addAssessment(d, { ...v, coverage: coverageFrom(raw, v.coverage) });
    }
    case "update-assessment": {
      const { id, ...v } = assessment.extend({ id: Id }).parse(raw);
      assertItem(d.assessments, id);
      return edit.updateAssessment(d, id, {
        title: v.title,
        kind: v.kind,
        week: v.week,
        hours: v.hours,
        weight: v.weight,
        coverage: coverageFrom(raw, v.coverage),
      });
    }
    case "remove-assessment": {
      const { id } = z.object({ id: Id }).parse(raw);
      assertItem(d.assessments, id);
      return edit.removeAssessment(d, id);
    }
    case "set-ec": {
      const { ec } = z.object({ ec: optionalNumber(0, COURSE_LIMITS.ec) }).parse(raw);
      return edit.setStudyLoad(d, ec === 0 ? undefined : ec);
    }
  }
}

export function isCourseIntent(value: unknown): value is CourseIntent {
  return (COURSE_INTENTS as readonly unknown[]).includes(value);
}

/** Applies one form submission to the course. Never throws. */
export function applyCourseIntent(d: CourseData, fd: FormData): CourseIntentResult {
  const intent = fd.get("intent");
  if (!isCourseIntent(intent)) return { ok: false, error: "invalid" };
  try {
    return { ok: true, data: run(d, intent, fields(fd)) };
  } catch (e) {
    return { ok: false, error: e instanceof NotFound ? "not-found" : "invalid" };
  }
}
