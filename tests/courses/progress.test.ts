import { describe, expect, it } from "vitest";
import { checkAlignment } from "~/lib/courses/alignment";
import { courseProgress, isEmptyCourse } from "~/lib/courses/progress";
import { emptyCourseData } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";
import { alignedCourse, LO1 } from "./fixtures";

const progressOf = (d: CourseData) => courseProgress(d, checkAlignment(d));
const step = (d: CourseData, id: string) => progressOf(d).steps.find((s) => s.id === id)!;

describe("courseProgress: the steps of backwards design, from the course itself", () => {
  it("walks the steps in backwards-design order, each on its tab", () => {
    expect(progressOf(emptyCourseData()).steps.map((s) => [s.id, s.tab])).toEqual([
      ["details", "overview"],
      ["outcomes", "outcomes"],
      ["assessments", "plan"],
      ["lessons", "plan"],
      ["weeks", "plan"],
      ["check", "check"],
    ]);
  });

  it("starts an empty course at the details, with nothing complete", () => {
    const p = progressOf(emptyCourseData());
    expect(p.complete).toBe(0);
    expect(p.total).toBe(6);
    expect(p.next?.id).toBe("details");
    expect(p.steps.every((s) => !s.complete)).toBe(true);
  });

  it("completes every step for an aligned course with its study load", () => {
    const d = { ...alignedCourse(), ec: 5 };
    const p = progressOf(d);
    expect(p.complete).toBe(6);
    expect(p.next).toBeNull();
  });

  it("points to the first open step, not to a later one", () => {
    const d = alignedCourse();
    expect(progressOf(d).next?.id).toBe("details");
    expect(progressOf({ ...d, ec: 5, activities: [] }).next?.id).toBe("lessons");
  });

  it("counts how many learning outcomes are assessed and taught", () => {
    const d = { ...alignedCourse(), ec: 5 };
    d.assessments = d.assessments.filter((a) => a.kind === "formative");
    expect(step(d, "assessments")).toMatchObject({ complete: false, done: 0, total: 2 });
    d.activities = d.activities.filter((a) => a.outcomeIds.includes(LO1));
    expect(step(d, "lessons")).toMatchObject({ complete: false, done: 1, total: 2 });
  });

  it("counts the lessons and tests that have a week", () => {
    const d = alignedCourse();
    delete d.activities[0]!.week;
    expect(step(d, "weeks")).toMatchObject({ complete: false, done: 3, total: 4 });
  });

  it("needs learning outcomes before tests and lessons can be complete", () => {
    const d = { ...emptyCourseData(), ec: 5 };
    expect(step(d, "assessments").complete).toBe(false);
    expect(step(d, "lessons").complete).toBe(false);
    expect(step(d, "weeks").complete).toBe(false);
  });

  it("is complete at the check only without findings, and counts them", () => {
    const d = alignedCourse();
    d.activities[0]!.outcomeIds = [];
    const check = step(d, "check");
    expect(check.complete).toBe(false);
    expect(check.total).toBe(checkAlignment(d).length);
  });
});

describe("isEmptyCourse: where the course wizard offers how to start", () => {
  it("is empty without outcomes, lessons and tests, whatever the details say", () => {
    expect(isEmptyCourse(emptyCourseData())).toBe(true);
    expect(isEmptyCourse({ ...emptyCourseData(), ec: 5, schedule: { weeks: 8 } })).toBe(true);
    expect(isEmptyCourse(alignedCourse())).toBe(false);
    expect(isEmptyCourse({ ...alignedCourse(), outcomes: [], assessments: [] })).toBe(false);
  });
});
