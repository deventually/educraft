import { describe, expect, it } from "vitest";
import { checkAlignment, coverageMatrix, effectiveCoverage } from "~/lib/courses/alignment";
import { CourseDataSchema, COURSE_LIMITS } from "~/lib/courses/schema";
import * as edit from "~/lib/courses/edit";
import { itemTotals } from "~/lib/courses/items";
import { alignedCourse, itemizedCourse, LO1, LO2, QUIZ, TEST1 } from "./fixtures";

const parses = (d: unknown) => CourseDataSchema.safeParse(d).success;
const finalTest = (d = itemizedCourse()) => d.assessments.find((a) => a.id === TEST1)!;

describe("assessment items: the schema (P26.1)", () => {
  it("accepts items, and old data without items stays valid", () => {
    expect(parses(itemizedCourse())).toBe(true);
    expect(parses(alignedCourse())).toBe(true);
  });

  it("rejects an item that points at an unknown outcome", () => {
    const d = itemizedCourse();
    finalTest(d).items![0].outcomeId = "ghost";
    expect(parses(d)).toBe(false);
  });

  it("rejects a duplicate item id", () => {
    const d = itemizedCourse();
    finalTest(d).items![1].id = "q-1";
    expect(parses(d)).toBe(false);
  });

  it("enforces the item limits: 200 per assessment, label ≤ 20, points 0–1 000", () => {
    const tooMany = itemizedCourse();
    finalTest(tooMany).items = Array.from({ length: COURSE_LIMITS.items + 1 }, (_, i) => ({
      id: `q${i}`,
      label: String(i + 1),
      outcomeId: LO1,
    }));
    expect(COURSE_LIMITS.items).toBe(200);
    expect(parses(tooMany)).toBe(false);

    const longLabel = itemizedCourse();
    finalTest(longLabel).items![0].label = "x".repeat(21);
    expect(parses(longLabel)).toBe(false);

    const points = itemizedCourse();
    finalTest(points).items![0].points = 1_001;
    expect(parses(points)).toBe(false);
    finalTest(points).items![0].points = -1;
    expect(parses(points)).toBe(false);

    const format = itemizedCourse();
    // biome-ignore lint/suspicious/noExplicitAny: an invalid value on purpose
    (finalTest(format).items![0] as any).format = "essay";
    expect(parses(format)).toBe(false);
  });
});

describe("effectiveCoverage: the items are the one source of truth", () => {
  it("without items, the P20 coverage holds unchanged", () => {
    const a = alignedCourse().assessments[1];
    expect(effectiveCoverage(a)).toEqual(a.coverage);
    expect(effectiveCoverage({ ...a, items: [] })).toEqual(a.coverage);
  });

  it("with items, coverage follows the items: per outcome the lowest Bloom level", () => {
    const a = finalTest();
    a.coverage = [{ outcomeId: LO2, bloom: "create" }]; // ignored now
    expect(effectiveCoverage(a)).toEqual([
      { outcomeId: LO1, bloom: "create" },
      { outcomeId: LO2, bloom: "understand" },
    ]);
  });

  it("an outcome whose items have no level is covered without a level", () => {
    const a = finalTest();
    a.items = [{ id: "q", label: "1", outcomeId: LO2 }];
    expect(effectiveCoverage(a)).toEqual([{ outcomeId: LO2 }]);
  });

  it("the matrix uses it and counts the questions per cell", () => {
    const m = coverageMatrix(itemizedCourse());
    const col = m.columns.findIndex((c) => c.id === TEST1);
    expect(m.rows[0].cells[col]).toEqual({ covered: true, bloom: "create", items: 2 });
    expect(m.rows[1].cells[col]).toEqual({ covered: true, bloom: "understand", items: 2 });
    const quiz = m.columns.findIndex((c) => c.id === QUIZ);
    expect(m.rows[1].cells[quiz]).toEqual({ covered: true, bloom: "understand" });
  });

  it("checkAlignment uses it: coverage set by hand is ignored once there are items", () => {
    const d = itemizedCourse();
    finalTest(d).items = finalTest(d).items!.filter((i) => i.outcomeId === LO1);
    expect(checkAlignment(d).map((f) => f.code)).toEqual(["outcome-not-assessed"]);
  });
});

