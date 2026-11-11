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
import { IsoDateSchema } from "~/lib/calendar/weeks";
import { BLOOM_LEVELS } from "./bloom";
import * as edit from "./edit";
import type { DomainPack } from "~/lib/context/packs";
import {
  assessmentDetails,
  criterion,
  lines,
  optionalNumber,
  optionalText,
  part,
} from "./intentFields";
import { parsePackTags } from "./packTags";
import { COURSE_LIMITS } from "./schema";
import {
  ACTIVITY_KINDS,
  ASSESSMENT_KINDS,
  type CourseData,
  HOURS_PER_EC,
  ITEM_FORMATS,
} from "./types";

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
  "set-start-date",
  "set-module",
  "update-assessment-details",
  "add-part",
  "update-part",
  "remove-part",
  "add-item",
  "update-item",
  "remove-item",
] as const;
export type CourseIntent = (typeof COURSE_INTENTS)[number];

const Id = z.string().min(1).max(COURSE_LIMITS.id);
const required = (max: number) => z.string().trim().min(1).max(max);
const bloom = z
  .enum([...BLOOM_LEVELS, ""])
  .optional()
  .transform((v) => (v ? v : undefined));

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
  // An empty choice means "not said"; the stored value is a boolean.
  supervised: z
    .enum(["yes", "no", ""])
    .optional()
    .transform((v) => (v === "yes" ? true : v === "no" ? false : undefined)),
  coverage: ids,
});

