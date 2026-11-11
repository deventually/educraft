import { describe, expect, it } from "vitest";
import { forDiscipline, weekPlan } from "~/lib/courses/weekPlan";
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

  it("carries the discipline of a lesson", () => {
    const d = alignedCourse();
    d.disciplines = [{ id: "web", name: "Webtech" }];
    d.activities[0]!.disciplineId = "web";
    const items = weekPlan(d).weeks.flatMap((w) => w.items);
    expect(items.find((i) => i.id === ACT1)?.disciplineId).toBe("web");
    expect(items.find((i) => i.id === ACT2)?.disciplineId).toBeUndefined();
  });
});

/** Step D: the week view per discipline. Tests belong to the whole course, so they stay. */
describe("forDiscipline", () => {
  function twoDisciplines() {
    const d = alignedCourse();
    d.disciplines = [
      { id: "web", name: "Webtech" },
      { id: "hw", name: "Hardware" },
    ];
    d.activities[0]!.disciplineId = "web";
    d.activities[1]!.disciplineId = "hw";
    return d;
  }

  it("keeps the discipline's lessons and every test, and drops weeks that end up empty", () => {
    const plan = forDiscipline(weekPlan(twoDisciplines()), "hw");
    expect(plan.weeks.map((w) => [w.week, w.items.map((i) => i.id)])).toEqual([
      [2, [ACT2, QUIZ]],
      [4, [TEST1]],
    ]);
  });

  it("filters the items without a week too", () => {
    const d = twoDisciplines();
    d.activities[0]!.week = undefined;
    d.activities[1]!.week = undefined;
    expect(forDiscipline(weekPlan(d), "web").unscheduled.map((i) => i.id)).toEqual([ACT1]);
  });

  it("leaves the plan as it is without a discipline", () => {
    const plan = weekPlan(twoDisciplines());
    expect(forDiscipline(plan, null)).toEqual(plan);
  });
});
