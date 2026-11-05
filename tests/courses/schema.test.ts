import { describe, expect, it } from "vitest";
import { BLOOM_LEVELS, bloomLabel, bloomRank } from "~/lib/courses/bloom";
import { CourseDataSchema, COURSE_LIMITS, emptyCourseData } from "~/lib/courses/schema";
import { alignedCourse, LO1 } from "./fixtures";

const parses = (d: unknown) => CourseDataSchema.safeParse(d).success;

describe("CourseDataSchema (the boundary)", () => {
  it("accepts a valid course and the empty course", () => {
    expect(parses(alignedCourse())).toBe(true);
    expect(parses(emptyCourseData())).toBe(true);
  });

  it("rejects an activity that points at an unknown outcome", () => {
    const d = alignedCourse();
    d.activities[0].outcomeIds.push("ghost");
    expect(parses(d)).toBe(false);
  });

  it("rejects assessment coverage of an unknown outcome", () => {
    const d = alignedCourse();
    d.assessments[0].coverage.push({ outcomeId: "ghost" });
    expect(parses(d)).toBe(false);
  });

  it("rejects duplicate item ids", () => {
    const d = alignedCourse();
    d.activities[1].id = d.activities[0].id;
    expect(parses(d)).toBe(false);
  });

  it("enforces text, title, count, week and weight limits", () => {
    const tooLongText = alignedCourse();
    tooLongText.outcomes[0].text = "x".repeat(COURSE_LIMITS.text + 1);
    expect(parses(tooLongText)).toBe(false);

    const tooLongTitle = alignedCourse();
    tooLongTitle.activities[0].title = "x".repeat(COURSE_LIMITS.title + 1);
    expect(parses(tooLongTitle)).toBe(false);

    const tooMany = emptyCourseData();
    tooMany.outcomes = Array.from({ length: COURSE_LIMITS.outcomes + 1 }, (_, i) => ({
      id: `o${i}`,
      text: "t",
    }));
    expect(parses(tooMany)).toBe(false);

    const badWeek = alignedCourse();
    badWeek.activities[0].week = 61;
    expect(parses(badWeek)).toBe(false);

    const badWeight = alignedCourse();
    badWeight.assessments[1].weight = 101;
    expect(parses(badWeight)).toBe(false);
  });

  it("accepts study load (EC per course, hours per item) within limits", () => {
    const d = alignedCourse();
    d.ec = 5;
    d.activities[0].hours = 4;
    d.assessments[1].hours = 3;
    expect(parses(d)).toBe(true);
    expect(parses({ ...d, ec: 0 })).toBe(false);
    expect(parses({ ...d, ec: COURSE_LIMITS.ec + 1 })).toBe(false);
    d.activities[0].hours = -1;
    expect(parses(d)).toBe(false);
  });

  it("rejects an unknown Bloom level", () => {
    const d = alignedCourse() as unknown as { outcomes: { id: string; bloom: string }[] };
    d.outcomes.find((o) => o.id === LO1)!.bloom = "memorize";
    expect(parses(d)).toBe(false);
  });
});

describe("Bloom (revised taxonomy, Anderson & Krathwohl 2001)", () => {
  it("ranks the six levels from remember to create", () => {
    expect(BLOOM_LEVELS).toEqual([
      "remember",
      "understand",
      "apply",
      "analyze",
      "evaluate",
      "create",
    ]);
    expect(bloomRank("remember")).toBeLessThan(bloomRank("understand"));
    expect(bloomRank("evaluate")).toBeLessThan(bloomRank("create"));
  });

  it("has a Dutch and an English label for every level", () => {
    for (const level of BLOOM_LEVELS) {
      expect(bloomLabel(level, "nl")).not.toBe("");
      expect(bloomLabel(level, "en")).not.toBe("");
    }
    expect(bloomLabel("analyze", "nl")).toBe("analyseren");
    expect(bloomLabel("analyze", "en")).toBe("analyze");
  });
});
