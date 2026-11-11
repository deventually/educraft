/**
 * The anchor of a learning outcome (step 4 of the guided route): the module, lesson or test in one
 * of the teacher's courses that the chapter is about. Pure: the server checks that the course is
 * the teacher's and takes the snapshot; tools receive the course and item through their existing
 * `prefillFromCourse` sources, so no tool knows about anchors.
 */
import type { CourseData } from "~/lib/courses/types";
import { courseHint } from "./toolHints";
import type { Anchor, CourseEvidencePart, Outcome } from "./types";

export type AnchorKind = "module" | "lesson" | "test";
export type AnchorRef = NonNullable<Anchor["course"]>;
type CourseItems = Pick<CourseData, "activities" | "assessments">;

export interface AnchorOption {
  /** The form value: `<courseId>` or `<courseId>:<itemId>`. */
  value: string;
  kind: AnchorKind;
  /** The lesson's or test's title; "" for the whole course. */
  title: string;
}

/** One outcome's anchor as the pages show it (built on the server, which looks up the course). */
export interface AnchorView {
  /** Absent for a description only. */
  kind?: AnchorKind;
  /** The course's name; absent for a description only. */
  course?: string;
  /** The lesson's or test's title. */
  item?: string;
  /** The course or its item is gone (or no longer shared): shown, but no tool opens on it. */
  gone?: true;
  description?: string;
  /** `?course=&item=` for a tool opened for this outcome. */
  query: Record<string, string>;
}

export const anchorValue = (ref: AnchorRef): string =>
  ref.itemId ? `${ref.courseId}:${ref.itemId}` : ref.courseId;

/** A form value back into a reference; "" (no course) and anything malformed are null. */
export function parseAnchorValue(value: string): AnchorRef | null {
  const [courseId, itemId, ...rest] = value.split(":");
  if (!courseId || rest.length > 0 || itemId === "") return null;
  return itemId ? { courseId, itemId } : { courseId };
}

/** What a reference points at in this course; null when the item is not (or no longer) there. */
export function anchorKind(data: CourseItems, itemId: string | undefined): AnchorKind | null {
  if (itemId === undefined) return "module";
  if (data.activities.some((a) => a.id === itemId)) return "lesson";
  if (data.assessments.some((a) => a.id === itemId)) return "test";
  return null;
}

/** The choices one course offers: the whole course as a module, its lessons and assignments, its tests. */
export function anchorOptions(course: { id: string; data: CourseItems }): AnchorOption[] {
  const option = (kind: AnchorKind, item?: { id: string; title: string }): AnchorOption => ({
    value: anchorValue({ courseId: course.id, ...(item && { itemId: item.id }) }),
    kind,
    title: item?.title ?? "",
  });
  return [
    option("module"),
    ...course.data.activities.map((a) => option("lesson", a)),
    ...course.data.assessments.map((a) => option("test", a)),
  ];
}

/**
 * Which part of the course goes into the dossier as evidence: a module brings its outcomes with
 * the coverage matrix, a test its question-level matrix. A lesson brings none: its evidence is
 * the lesson plan the teacher makes with a tool.
 */
export function anchorPart(data: CourseItems, ref: AnchorRef): CourseEvidencePart | null {
  const kind = anchorKind(data, ref.itemId);
  if (kind === "module") return "outcomes-and-matrix";
  if (kind === "test" && ref.itemId) return { assessmentId: ref.itemId };
  return null;
}

/** A criterion about the programme a module sits in, which a course's outcomes and matrix show. */
const PROGRAMME =
  /opleidingsprofiel|leerlijn|samenhang|curricul|programme profile|learning line|coherence/i;

/**
 * The criteria a course snapshot is evidence for: only those about alignment, a blueprint or the
 * programme. None fits: the snapshot stays unlinked, and the teacher links it.
 */
export const snapshotCriteria = (outcome: Outcome): string[] =>
  outcome.criteria.filter((c) => courseHint(c) || PROGRAMME.test(c.text)).map((c) => c.id);

/** A tool opened for this outcome starts on the anchor's course and item (`?course=&item=`). */
export function anchorToolQuery(anchor: Anchor | undefined): Record<string, string> {
  const ref = anchor?.course;
  if (!ref) return {};
  return ref.itemId ? { course: ref.courseId, item: ref.itemId } : { course: ref.courseId };
}

export type AnchorQuestion = "test" | "guidance" | "module" | "lesson" | "self" | "other";

/** The question the wizard asks, on the outcome's title only; the first that fits wins. */
const QUESTIONS: [AnchorQuestion, RegExp][] = [
  ["test", /toets|examin|assessment|\btest/i],
  ["guidance", /begeleid|coach|mentor|guid/i],
  ["module", /ontwerp|curricul|design/i],
  ["lesson", /doceren|lesgeven|uitvoer|teach/i],
  ["self", /professio|ontwikkel|identit|develop/i],
];

export function anchorQuestion(outcome: Pick<Outcome, "title">): AnchorQuestion {
  return QUESTIONS.find(([, re]) => re.test(outcome.title))?.[0] ?? "other";
}

const DAY = 86_400_000;

/** Whole days from today (UTC) to an ISO date; negative when it has passed. */
export function daysUntil(isoDate: string, now: number): number {
  const today = Date.parse(new Date(now).toISOString().slice(0, 10));
  return Math.round((Date.parse(isoDate) - today) / DAY);
}
