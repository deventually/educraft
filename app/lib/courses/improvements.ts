/**
 * Improvements for the next run of a course (brief P33.1): the teacher's own points, and later the
 * accepted points of a course evaluation (P33.2). Pure: the form boundary and the edits, no server.
 * Advice only: nothing here changes an outcome, lesson or test.
 */
import { z } from "zod";
import { COURSE_LIMITS } from "./schema";
import {
  type CourseData,
  IMPROVEMENT_PLACE_KINDS,
  IMPROVEMENT_STATUSES,
  type Improvement,
  type ImprovementPlace,
} from "./types";

const ITEMS = {
  outcome: (d: CourseData) => d.outcomes,
  activity: (d: CourseData) => d.activities,
  assessment: (d: CourseData) => d.assessments,
} as const;

/** The place as it stands in this course: an item that no longer exists is the whole course. */
export function improvementPlace(d: CourseData, place: ImprovementPlace): ImprovementPlace {
  if (place.kind === "course") return place;
  return ITEMS[place.kind](d).some((i) => i.id === place.id) ? place : { kind: "course" };
}

/** The run a new point comes from: the course's study year and semester or period, if any. */
function currentRun(d: CourseData): Pick<Improvement, "run"> {
  const run = {
    ...(d.studyYear && { studyYear: d.studyYear }),
    ...(d.phase && { phase: d.phase }),
  };
  return Object.keys(run).length ? { run } : {};
}

const Id = z.string().min(1).max(COURSE_LIMITS.id);

/** A place from the form's select: `course` or `<kind>:<id>`. */
const PlaceField = z.string().transform((v, ctx): ImprovementPlace => {
  if (v === "course") return { kind: "course" };
  const [kind, ...rest] = v.split(":");
  const id = rest.join(":");
  const parsed = z.enum(IMPROVEMENT_PLACE_KINDS).safeParse(kind);
  if (!parsed.success || !Id.safeParse(id).success) {
    ctx.addIssue({ code: "custom", message: "Unknown place" });
    return z.NEVER;
  }
  return { kind: parsed.data, id };
});

const AddSchema = z.object({
  text: z.string().trim().min(1).max(COURSE_LIMITS.text),
  place: PlaceField,
});
const StatusSchema = z.object({ id: Id, status: z.enum(IMPROVEMENT_STATUSES) });
const RemoveSchema = z.object({ id: Id });

export type ImprovementIntentResult =
  | { ok: true; data: CourseData; done: "added" | "finished" | "reopened" | "removed" }
  | { ok: false; error: "invalid" | "not-found" | "full" };

const field = (fd: FormData, key: string) => fd.get(key)?.toString() ?? "";

/**
 * Applies one improvement form (`add-improvement`, `set-improvement-status`,
 * `remove-improvement`) to the course; null for any other intent. Never throws.
 */
export function applyImprovementIntent(
  d: CourseData,
  fd: FormData,
): ImprovementIntentResult | null {
  const points = d.improvements ?? [];
  const known = (id: string) => points.some((p) => p.id === id);
  switch (fd.get("intent")) {
    case "add-improvement": {
      const v = AddSchema.safeParse({ text: field(fd, "text"), place: field(fd, "place") });
      if (!v.success) return { ok: false, error: "invalid" };
      if (improvementPlace(d, v.data.place).kind !== v.data.place.kind)
        return { ok: false, error: "invalid" };
      if (points.length >= COURSE_LIMITS.improvements) return { ok: false, error: "full" };
      const point: Improvement = {
        id: crypto.randomUUID(),
        text: v.data.text,
        place: v.data.place,
        status: "open",
        source: "teacher",
        ...currentRun(d),
      };
      return { ok: true, data: { ...d, improvements: [...points, point] }, done: "added" };
    }
    case "set-improvement-status": {
      const v = StatusSchema.safeParse({ id: field(fd, "id"), status: field(fd, "status") });
      if (!v.success) return { ok: false, error: "invalid" };
      if (!known(v.data.id)) return { ok: false, error: "not-found" };
      const improvements = points.map((p) =>
        p.id === v.data.id ? { ...p, status: v.data.status } : p,
      );
      const done = v.data.status === "done" ? "finished" : "reopened";
      return { ok: true, data: { ...d, improvements }, done };
    }
    case "remove-improvement": {
      const v = RemoveSchema.safeParse({ id: field(fd, "id") });
      if (!v.success) return { ok: false, error: "invalid" };
      if (!known(v.data.id)) return { ok: false, error: "not-found" };
      const improvements = points.filter((p) => p.id !== v.data.id);
      return { ok: true, data: { ...d, improvements }, done: "removed" };
    }
    default:
      return null;
  }
}
