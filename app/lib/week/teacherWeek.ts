/**
 * The teacher's week (P22.2): what happens this week across all of a teacher's
 * courses. Pure and derived, never stored: a function of the courses, the
 * linked work, the institution's break weeks and today's date. No AI, no
 * planner, no to-do list: "prepared" simply means work is linked to the item.
 */
import { addWeeks, courseWeekOn, type IsoDate, isoWeek, mondayOf } from "~/lib/calendar/weeks";
import { checkAlignment } from "~/lib/courses/alignment";
import type { CourseData } from "~/lib/courses/types";

/** Assessments of this many previous weeks are listed under "to grade". */
export const GRADE_WEEKS = 2;
/** At most this many rows per list; the rest is "and N more". */
export const MAX_ROWS = 10;

export interface WeekCourse {
  id: string;
  name: string;
  data: CourseData;
}

/** A piece of linked work: `itemId` null means it belongs to the course as a whole. */
export interface WeekLink {
  courseId: string;
  itemId: string | null;
}

export interface WeekInput {
  courses: WeekCourse[];
  links: WeekLink[];
  breakWeeks: IsoDate[];
  today: IsoDate;
  /** Open role-agent findings per course id (P21); left out when there are none to count. */
  agentFindings?: Record<string, number>;
}

export interface WeekRow {
  itemId: string;
  title: string;
  kind: "activity" | "assessment";
  week: number;
}

export interface WeekList {
  rows: WeekRow[];
  /** How many rows did not fit. */
  more: number;
}

export type CourseWeek =
  | { courseId: string; courseName: string; status: "break" }
  | {
      courseId: string;
      courseName: string;
      status: "week";
      /** The relative course week. */
      week: number;
      thisWeek: WeekList;
      prepare: WeekList;
      grade: WeekList;
      /** Open alignment findings (`checkAlignment`). */
      findings: number;
      agentFindings?: number;
    };

export interface TeacherWeek {
  /** The Monday of the week shown. */
  monday: IsoDate;
  isoWeek: number;
  /** The courses running this week, by name. */
  courses: CourseWeek[];
  /** Courses without a start date: the week cannot place them. */
  undated: { courseId: string; courseName: string }[];
}

function list(rows: WeekRow[]): WeekList {
  return { rows: rows.slice(0, MAX_ROWS), more: Math.max(0, rows.length - MAX_ROWS) };
}

/** Activities first, then assessments, each in course order. */
function rowsOf(d: CourseData): WeekRow[] {
  const dated = <T extends { id: string; title: string; week?: number }>(
    items: T[],
    kind: WeekRow["kind"],
  ) =>
    items.flatMap((i) =>
      i.week === undefined ? [] : [{ itemId: i.id, title: i.title, kind, week: i.week }],
    );
  return [...dated(d.activities, "activity"), ...dated(d.assessments, "assessment")];
}

function courseWeek(c: WeekCourse, startDate: IsoDate, input: WeekInput): CourseWeek | null {
  const rows = rowsOf(c.data);
  const lastItemWeek = Math.max(0, ...rows.map((r) => r.week));
  if (lastItemWeek === 0) return null;
  // A course stays in the week while its last assessments are being graded.
  const on = courseWeekOn(startDate, input.breakWeeks, input.today, lastItemWeek + GRADE_WEEKS);
  if (on.kind === "before" || on.kind === "after") return null;
  if (on.kind === "break") return { courseId: c.id, courseName: c.name, status: "break" };

  const n = on.week;
  const linked = new Set(
    input.links.filter((l) => l.courseId === c.id && l.itemId).map((l) => l.itemId),
  );
  const inWeek = (w: number) => rows.filter((r) => r.week === w);
  const agents = input.agentFindings?.[c.id];
  return {
    courseId: c.id,
    courseName: c.name,
    status: "week",
    week: n,
    thisWeek: list(inWeek(n)),
    prepare: list([...inWeek(n), ...inWeek(n + 1)].filter((r) => !linked.has(r.itemId))),
    grade: list(
      rows.filter((r) => r.kind === "assessment" && r.week >= n - GRADE_WEEKS && r.week < n),
    ),
    findings: checkAlignment(c.data).length,
    ...(agents !== undefined && { agentFindings: agents }),
  };
}

export function teacherWeek(input: WeekInput): TeacherWeek {
  const byName = [...input.courses].sort((a, b) => a.name.localeCompare(b.name));
  const courses: CourseWeek[] = [];
  const undated: TeacherWeek["undated"] = [];
  for (const c of byName) {
    if (!c.data.startDate) {
      undated.push({ courseId: c.id, courseName: c.name });
      continue;
    }
    const week = courseWeek(c, c.data.startDate, input);
    if (week) courses.push(week);
  }
  const monday = mondayOf(input.today);
  return { monday, isoWeek: isoWeek(monday), courses, undated };
}

/** From Friday to Sunday, Start also shows next week (the "Sunday briefing", BESLUIT-2026-11-05-7). */
export function showsNextWeek(today: IsoDate): boolean {
  const day = new Date(`${today}T00:00:00Z`).getUTCDay(); // Sunday = 0
  return day === 0 || day >= 5;
}

/** Next week: the same function, a week later. */
export function nextWeek(input: WeekInput): TeacherWeek {
  return teacherWeek({ ...input, today: addWeeks(input.today, 1) });
}
