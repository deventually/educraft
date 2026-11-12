import { describe, expect, it } from "vitest";
import {
  calibrate,
  MIN_WORKS_FOR_KAPPA,
  type RaterWork,
  type RubricData,
} from "~/lib/utilities/rubric";
import { sampleRubric, uuid } from "./fixtures";

/** A work scored at level positions (by rubric order) for each criterion. */
function work(data: RubricData, code: string, positions: number[]): RaterWork {
  return {
    code,
    choice: Object.fromEntries(
      positions.map((p, i) => [data.criteria[i]!.id, data.criteria[i]!.levels[p]!.id]),
    ),
  };
}

/** A rubric with one criterion of four ordered levels (0..3 points). */
function fourLevels(): RubricData {
  return {
    criteria: [
      {
        id: uuid(),
        title: "Argumentatie",
        levels: [0, 1, 2, 3].map((p) => ({
          id: uuid(),
          label: `N${p}`,
          points: p,
          description: "",
        })),
      },
    ],
  };
}

describe("calibrate: pairing works", () => {
  it("reports nothing for two empty lists", () => {
    const c = calibrate(sampleRubric(), [], []);
    expect(c.works).toEqual([]);
    expect(c.onlyA).toEqual([]);
    expect(c.onlyB).toEqual([]);
    expect(c.criteria.every((k) => k.works === 0 && k.kappa === null)).toBe(true);
    expect(c.agenda).toEqual([]);
  });

  it("pairs works on code (trimmed, case-insensitive) and reports a code only one rater has", () => {
    const d = sampleRubric();
    const c = calibrate(
      d,
      [work(d, "A1", [2, 1]), work(d, "A2", [1, 1])],
      [work(d, " a1 ", [2, 1]), work(d, "B9", [0, 0])],
    );
    expect(c.works.map((w) => w.code)).toEqual(["A1"]);
    expect(c.onlyA).toEqual(["A2"]);
    expect(c.onlyB).toEqual(["B9"]);
    expect(c.criteria[0]!.works).toBe(1);
  });

  it("counts a code twice in one list once (the first) and reports it", () => {
    const d = sampleRubric();
    const c = calibrate(d, [work(d, "A1", [2, 1]), work(d, "A1", [0, 0])], [work(d, "A1", [2, 1])]);
    expect(c.duplicates).toEqual(["A1"]);
    expect(c.criteria[0]!.exact).toBe(1);
  });

  it("ignores a work without a code", () => {
    const d = sampleRubric();
    const c = calibrate(d, [work(d, "  ", [2, 1])], [work(d, "", [2, 1])]);
    expect(c.works).toEqual([]);
    expect(c.onlyA).toEqual([]);
  });
});

describe("calibrate: per criterion", () => {
  it("counts exact agreement with its percentage", () => {
    const d = sampleRubric();
    const c = calibrate(
      d,
      [work(d, "A1", [2, 1]), work(d, "A2", [1, 0])],
      [work(d, "A1", [2, 1]), work(d, "A2", [2, 0])],
    );
    const analyse = c.criteria[0]!;
    expect(analyse).toMatchObject({
      title: "Analyse",
      works: 2,
      exact: 1,
      oneOff: 1,
      twoOrMore: 0,
    });
    expect(analyse.exactPercent).toBe(50);
    expect(c.criteria[1]).toMatchObject({ works: 2, exact: 2, exactPercent: 100 });
  });

  it("measures distance in ordered levels, by points, not by list position", () => {
    const d = fourLevels();
    d.criteria[0]!.levels.reverse(); // listed high → low; order still follows the points
    const top = d.criteria[0]!.levels[0]!.id; // 3 points
    const low = d.criteria[0]!.levels[3]!.id; // 0 points
    const next = d.criteria[0]!.levels[1]!.id; // 2 points
    const id = d.criteria[0]!.id;
    const c = calibrate(
      d,
      [
        { code: "A", choice: { [id]: top } },
        { code: "B", choice: { [id]: top } },
      ],
      [
        { code: "A", choice: { [id]: low } },
        { code: "B", choice: { [id]: next } },
      ],
    );
    expect(c.criteria[0]).toMatchObject({ exact: 0, oneOff: 1, twoOrMore: 1 });
  });

  it("leaves out a work where a rater gave no (or an unknown) level for that criterion", () => {
    const d = sampleRubric();
    const [analyse, bronnen] = d.criteria;
    const c = calibrate(
      d,
      [{ code: "A1", choice: { [analyse!.id]: analyse!.levels[0]!.id } }],
      [
        {
          code: "A1",
          choice: { [analyse!.id]: "not-a-level", [bronnen!.id]: bronnen!.levels[0]!.id },
        },
      ],
    );
    expect(c.criteria[0]!.works).toBe(0);
    expect(c.criteria[1]!.works).toBe(0);
    expect(c.criteria[0]!.exactPercent).toBeNull();
  });

  it("handles a criterion without levels: no works, no kappa", () => {
    const d = sampleRubric();
    d.criteria.push({ id: uuid(), title: "Leeg", levels: [] });
    const works = ["A", "B", "C", "D", "E"];
    const a = works.map((code) => work(d, code, [1, 1]));
    const c = calibrate(d, a, a);
    expect(c.criteria[2]).toMatchObject({ title: "Leeg", works: 0, kappa: null });
  });
});

