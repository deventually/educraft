import { describe, expect, it } from "vitest";
import { checkAlignment, coverageMatrix } from "~/lib/courses/alignment";
import { emptyCourseData } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";
import { ACT1, ACT2, alignedCourse, LO1, LO2, QUIZ, TEST1 } from "./fixtures";

const codes = (d: CourseData) => checkAlignment(d).map((f) => f.code);

describe("checkAlignment (pure, advisory)", () => {
  it("finds nothing in an aligned course or an empty one", () => {
    expect(checkAlignment(alignedCourse())).toEqual([]);
    expect(checkAlignment(emptyCourseData())).toEqual([]);
  });

  it("outcome-not-taught: no activity names the outcome", () => {
    const d = alignedCourse();
    d.activities[1]!.outcomeIds = [LO2];
    expect(checkAlignment(d)).toEqual([
      { code: "outcome-not-taught", severity: "warning", outcomeId: LO1 },
    ]);
  });

  it("outcome-not-assessed: only a formative assessment covers the outcome", () => {
    const d = alignedCourse();
    d.assessments[1]!.coverage = [{ outcomeId: LO1, bloom: "create" }];
    expect(checkAlignment(d)).toEqual([
      { code: "outcome-not-assessed", severity: "warning", outcomeId: LO2 },
    ]);
  });

  it("assessed-before-taught: a summative week before the earliest teaching week", () => {
    const d = alignedCourse();
    d.activities[1]!.week = 6;
    expect(checkAlignment(d)).toEqual([
      { code: "assessed-before-taught", severity: "warning", outcomeId: LO1, itemId: TEST1 },
    ]);
  });

  it("assessed-before-taught needs both weeks", () => {
    const d = alignedCourse();
    d.activities[1]!.week = undefined;
    d.assessments[1]!.week = 1;
    expect(codes(d)).toEqual([]);
  });

  it("bloom-below-outcome: coverage ranks below the outcome's level", () => {
    const d = alignedCourse();
    d.assessments[1]!.coverage[0]!.bloom = "understand";
    expect(checkAlignment(d)).toEqual([
      { code: "bloom-below-outcome", severity: "warning", outcomeId: LO1, itemId: TEST1 },
    ]);
  });

  it("bloom-below-outcome needs both levels", () => {
    const d = alignedCourse();
    d.assessments[1]!.coverage[0]!.bloom = undefined;
    d.outcomes[1]!.bloom = undefined;
    expect(codes(d)).toEqual([]);
  });

  it("activity-without-outcome: an activity serves no outcome", () => {
    const d = alignedCourse();
    d.activities.push({ id: "act-3", title: "Gastcollege", kind: "lesson", outcomeIds: [] });
    expect(checkAlignment(d)).toEqual([
      { code: "activity-without-outcome", severity: "info", itemId: "act-3" },
    ]);
  });

  it("weights-not-100: summative weights are set and do not add up", () => {
    const d = alignedCourse();
    d.assessments[1]!.weight = 60;
    expect(checkAlignment(d)).toEqual([{ code: "weights-not-100", severity: "info" }]);
  });

  it("weights-not-100 stays quiet when no weight is set", () => {
    const d = alignedCourse();
    d.assessments[1]!.weight = undefined;
    expect(codes(d)).toEqual([]);
  });

  it("study-load-exceeds-ec: planned hours exceed EC × 28 hours", () => {
    const d = alignedCourse();
    d.ec = 1; // 28 hours
    d.activities[0]!.hours = 20;
    d.assessments[1]!.hours = 10;
    expect(checkAlignment(d)).toEqual([{ code: "study-load-exceeds-ec", severity: "info" }]);
    d.assessments[1]!.hours = 8;
    expect(codes(d)).toEqual([]);
  });

  it("study-load-exceeds-ec needs an EC value", () => {
    const d = alignedCourse();
    d.activities[0]!.hours = 500;
    expect(codes(d)).toEqual([]);
  });

  it("orders findings by outcome, then by item, weights last", () => {
    const d: CourseData = {
      outcomes: [
        { id: LO1, text: "a", bloom: "analyze" },
        { id: LO2, text: "b" },
      ],
      activities: [{ id: ACT1, title: "x", week: 3, kind: "lesson", outcomeIds: [LO1] }],
      assessments: [
        {
          id: TEST1,
          title: "t",
          week: 2,
          kind: "summative",
          weight: 40,
          coverage: [{ outcomeId: LO1, bloom: "understand" }],
        },
      ],
    };
    d.activities.push({ id: ACT2, title: "y", kind: "assignment", outcomeIds: [], hours: 60 });
    d.ec = 2;
    expect(checkAlignment(d)).toEqual([
      { code: "assessed-before-taught", severity: "warning", outcomeId: LO1, itemId: TEST1 },
      { code: "bloom-below-outcome", severity: "warning", outcomeId: LO1, itemId: TEST1 },
      { code: "outcome-not-taught", severity: "warning", outcomeId: LO2 },
      { code: "outcome-not-assessed", severity: "warning", outcomeId: LO2 },
      { code: "activity-without-outcome", severity: "info", itemId: ACT2 },
      { code: "weights-not-100", severity: "info" },
      { code: "study-load-exceeds-ec", severity: "info" },
    ]);
  });
});

describe("coverageMatrix", () => {
  it("has a row per outcome and columns for activities, then assessments", () => {
    const m = coverageMatrix(alignedCourse());
    expect(m.columns).toEqual([
      { id: ACT1, kind: "activity" },
      { id: ACT2, kind: "activity" },
      { id: QUIZ, kind: "assessment" },
      { id: TEST1, kind: "assessment" },
    ]);
    expect(m.rows.map((r) => r.outcomeId)).toEqual([LO1, LO2]);
    expect(m.rows[0]!.cells).toEqual([
      { covered: false },
      { covered: true },
      { covered: false },
      { covered: true, bloom: "create" },
    ]);
    expect(m.rows[1]!.cells).toEqual([
      { covered: true },
      { covered: false },
      { covered: true, bloom: "understand" },
      { covered: true, bloom: "analyze" },
    ]);
  });
});
