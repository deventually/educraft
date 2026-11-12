import { describe, expect, it } from "vitest";
import { nextDesignStep } from "~/lib/courses/wizard";
import { emptyCourseData } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";

const outcome = { id: "lo1", text: "De student ontwerpt een datamodel." };
const test = {
  id: "t1",
  title: "Ontwerp webwinkel",
  kind: "summative" as const,
  coverage: [{ outcomeId: "lo1" }],
};
const lesson = { id: "a1", title: "Kennismaken", kind: "lesson" as const, outcomeIds: ["lo1"] };
const course = (d: Partial<CourseData>): CourseData => ({ ...emptyCourseData(), ...d });

describe("nextDesignStep (the wizard runs on after each apply)", () => {
  it("proposes the test programme once the outcomes are in", () => {
    expect(nextDesignStep(course({ outcomes: [outcome] }))).toBe("design-assessments");
  });

  it("proposes the lesson series once the tests are in", () => {
    expect(nextDesignStep(course({ outcomes: [outcome], assessments: [test] }))).toBe(
      "design-lessons",
    );
  });

  it("stops when there is nothing left to propose", () => {
    expect(nextDesignStep(emptyCourseData())).toBeNull();
    expect(
      nextDesignStep(course({ outcomes: [outcome], assessments: [test], activities: [lesson] })),
    ).toBeNull();
  });
});
