import { improvementPlace } from "./improvements";
import type { CourseData } from "./types";

/** What changes when a course is given again: the run, never the content. */
export interface CourseRun {
  studyYear?: string;
  /** A semester or a period, as the institution names it ("Semester 1", "Periode 3"). */
  phase?: string;
  startDate?: string;
}

/**
 * The course's data for its next run: the teacher's study year, semester or period and
 * start date; outcomes, tests, lessons, schedule and module details stay. What the teacher
 * leaves empty is left out, never carried over from the last run. Open improvements come
 * along (P33.1), each on its place or, when that item is gone, on the whole course; finished
 * ones stay behind.
 */
export function forNewRun(data: CourseData, run: CourseRun): CourseData {
  const { studyYear: _y, phase: _p, startDate: _s, improvements, ...content } = data;
  const open = (improvements ?? [])
    .filter((p) => p.status === "open")
    .map((p) => ({ ...p, place: improvementPlace(data, p.place) }));
  return {
    ...content,
    ...(run.studyYear && { studyYear: run.studyYear }),
    ...(run.phase && { phase: run.phase }),
    ...(run.startDate && { startDate: run.startDate }),
    ...(open.length > 0 && { improvements: open }),
  };
}
