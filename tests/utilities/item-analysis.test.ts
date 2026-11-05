import { describe, expect, it } from "vitest";
import { analyse, parseScores, type ScoreTable } from "~/lib/utilities/item-analysis";

/**
 * P24.5a — item analysis in code. Every expected value below is worked out by hand in the
 * comment above it, so the test does not just repeat the implementation.
 */

// Four candidates, three right/wrong questions:
//   A: 1 1 1 (3)   B: 1 1 0 (2)   C: 1 0 0 (1)   D: 0 0 0 (0)
const small: ScoreTable = {
  items: ["V1", "V2", "V3"],
  maxPoints: [1, 1, 1],
  scores: [
    [1, 1, 1],
    [1, 1, 0],
    [1, 0, 0],
    [0, 0, 0],
  ],
};

describe("analyse: classical item statistics", () => {
  const stats = analyse(small);

  it("counts candidates and questions", () => {
    expect(stats.candidates).toBe(4);
    expect(stats.items).toHaveLength(3);
    expect(stats.maxTotal).toBe(3);
  });

  it("gives the p-value: the mean score as a share of the maximum", () => {
    // V1: 3 of 4 right = 0.75; V2: 2 of 4 = 0.5; V3: 1 of 4 = 0.25.
    expect(stats.items.map((i) => i.p)).toEqual([0.75, 0.5, 0.25]);
  });

  it("gives the mean and standard deviation of the total score", () => {
    // Totals 3, 2, 1, 0: mean 1.5; squared deviations 2.25+0.25+0.25+2.25 = 5;
    // sample variance 5/3, sd = sqrt(5/3) = 1.2910.
    expect(stats.meanTotal).toBe(1.5);
    expect(stats.sdTotal).toBeCloseTo(1.291, 3);
  });

  it("gives Rit: the correlation of the question with the total score", () => {
    // V1 = (1,1,1,0), deviations (.25,.25,.25,-.75), sum of squares 0.75.
    // Total deviations (1.5,.5,-.5,-1.5), sum of squares 5.
    // Cross products: .375+.125-.125+1.125 = 1.5 → r = 1.5 / sqrt(0.75 × 5) = 0.7746.
    // V2 = (1,1,0,0): cross products .75+.25+.25+.75 = 2, SS 1 → r = 2 / sqrt(5) = 0.8944.
    expect(stats.items[0]?.rit).toBeCloseTo(0.7746, 4);
    expect(stats.items[1]?.rit).toBeCloseTo(0.8944, 4);
    expect(stats.items[2]?.rit).toBeCloseTo(0.7746, 4);
  });

  it("gives Rir: the correlation with the total of the other questions", () => {
    // V1 against V2+V3 = (2,1,0,0): mean .75, deviations (1.25,.25,-.75,-.75), SS 2.75.
    // Cross products with V1: .3125+.0625-.1875+.5625 = .75 → r = .75 / sqrt(.75 × 2.75) = 0.5222.
    expect(stats.items[0]?.rir).toBeCloseTo(0.5222, 4);
  });

  it("gives Cronbach's alpha", () => {
    // Item variances (sample) .25, 1/3, .25 → sum 5/6; total variance 5/3.
    // alpha = 3/2 × (1 − (5/6)/(5/3)) = 1.5 × 0.5 = 0.75.
    expect(stats.alpha).toBeCloseTo(0.75, 10);
  });

  it("gives alpha if the question is left out", () => {
    // Without V1: V2 (variance 1/3) and V3 (variance .25); rest total (2,1,0,0) has
    // variance 2.75/3. alpha = 2 × (1 − (7/12)/(11/12)) = 2 × 4/11 = 0.7273.
    expect(stats.items[0]?.alphaIfDeleted).toBeCloseTo(8 / 11, 10);
  });

  it("gives an alpha of 1 for two identical questions", () => {
    // k = 2, item variances v + v, total variance 4v → 2 × (1 − 2v/4v) = 1.
    const twin = analyse({
      items: ["a", "b"],
      maxPoints: [2, 2],
      scores: [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
    });
    expect(twin.alpha).toBeCloseTo(1, 10);
  });

  it("uses the maximum per question for p with points other than 1", () => {
    // Scores 2, 4, 0 of 4: mean 2 → p = 0.5.
    const open = analyse({
      items: ["a", "b"],
      maxPoints: [4, 1],
      scores: [
        [2, 1],
        [4, 1],
        [0, 0],
      ],
    });
    expect(open.items[0]?.p).toBe(0.5);
    expect(open.maxTotal).toBe(5);
  });

  it("leaves Rit and Rir empty for a question everyone scored the same on", () => {
    const flat = analyse({
      items: ["a", "b"],
      maxPoints: [1, 1],
      scores: [
        [1, 1],
        [1, 0],
        [1, 0],
      ],
    });
    expect(flat.items[0]?.p).toBe(1);
    expect(flat.items[0]?.rit).toBeNull();
    expect(flat.items[0]?.rir).toBeNull();
  });

  it("leaves alpha empty when every total is the same", () => {
    const same = analyse({
      items: ["a", "b"],
      maxPoints: [1, 1],
      scores: [
        [1, 0],
        [0, 1],
      ],
    });
    expect(same.alpha).toBeNull();
  });

  it("shows a negative Rit for a question the strong candidates get wrong", () => {
    const keyed = analyse({
      items: ["a", "b", "c"],
      maxPoints: [1, 1, 1],
      scores: [
        [1, 1, 0],
        [1, 1, 0],
        [0, 0, 1],
        [0, 0, 1],
      ],
    });
    expect(keyed.items[2]?.rir).toBeLessThan(0);
  });
});

describe("parseScores: a pasted score list", () => {
  it("reads tab-separated rows from a spreadsheet, with a header", () => {
    const r = parseScores("V1\tV2\tV3\n1\t1\t1\n1\t1\t0\n1\t0\t0\n0\t0\t0");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.items).toEqual(["V1", "V2", "V3"]);
    expect(r.table.scores).toHaveLength(4);
    expect(r.table.maxPoints).toEqual([1, 1, 1]);
    expect(r.maxFromData).toBe(true);
  });

  it("numbers the questions itself when there is no header", () => {
    const r = parseScores("1;0\n0;1\n1;1");
    expect(r.ok && r.table.items).toEqual(["1", "2"]);
  });

  it("reads semicolons and a decimal comma (Dutch Excel export)", () => {
    const r = parseScores("a;b\n1,5;2\n0,5;0\n2;1");
    expect(r.ok && r.table.scores[0]).toEqual([1.5, 2]);
  });

  it("removes a column with names, says so, and never keeps the names", () => {
    const r = parseScores("Naam\tV1\tV2\nJan de Vries\t1\t0\nFatima Bakker\t0\t1\nPiet\t1\t1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.removedColumns).toEqual(["Naam"]);
    expect(r.table.items).toEqual(["V1", "V2"]);
    expect(JSON.stringify(r)).not.toContain("Jan");
    expect(JSON.stringify(r)).not.toContain("Fatima");
  });

  it("removes a column of student numbers, also when it is all digits", () => {
    const r = parseScores("Studentnummer\tV1\tV2\n1234567\t1\t0\n2345678\t0\t1\n3456789\t1\t1");
    expect(r.ok && r.removedColumns).toEqual(["Studentnummer"]);
    expect(r.ok && JSON.stringify(r.table)).not.toContain("1234567");
  });

  it("removes a column that looks like student numbers without a header", () => {
    const r = parseScores("1234567\t1\t0\n2345678\t0\t1\n3456789\t1\t1");
    expect(r.ok && r.removedColumns).toEqual(["1"]);
    expect(r.ok && r.table.items).toEqual(["2", "3"]);
  });

  it("counts empty cells as 0 points and says how many", () => {
    const r = parseScores("V1\tV2\n1\t\n0\t1\n1\t1");
    expect(r.ok && r.blanks).toBe(1);
    expect(r.ok && r.table.scores[0]).toEqual([1, 0]);
  });

  it("uses one maximum for every question, or one per question", () => {
    const one = parseScores("1\t2\n0\t1\n2\t0", "2");
    expect(one.ok && one.table.maxPoints).toEqual([2, 2]);
    expect(one.ok && one.maxFromData).toBe(false);
    const each = parseScores("1\t2\n0\t1\n2\t0", "2; 3");
    expect(each.ok && each.table.maxPoints).toEqual([2, 3]);
  });

  it("refuses a score above the given maximum", () => {
    const r = parseScores("1\t4\n0\t1\n1\t0", "1; 3");
    expect(r).toEqual({ ok: false, error: "aboveMax" });
  });

  it("refuses a list of maxima that does not match the questions", () => {
    expect(parseScores("1\t1\n0\t1\n1\t0", "1; 1; 1")).toEqual({ ok: false, error: "maxCount" });
  });

  it("refuses negative scores", () => {
    expect(parseScores("1\t-1\n0\t1\n1\t0")).toEqual({ ok: false, error: "negative" });
  });

  it("needs at least three candidates and two questions", () => {
    expect(parseScores("")).toEqual({ ok: false, error: "empty" });
    expect(parseScores("1\t0\n0\t1")).toEqual({ ok: false, error: "tooFewCandidates" });
    expect(parseScores("1\n0\n1")).toEqual({ ok: false, error: "tooFewItems" });
  });

  it("refuses a list that is too large to work with in a browser", () => {
    const row = Array.from({ length: 201 }, () => "1").join("\t");
    expect(parseScores([row, row, row].join("\n"))).toEqual({ ok: false, error: "tooLarge" });
  });
});
