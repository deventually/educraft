import { describe, it, expect } from "vitest";
import { maxPoints, RubricDataSchema, RUBRIC_LIMITS } from "~/lib/utilities/rubric";
import { sampleRubric, uuid } from "./fixtures";

const level = (points = 0) => ({ id: uuid(), label: "L", points, description: "" });
const criterion = (levels = [level(0), level(1)]) => ({ id: uuid(), title: "C", levels });

describe("RubricDataSchema", () => {
  it("parses a valid rubric", () => {
    const data = sampleRubric();
    expect(RubricDataSchema.parse(data)).toEqual(data);
  });

  it("caps criteria at 30 and needs at least one", () => {
    expect(RUBRIC_LIMITS.criteria).toBe(30);
    const many = { criteria: Array.from({ length: 31 }, () => criterion()) };
    expect(RubricDataSchema.safeParse(many).success).toBe(false);
    expect(RubricDataSchema.safeParse({ criteria: [] }).success).toBe(false);
  });

  it("needs 2 to 6 levels per criterion", () => {
    expect(RubricDataSchema.safeParse({ criteria: [criterion([level()])] }).success).toBe(false);
    const seven = Array.from({ length: 7 }, () => level());
    expect(RubricDataSchema.safeParse({ criteria: [criterion(seven)] }).success).toBe(false);
    const six = Array.from({ length: 6 }, () => level());
    expect(RubricDataSchema.safeParse({ criteria: [criterion(six)] }).success).toBe(true);
  });

  it("limits text, titles, points and weight", () => {
    const d = sampleRubric();
    d.criteria[0].levels[0].description = "x".repeat(1001);
    expect(RubricDataSchema.safeParse(d).success).toBe(false);
    const t = sampleRubric();
    t.criteria[0].title = "x".repeat(201);
    expect(RubricDataSchema.safeParse(t).success).toBe(false);
    const p = sampleRubric();
    p.criteria[0].levels[0].points = 101;
    expect(RubricDataSchema.safeParse(p).success).toBe(false);
    const neg = sampleRubric();
    neg.criteria[0].levels[0].points = -1;
    expect(RubricDataSchema.safeParse(neg).success).toBe(false);
    const w = sampleRubric();
    w.criteria[0].weight = 101;
    expect(RubricDataSchema.safeParse(w).success).toBe(false);
  });

  it("requires UUID ids, unique within the rubric", () => {
    const bad = sampleRubric();
    bad.criteria[0].id = "not-a-uuid";
    expect(RubricDataSchema.safeParse(bad).success).toBe(false);
    const dup = sampleRubric();
    dup.criteria[1].id = dup.criteria[0].id;
    expect(RubricDataSchema.safeParse(dup).success).toBe(false);
    const dupLevel = sampleRubric();
    dupLevel.criteria[0].levels[1].id = dupLevel.criteria[0].levels[0].id;
    expect(RubricDataSchema.safeParse(dupLevel).success).toBe(false);
  });

  it("refuses unknown keys", () => {
    const d = { ...sampleRubric(), studentName: "x" };
    expect(RubricDataSchema.safeParse(d).success).toBe(false);
  });
});

describe("maxPoints", () => {
  it("adds the highest level of each criterion", () => {
    expect(maxPoints(sampleRubric())).toBe(5);
  });

  it("multiplies by a criterion's weight (default 1)", () => {
    const d = sampleRubric();
    d.criteria[0].weight = 2;
    expect(maxPoints(d)).toBe(9);
  });

  it("does not depend on level order", () => {
    const d = sampleRubric();
    d.criteria[0].levels.reverse();
    expect(maxPoints(d)).toBe(5);
  });
});
