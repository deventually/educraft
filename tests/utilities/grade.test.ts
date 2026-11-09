import { describe, it, expect } from "vitest";
import {
  cutScore,
  DEFAULT_SCALE,
  gradeTable,
  guessScore,
  parseGradeScale,
  pointsToGrade,
  type GradeScale,
} from "~/lib/utilities/grade";

const scale = (over: Partial<GradeScale> = {}): GradeScale => ({
  ...DEFAULT_SCALE,
  maxPoints: 30,
  ...over,
});

describe("grade calculator — defaults", () => {
  it("starts at 55 %, pass grade 5.5, grades 1–10, one decimal", () => {
    expect(DEFAULT_SCALE).toMatchObject({
      passPercent: 55,
      passGrade: 5.5,
      minGrade: 1,
      maxGrade: 10,
      decimals: 1,
    });
  });
});

describe("grade calculator — without guessing correction", () => {
  it("puts the cut score at maxPoints × passPercent", () => {
    expect(cutScore(scale())).toBeCloseTo(16.5);
  });

  it("maps the anchors: 0 → 1, cut → 5.5, max → 10", () => {
    expect(pointsToGrade(0, scale())).toBe(1);
    expect(pointsToGrade(16.5, scale())).toBe(5.5);
    expect(pointsToGrade(30, scale())).toBe(10);
  });

  it("is linear on each side of the cut score", () => {
    // Halfway between 16.5 and 30 is 23.25 → halfway between 5.5 and 10 is 7.75.
    expect(pointsToGrade(23.25, scale({ decimals: 2 }))).toBe(7.75);
    // Halfway between 0 and 16.5 → halfway between 1 and 5.5 = 3.25.
    expect(pointsToGrade(8.25, scale({ decimals: 2 }))).toBe(3.25);
  });
});

describe("grade calculator — guessing correction (multiple choice)", () => {
  const mc = scale({ maxPoints: 40, guessing: { options: 4 } });

  it("computes the guess score as maxPoints / options", () => {
    expect(guessScore(mc)).toBe(10);
    expect(guessScore(scale())).toBe(0);
  });

  it("puts the cut score above the guess score", () => {
    expect(cutScore(mc)).toBeCloseTo(26.5);
  });

  it("gives the minimum grade up to the guess score and 5.5 at the cut", () => {
    expect(pointsToGrade(0, mc)).toBe(1);
    expect(pointsToGrade(10, mc)).toBe(1);
    expect(pointsToGrade(26.5, mc)).toBe(5.5);
    expect(pointsToGrade(40, mc)).toBe(10);
  });
});

describe("grade calculator — rounding and bounds", () => {
  it("rounds to 0, 1 or 2 decimals", () => {
    // 7 / 30: (7/16.5)*4.5 + 1 = 2.90909…
    expect(pointsToGrade(7, scale({ decimals: 0 }))).toBe(3);
    expect(pointsToGrade(7, scale({ decimals: 1 }))).toBe(2.9);
    expect(pointsToGrade(7, scale({ decimals: 2 }))).toBe(2.91);
  });

  it("rounds a half up, without floating-point surprises", () => {
    // 1.05 must round to 1.1, not 1.0.
    // 180 points, 50 % → cut 90; 1 point = 1 + 4.5/90 = 1.05.
    const s = scale({ maxPoints: 180, passPercent: 50 });
    expect(pointsToGrade(1, s)).toBe(1.1);
  });

  it("is monotonic and stays within bounds over the whole table", () => {
    for (const s of [
      scale(),
      scale({ maxPoints: 40, guessing: { options: 3 } }),
      scale({ maxPoints: 7 }),
    ]) {
      const rows = gradeTable(s);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i]!.grade).toBeGreaterThanOrEqual(rows[i - 1]!.grade);
      }
      for (const r of rows) {
        expect(r.grade).toBeGreaterThanOrEqual(s.minGrade);
        expect(r.grade).toBeLessThanOrEqual(s.maxGrade);
      }
    }
  });

  it("lists every whole point from 0 to max, and the max itself", () => {
    expect(gradeTable(scale()).map((r) => r.points)).toEqual(
      Array.from({ length: 31 }, (_, i) => i),
    );
    const half = gradeTable(scale({ maxPoints: 7.5 }));
    expect(half.at(-1)).toEqual({ points: 7.5, grade: 10 });
    expect(half).toHaveLength(9);
  });
});

describe("grade calculator — invalid input", () => {
  const ok = { ...DEFAULT_SCALE, maxPoints: 30 };

  it("accepts a valid scale", () => {
    expect(parseGradeScale(ok)).toEqual({ ok: true, scale: ok });
  });

  it.each([
    [{ maxPoints: 0 }, "maxPoints"],
    [{ maxPoints: -5 }, "maxPoints"],
    [{ maxPoints: Number.NaN }, "maxPoints"],
    [{ passPercent: 0 }, "passPercent"],
    [{ passPercent: 100 }, "passPercent"],
    [{ minGrade: 10, maxGrade: 1 }, "gradeOrder"],
    [{ passGrade: 11 }, "gradeOrder"],
    [{ guessing: { options: 1 } }, "options"],
  ])("refuses %o with a named error", (over, error) => {
    const result = parseGradeScale({ ...ok, ...over });
    expect(result).toEqual({ ok: false, error });
  });

  it("throws on points below 0 or above the maximum", () => {
    expect(() => pointsToGrade(-1, scale())).toThrow();
    expect(() => pointsToGrade(31, scale())).toThrow();
  });
});
