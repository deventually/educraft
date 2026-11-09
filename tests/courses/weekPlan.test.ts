import { describe, expect, it } from "vitest";
import { weekPlan } from "~/lib/courses/weekPlan";
import { alignedCourse, ACT1, ACT2, QUIZ, TEST1 } from "./fixtures";

/** P27.4: the course per week, derived and never stored. */
describe("weekPlan", () => {
  it("groups lessons and tests per week, in week order, activities first", () => {
    const plan = weekPlan(alignedCourse());
    expect(plan.weeks.map((w) => [w.week, w.items.map((i) => i.id)])).toEqual([
      [1, [ACT1]],
      [2, [ACT2, QUIZ]],
      [4, [TEST1]],
    ]);
    expect(plan.weeks[1]!.items.map((i) => i.kind)).toEqual(["activity", "assessment"]);
    expect(plan.unscheduled).toEqual([]);
  });

  it("puts items without a week at the bottom", () => {
    const d = alignedCourse();
    d.activities[0]!.week = undefined;
    d.assessments[1]!.week = undefined;
    const plan = weekPlan(d);
    expect(plan.weeks.map((w) => w.week)).toEqual([2]);
    expect(plan.unscheduled.map((i) => i.id)).toEqual([ACT1, TEST1]);
  });

  it("is empty for an empty course", () => {
    expect(weekPlan({ outcomes: [], activities: [], assessments: [] })).toEqual({
      weeks: [],
      unscheduled: [],
    });
  });
});
