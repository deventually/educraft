import { describe, expect, it } from "vitest";
import { buildReviewMessage, courseKeys } from "~/lib/agents/input";
import { checkAlignment } from "~/lib/courses/alignment";
import {
  ACT1,
  ACT2,
  LO1,
  LO2,
  QUIZ,
  TEST1,
  alignedCourse,
  itemizedCourse,
} from "../courses/fixtures";

describe("courseKeys (P21.1)", () => {
  it("maps short keys to real item ids, in course order", () => {
    expect(courseKeys(alignedCourse())).toEqual({
      L1: LO1,
      L2: LO2,
      A1: ACT1,
      A2: ACT2,
      T1: QUIZ,
      T2: TEST1,
    });
  });
});

describe("buildReviewMessage", () => {
  it("shows the course under short keys, never the stored ids", () => {
    const msg = buildReviewMessage({ course: alignedCourse(), alignment: [], rejected: [] }, "nl");
    expect(msg).toContain("L1");
    expect(msg).toContain("Je ontwerpt een datamodel.");
    expect(msg).toContain("Opdracht datamodel");
    expect(msg).toContain("Eindopdracht");
    expect(msg).toMatch(/T2[^\n]*L1 \(create\)/);
    expect(msg).not.toContain(LO1);
    expect(msg).not.toContain(TEST1);
  });

  it("shows the coverage that follows from the questions (P26.1)", () => {
    const msg = buildReviewMessage({ course: itemizedCourse(), alignment: [], rejected: [] }, "en");
    expect(msg).toMatch(/T2[^\n]*L1 \(create\), L2 \(understand\)/);
  });

  it("includes the study load when set", () => {
    const course = { ...alignedCourse(), ec: 5 };
    course.activities[0] = { ...course.activities[0]!, hours: 12 };
    const msg = buildReviewMessage({ course, alignment: [], rejected: [] }, "en");
    expect(msg).toContain("5 EC");
    expect(msg).toContain("12 h");
  });

  it("lists the deterministic findings so the hat does not repeat them", () => {
    const course = alignedCourse();
    course.assessments = course.assessments.filter((a) => a.id !== TEST1);
    const alignment = checkAlignment(course);
    const msg = buildReviewMessage({ course, alignment, rejected: [] }, "nl");
    expect(alignment.length).toBeGreaterThan(0);
    expect(msg).toContain("outcome-not-assessed: L1");
  });

  it("lists rejected findings so the hat does not raise them again", () => {
    const msg = buildReviewMessage(
      {
        course: alignedCourse(),
        alignment: [],
        rejected: [{ targetId: LO2, message: "Formulering is vaag." }],
      },
      "nl",
    );
    expect(msg).toContain("L2: Formulering is vaag.");
  });

  it("says 'none' for empty sections, in the requested language", () => {
    const nl = buildReviewMessage({ course: alignedCourse(), alignment: [], rejected: [] }, "nl");
    const en = buildReviewMessage({ course: alignedCourse(), alignment: [], rejected: [] }, "en");
    expect(nl).toContain("(geen)");
    expect(en).toContain("(none)");
  });
});