/** One question of the matrix (P26.1); an empty select or number field means "not set". */
const item = z.object({
  assessmentId: Id,
  label: z.string().trim().max(COURSE_LIMITS.itemLabel),
  outcomeId: Id,
  bloom,
  format: z
    .enum([...ITEM_FORMATS, ""])
    .optional()
    .transform((v) => (v ? v : undefined)),
  points: optionalNumber(0, COURSE_LIMITS.points),
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

/** Context the pure layer cannot know itself: the pack of the course's profile (P21.6). */
export interface CourseIntentContext {
  pack?: DomainPack;
}

/** The outcome's pack tags from the form; `{}` (no change) when the course has no pack. */
function outcomeTags(fd: FormData, ctx: CourseIntentContext) {
  if (!ctx.pack) return {};
  const r = parsePackTags(fd, ctx.pack);
  if (!r.ok) throw new Error("Invalid pack tags");
  return { packTags: r.tags };
}

function run(
  d: CourseData,
  intent: CourseIntent,
  raw: Record<string, unknown>,
  fd: FormData,
  ctx: CourseIntentContext,
): CourseData {
  switch (intent) {
    case "add-outcome": {
      const { criteria, ...v } = z
        .object({
          text: required(COURSE_LIMITS.text),
          bloom,
          criteria: lines(COURSE_LIMITS.text, COURSE_LIMITS.criteria),
        })
        .parse(raw);
      return edit.addOutcome(d, {
        ...v,
        criteria: criteria?.map(criterion),
        ...outcomeTags(fd, ctx),
      });
    }
    case "update-outcome": {
      const { id, ...v } = z
        .object({
          id: Id,
          text: required(COURSE_LIMITS.text),
          bloom,
          criteria: lines(COURSE_LIMITS.text, COURSE_LIMITS.criteria),
        })
        .parse(raw);
      assertItem(d.outcomes, id);
      // A form without the field leaves the criteria as they are.
      const criteria = fd.has("criteria")
        ? v.criteria?.map(criterion)
        : d.outcomes.find((o) => o.id === id)?.criteria;
      return edit.updateOutcome(d, id, {
        text: v.text,
        bloom: v.bloom,
        criteria,
        ...outcomeTags(fd, ctx),
      });
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
      const current = d.assessments.find((a) => a.id === id);
      // With questions the form has no coverage fields: the matrix is the source.
      const coverage = current?.items?.length ? current.coverage : coverageFrom(raw, v.coverage);
      return edit.updateAssessment(d, id, {
        title: v.title,
        kind: v.kind,
        week: v.week,
        hours: v.hours,
        weight: v.weight,
        supervised: v.supervised,
        coverage,
      });
    }
    case "remove-assessment": {
      const { id } = z.object({ id: Id }).parse(raw);
      assertItem(d.assessments, id);
      return edit.removeAssessment(d, id);
    }
    case "add-item": {
      const { assessmentId, label, ...v } = item.parse(raw);
      assertItem(d.assessments, assessmentId);
      const count = d.assessments.find((a) => a.id === assessmentId)?.items?.length ?? 0;
      return edit.addItem(d, assessmentId, { ...v, label: label || String(count + 1) });
    }
    case "update-item": {
      const { assessmentId, id, ...v } = item
        .extend({ id: Id, label: required(COURSE_LIMITS.itemLabel) })
        .parse(raw);
      assertItem(d.assessments, assessmentId);
      assertItem(d.assessments.find((a) => a.id === assessmentId)?.items ?? [], id);
      return edit.updateItem(d, assessmentId, id, {
        label: v.label,
        outcomeId: v.outcomeId,
        bloom: v.bloom,
        format: v.format,
        points: v.points,
      });
    }
    case "remove-item": {
      const { assessmentId, id } = z.object({ assessmentId: Id, id: Id }).parse(raw);
      assertItem(d.assessments, assessmentId);
      assertItem(d.assessments.find((a) => a.id === assessmentId)?.items ?? [], id);
      return edit.removeItem(d, assessmentId, id);
    }
    case "set-ec": {
      const { ec } = z.object({ ec: optionalNumber(0, COURSE_LIMITS.ec) }).parse(raw);
      return edit.setStudyLoad(d, ec === 0 ? undefined : ec);
    }
    case "set-module": {
      const v = z
        .object({
          code: optionalText(COURSE_LIMITS.code),
          studyYear: optionalText(COURSE_LIMITS.code),
        })
        .parse(raw);
      return edit.setModule(d, { code: v.code, studyYear: v.studyYear });
    }
    case "update-assessment-details": {
      const { id, ...v } = assessmentDetails.parse(raw);
      assertItem(d.assessments, id);
      return edit.updateAssessment(d, id, {
        form: v.form,
        owner: v.owner,
        grading: v.grading,
        passMark: v.passMark,
        conditions: v.conditions,
        resit: v.resit,
        conduct: v.conduct,
      });
    }
    case "add-part": {
      const { assessmentId, ...v } = part.parse(raw);
      assertItem(d.assessments, assessmentId);
      return edit.addPart(d, assessmentId, v);
    }
    case "update-part": {
      const { assessmentId, id, ...v } = part.extend({ id: Id }).parse(raw);
      assertItem(d.assessments, assessmentId);
      assertItem(d.assessments.find((a) => a.id === assessmentId)?.parts ?? [], id);
      return edit.updatePart(d, assessmentId, id, {
        title: v.title,
        outcomeIds: v.outcomeIds,
        weight: v.weight,
        knockOut: v.knockOut,
        pass: v.pass,
        fail: v.fail,
      });
    }
    case "remove-part": {
      const { assessmentId, id } = z.object({ assessmentId: Id, id: Id }).parse(raw);
      assertItem(d.assessments, assessmentId);
      assertItem(d.assessments.find((a) => a.id === assessmentId)?.parts ?? [], id);
      return edit.removePart(d, assessmentId, id);
    }
    case "set-start-date": {
      const { startDate } = z
        .object({ startDate: z.union([z.literal(""), IsoDateSchema]).default("") })
        .parse(raw);
      return edit.setStartDate(d, startDate || undefined);
    }
  }
}

function isCourseIntent(value: unknown): value is CourseIntent {
  return (COURSE_INTENTS as readonly unknown[]).includes(value);
}

/** Applies one form submission to the course. Never throws. */
export function applyCourseIntent(
  d: CourseData,
  fd: FormData,
  ctx: CourseIntentContext = {},
): CourseIntentResult {
  const intent = fd.get("intent");
  if (!isCourseIntent(intent)) return { ok: false, error: "invalid" };
  try {
    return { ok: true, data: run(d, intent, fields(fd), fd, ctx) };
  } catch (e) {
    return { ok: false, error: e instanceof NotFound ? "not-found" : "invalid" };
  }
}