describe("question-level findings (after the P20 findings)", () => {
  it("an itemized aligned course has no findings", () => {
    expect(checkAlignment(itemizedCourse())).toEqual([]);
  });

  it("outcome-single-item: a summative test assesses an outcome with exactly one question", () => {
    const d = itemizedCourse();
    finalTest(d).items = finalTest(d).items!.filter((i) => i.id !== "q-2");
    expect(checkAlignment(d)).toEqual([
      { code: "outcome-single-item", severity: "warning", outcomeId: LO1, itemId: TEST1 },
    ]);
  });

  it("outcome-single-item stays quiet for a formative test", () => {
    const d = itemizedCourse();
    d.assessments[0].items = [{ id: "f1", label: "1", outcomeId: LO2, bloom: "understand" }];
    expect(checkAlignment(d)).toEqual([]);
  });

  it("item-bloom-below-outcome: a question ranks below its outcome, and replaces bloom-below-outcome", () => {
    const d = itemizedCourse();
    finalTest(d).items![1].bloom = "apply";
    expect(checkAlignment(d)).toEqual([
      {
        code: "item-bloom-below-outcome",
        severity: "warning",
        outcomeId: LO1,
        itemId: TEST1,
        questionId: "q-2",
      },
    ]);
  });

  it("item-bloom-below-outcome needs both levels", () => {
    const d = itemizedCourse();
    finalTest(d).items![1].bloom = undefined;
    d.outcomes[1].bloom = undefined;
    finalTest(d).items![3].bloom = "remember";
    expect(checkAlignment(d)).toEqual([]);
  });

  it("items-without-points: some questions have points and some do not", () => {
    const d = itemizedCourse();
    finalTest(d).items![2].points = undefined;
    expect(checkAlignment(d)).toEqual([
      { code: "items-without-points", severity: "info", itemId: TEST1 },
    ]);
    for (const i of finalTest(d).items!) i.points = undefined;
    expect(checkAlignment(d)).toEqual([]);
  });

  it("comes after the P20 findings, in a fixed order", () => {
    const d = itemizedCourse();
    d.assessments[1].weight = 60;
    finalTest(d).items = [
      { id: "a", label: "1", outcomeId: LO1, bloom: "apply", points: 1 },
      { id: "b", label: "2", outcomeId: LO2, bloom: "analyze" },
      { id: "c", label: "3", outcomeId: LO2, bloom: "analyze" },
    ];
    expect(checkAlignment(d).map((f) => f.code)).toEqual([
      "weights-not-100",
      "outcome-single-item",
      "item-bloom-below-outcome",
      "items-without-points",
    ]);
  });
});

describe("item edits", () => {
  it("adds, updates and removes an item without touching the input", () => {
    const start = alignedCourse();
    const snapshot = JSON.stringify(start);
    let d = edit.addItem(start, TEST1, { label: "1", outcomeId: LO1, points: 4 });
    expect(JSON.stringify(start)).toBe(snapshot);
    const item = finalTest(d).items![0];
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    d = edit.updateItem(d, TEST1, item.id, { bloom: "create", points: undefined });
    expect(finalTest(d).items![0]).toEqual({
      id: item.id,
      label: "1",
      outcomeId: LO1,
      bloom: "create",
    });
    d = edit.removeItem(d, TEST1, item.id);
    expect(finalTest(d).items).toEqual([]);
    expect(parses(d)).toBe(true);
  });

  it("setAssessmentItems replaces the matrix with fresh ids", () => {
    const d = edit.setAssessmentItems(itemizedCourse(), TEST1, [
      { label: "1", outcomeId: LO2, format: "open" },
    ]);
    expect(finalTest(d).items).toHaveLength(1);
    expect(finalTest(d).items![0].id).not.toBe("q-1");
    expect(parses(d)).toBe(true);
  });

  it("refuses unknown assessments, items and outcomes", () => {
    const d = itemizedCourse();
    expect(() => edit.addItem(d, "nope", { label: "1", outcomeId: LO1 })).toThrow();
    expect(() => edit.addItem(d, TEST1, { label: "1", outcomeId: "ghost" })).toThrow();
    expect(() => edit.updateItem(d, TEST1, "nope", { label: "x" })).toThrow();
    expect(() => edit.updateItem(d, TEST1, "q-1", { outcomeId: "ghost" })).toThrow();
    expect(() => edit.removeItem(d, TEST1, "nope")).toThrow();
    expect(() => edit.setAssessmentItems(d, TEST1, [{ label: "1", outcomeId: "x" }])).toThrow();
  });

  it("removeOutcome also removes the questions that point at it", () => {
    const d = edit.removeOutcome(itemizedCourse(), LO2);
    expect(finalTest(d).items!.map((i) => i.id)).toEqual(["q-1", "q-2"]);
    expect(parses(d)).toBe(true);
  });
});

describe("itemTotals (the total row of the matrix)", () => {
  it("counts questions and points, with each outcome's share of the points", () => {
    expect(itemTotals(finalTest())).toEqual({
      count: 4,
      points: 25,
      byOutcome: [
        { outcomeId: LO1, count: 2, points: 20, share: 80 },
        { outcomeId: LO2, count: 2, points: 5, share: 20 },
      ],
    });
  });

  it("without points, the share is by number of questions", () => {
    const a = finalTest();
    a.items = a.items!.slice(0, 3).map(({ points: _, ...i }) => i);
    expect(itemTotals(a)).toEqual({
      count: 3,
      points: 0,
      byOutcome: [
        { outcomeId: LO1, count: 2, points: 0, share: 67 },
        { outcomeId: LO2, count: 1, points: 0, share: 33 },
      ],
    });
  });

  it("an assessment without items has empty totals", () => {
    expect(itemTotals(alignedCourse().assessments[0])).toEqual({
      count: 0,
      points: 0,
      byOutcome: [],
    });
  });
});
