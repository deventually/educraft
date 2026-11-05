import { describe, expect, it } from "vitest";
import * as edit from "~/lib/courses/edit";
import { CourseDataSchema, emptyCourseData } from "~/lib/courses/schema";
import { ACT1, ACT2, alignedCourse, LO1, LO2, QUIZ, TEST1 } from "./fixtures";

const valid = (d: unknown) => CourseDataSchema.safeParse(d).success;

describe("course edits", () => {
  it("never mutates the input", () => {
    const d = alignedCourse();
    const snapshot = JSON.stringify(d);
    edit.addOutcome(d, { text: "Nieuw" });
    edit.updateOutcome(d, LO1, { text: "Anders", bloom: "apply" });
    edit.removeOutcome(d, LO1);
    edit.addActivity(d, { title: "Les", kind: "lesson", outcomeIds: [LO1] });
    edit.updateActivity(d, ACT1, { week: 3 });
    edit.removeActivity(d, ACT1);
    edit.addAssessment(d, { title: "Toets", kind: "summative", coverage: [] });
    edit.updateAssessment(d, TEST1, { weight: 50 });
    edit.removeAssessment(d, TEST1);
    expect(JSON.stringify(d)).toBe(snapshot);
  });

  it("adds items with fresh UUIDs and keeps the course valid", () => {
    let d = edit.addOutcome(emptyCourseData(), { text: "Je test software.", bloom: "apply" });
    const lo = d.outcomes[0];
    expect(lo.id).toMatch(/^[0-9a-f-]{36}$/);
    d = edit.addActivity(d, { title: "Les testen", week: 1, kind: "lesson", outcomeIds: [lo.id] });
    d = edit.addAssessment(d, {
      title: "Toets",
      week: 5,
      kind: "summative",
      weight: 100,
      coverage: [{ outcomeId: lo.id, bloom: "apply" }],
    });
    expect(d.activities[0].outcomeIds).toEqual([lo.id]);
    expect(d.assessments[0].coverage).toEqual([{ outcomeId: lo.id, bloom: "apply" }]);
    expect(valid(d)).toBe(true);
  });

  it("updates an item and can clear an optional field", () => {
    const a = edit.updateOutcome(alignedCourse(), LO1, { text: "Nieuw", bloom: undefined });
    expect(a.outcomes[0]).toEqual({ id: LO1, text: "Nieuw" });
    const b = edit.updateActivity(alignedCourse(), ACT1, { week: undefined, title: "Les 1" });
    expect(b.activities[0]).toEqual({
      id: ACT1,
      title: "Les 1",
      kind: "lesson",
      outcomeIds: [LO2],
    });
  });

  it("removing an outcome also removes every reference to it", () => {
    const d = edit.removeOutcome(alignedCourse(), LO2);
    expect(d.outcomes.map((o) => o.id)).toEqual([LO1]);
    expect(d.activities.find((a) => a.id === ACT1)?.outcomeIds).toEqual([]);
    expect(d.assessments.find((a) => a.id === QUIZ)?.coverage).toEqual([]);
    expect(d.assessments.find((a) => a.id === TEST1)?.coverage.map((c) => c.outcomeId)).toEqual([
      LO1,
    ]);
    expect(valid(d)).toBe(true);
  });

  it("removes an activity and an assessment", () => {
    const d = edit.removeAssessment(edit.removeActivity(alignedCourse(), ACT2), QUIZ);
    expect(d.activities.map((a) => a.id)).toEqual([ACT1]);
    expect(d.assessments.map((a) => a.id)).toEqual([TEST1]);
  });

  it("refuses unknown ids and references to unknown outcomes", () => {
    expect(() => edit.updateOutcome(alignedCourse(), "ghost", { text: "x" })).toThrow();
    expect(() => edit.removeActivity(alignedCourse(), "ghost")).toThrow();
    expect(() =>
      edit.addActivity(alignedCourse(), { title: "x", kind: "lesson", outcomeIds: ["ghost"] }),
    ).toThrow();
    expect(() =>
      edit.updateAssessment(alignedCourse(), TEST1, { coverage: [{ outcomeId: "ghost" }] }),
    ).toThrow();
  });
});