describe("calibrate: weighted kappa", () => {
  const codes = ["A", "B", "C", "D", "E", "F", "G", "H"];

  it("is null below five works", () => {
    expect(MIN_WORKS_FOR_KAPPA).toBe(5);
    const d = fourLevels();
    const a = codes.slice(0, 4).map((code, i) => work(d, code, [i % 4]));
    expect(calibrate(d, a, a).criteria[0]!.kappa).toBeNull();
  });

  it("is 1 at perfect agreement, from five works", () => {
    const d = fourLevels();
    const a = codes.slice(0, 5).map((code, i) => work(d, code, [i % 4]));
    expect(calibrate(d, a, a).criteria[0]!.kappa).toBe(1);
  });

  it("is 1 when both raters chose the same single level for every work", () => {
    const d = fourLevels();
    const a = codes.slice(0, 5).map((code) => work(d, code, [2]));
    expect(calibrate(d, a, a).criteria[0]!.kappa).toBe(1);
  });

  it("is 0 when agreement is what chance predicts", () => {
    // A: 0,0,1,1 · B: 0,1,0,1 (×2) — independent marginals, linear weights → κw = 0.
    const d = fourLevels();
    const pa = [0, 0, 1, 1, 0, 0, 1, 1];
    const pb = [0, 1, 0, 1, 0, 1, 0, 1];
    const c = calibrate(
      d,
      codes.map((code, i) => work(d, code, [pa[i]!])),
      codes.map((code, i) => work(d, code, [pb[i]!])),
    );
    expect(c.criteria[0]!.kappa).toBeCloseTo(0, 10);
  });

  it("matches a hand-computed linear weighted kappa", () => {
    // Levels 0..3 (k=4, w = 1 − |i−j|/3). Pairs: (0,0) (1,1) (2,3) (3,3) (1,2).
    // po = (1 + 1 + 2/3 + 1 + 2/3)/5 = 13/15
    // A marginals: 0:1 1:2 2:1 3:1 · B marginals: 0:1 1:1 2:1 3:2 (each /5)
    // pe = Σ w_ij·a_i·b_j = 43/75 → κw = (65/75 − 43/75)/(32/75) = 11/16
    const d = fourLevels();
    const pa = [0, 1, 2, 3, 1];
    const pb = [0, 1, 3, 3, 2];
    const c = calibrate(
      d,
      pa.map((p, i) => work(d, codes[i]!, [p])),
      pb.map((p, i) => work(d, codes[i]!, [p])),
    );
    expect(c.criteria[0]!.kappa).toBeCloseTo(11 / 16, 10);
  });
});

describe("calibrate: grades per work", () => {
  it("gives the grade by both raters and the difference (B − A)", () => {
    const d = sampleRubric(); // max 5; defaults 55% → 5.5
    const c = calibrate(d, [work(d, "A1", [2, 1])], [work(d, "A1", [1, 1])]);
    const w = c.works[0]!;
    expect(w.gradeA).toBe(10);
    expect(w.gradeB).not.toBeNull();
    expect(w.difference).toBeCloseTo(w.gradeB! - 10, 10);
    expect(w.difference!).toBeLessThan(0);
  });

  it("has no grade or difference when a rater left a criterion open", () => {
    const d = sampleRubric();
    const c = calibrate(d, [work(d, "A1", [2, 1])], [{ code: "A1", choice: {} }]);
    expect(c.works[0]).toMatchObject({ gradeB: null, difference: null });
  });
});

describe("calibrate: the agenda", () => {
  it("puts the criteria with the biggest difference first, then the works, and leaves out agreement", () => {
    const d = sampleRubric();
    // Analyse: A1 two levels apart, A2 equal. Bronnen: A2 one level apart.
    const c = calibrate(
      d,
      [work(d, "A1", [0, 1]), work(d, "A2", [1, 1]), work(d, "A3", [1, 1])],
      [work(d, "A1", [2, 1]), work(d, "A2", [1, 0]), work(d, "A3", [1, 1])],
    );
    expect(c.agenda.map((r) => (r.kind === "criterion" ? r.title : r.code))).toEqual([
      "Analyse",
      "Bronnen",
      "A1",
      "A2",
    ]);
  });

  it("orders works by the size of the grade difference, either way", () => {
    const d = sampleRubric();
    const c = calibrate(
      d,
      [work(d, "A1", [1, 1]), work(d, "A2", [2, 1])],
      [work(d, "A1", [2, 1]), work(d, "A2", [0, 1])],
    );
    const works = c.agenda.filter((r) => r.kind === "work").map((r) => r.code);
    expect(works).toEqual(["A2", "A1"]);
  });

  it("has at most ten lines", () => {
    const d = fourLevels();
    const n = 20;
    const a = Array.from({ length: n }, (_, i) => work(d, `W${i}`, [0]));
    const b = Array.from({ length: n }, (_, i) => work(d, `W${i}`, [i % 3 === 0 ? 3 : 1]));
    expect(calibrate(d, a, b).agenda).toHaveLength(10);
  });
});
