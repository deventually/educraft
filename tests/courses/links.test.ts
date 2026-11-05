import { describe, expect, it } from "vitest";
import { alignedCourse, ACT1, ACT2, QUIZ, TEST1 } from "./fixtures";
import {
  linkTargets,
  linkTargetValue,
  linksByGeneration,
  parseLinkTarget,
} from "~/lib/courses/links";

const course = { id: "c1", name: "SE jaar 2", data: alignedCourse() };

describe("course link targets (P20, 20.4)", () => {
  it("offers every course with its activities, then its assessments", () => {
    expect(linkTargets([course])).toEqual([
      {
        courseId: "c1",
        courseName: "SE jaar 2",
        items: [
          { id: ACT1, title: "Les normaliseren" },
          { id: ACT2, title: "Opdracht datamodel" },
          { id: QUIZ, title: "Oefentoets" },
          { id: TEST1, title: "Eindopdracht" },
        ],
      },
    ]);
  });

  it("round-trips a target value, with and without an item", () => {
    expect(parseLinkTarget(linkTargetValue("c1"))).toEqual({ courseId: "c1", itemId: null });
    expect(parseLinkTarget(linkTargetValue("c1", TEST1))).toEqual({
      courseId: "c1",
      itemId: TEST1,
    });
  });

  it("rejects an empty or malformed target", () => {
    expect(parseLinkTarget("")).toBeNull();
    expect(parseLinkTarget("::x")).toBeNull();
    expect(parseLinkTarget("c1::")).toBeNull();
    expect(parseLinkTarget("a::b::c")).toBeNull();
  });

  it("groups links per generation with the course name and item title", () => {
    const links = [
      { courseId: "c1", generationId: "g1", itemId: TEST1 },
      { courseId: "c1", generationId: "g2", itemId: null },
      { courseId: "gone", generationId: "g1", itemId: null },
    ];
    expect(linksByGeneration(links, [course])).toEqual({
      g1: [{ courseId: "c1", courseName: "SE jaar 2", itemTitle: "Eindopdracht" }],
      g2: [{ courseId: "c1", courseName: "SE jaar 2", itemTitle: null }],
    });
  });
});
