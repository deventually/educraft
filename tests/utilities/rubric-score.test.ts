import { describe, it, expect } from "vitest";
import {
  DEFAULT_RUBRIC_GRADE,
  levelDistribution,
  MIN_SCORES_FOR_INSIGHT,
  RubricDataSchema,
  RubricScoreSchema,
  rubricGrade,
  scoreRubric,
  toScore,
  type RubricData,
} from "~/lib/utilities/rubric";
import { sampleRubric } from "./fixtures";

/** Pick level `i` (by position) for every criterion: [0, 1] → first criterion level 0, second level 1. */
function pick(data: RubricData, positions: number[]): Record<string, string> {
  return Object.fromEntries(data.criteria.map((c, i) => [c.id, c.levels[positions[i]].id]));
}

describe("scoreRubric", () => {
  it("adds the points of the chosen levels", () => {
    const d = sampleRubric(); // Analyse 0/2/4, Bronnen (knockout) 0/1 → max 5
    const s = scoreRubric(d, pick(d, [2, 1]));
    expect(s.total).toBe(5);
    expect(s.max).toBe(5);
    expect(s.complete).toBe(true);
    expect(s.knockoutFailed).toBe(false);
  });

  it("multiplies by the weight", () => {
    const d = sampleRubric();
    d.criteria[0].weight = 2;
    const s = scoreRubric(d, pick(d, [1, 1]));
    expect(s.total).toBe(5); // 2×2 + 1
    expect(s.max).toBe(9); // 4×2 + 1
  });

  it("is incomplete until every criterion has a level, and has no grade or result then", () => {
    const d = sampleRubric();
    const s = scoreRubric(d, { [d.criteria[0].id]: d.criteria[0].levels[2].id });
    expect(s.complete).toBe(false);
    expect(s.total).toBe(4);
    expect(s.grade).toBeNull();
    expect(s.passed).toBeNull();
  });

  it("ignores ids that are not in the rubric", () => {
    const d = sampleRubric();
    const s = scoreRubric(d, { ...pick(d, [2, 1]), "not-a-criterion": "x" });
    expect(s.total).toBe(5);
    const wrongLevel = { [d.criteria[0].id]: d.criteria[1].levels[1].id };
    expect(scoreRubric(d, wrongLevel).total).toBe(0);
  });

  it("turns the total into a grade with the calculator", () => {
    const d = sampleRubric();
    // max 5, 55 % → cut 2.75; 5 → 10, 0 → 1.
    expect(scoreRubric(d, pick(d, [2, 1])).grade).toBe(10);
    expect(scoreRubric(d, pick(d, [0, 1])).grade).toBe(rubricGradeOf(d, 1));
  });

  it("uses the grade settings stored on the rubric", () => {
    const d = sampleRubric();
    d.grade = { ...DEFAULT_RUBRIC_GRADE, decimals: 0 };
    expect(scoreRubric(d, pick(d, [1, 1])).grade).toBe(Math.round(rubricGradeOf(d, 3)));
  });

  it("fails on a knock-out criterion at its lowest level, whatever the total", () => {
    const d = sampleRubric();
    const s = scoreRubric(d, pick(d, [2, 0])); // 4 of 5 points: an 8, but Bronnen is missing
    expect(s.knockoutFailed).toBe(true);
    expect(s.grade).toBe(8);
    expect(s.passed).toBe(false);
  });

  it("ignores the knock-out when the pass rule is the total only", () => {
    const d = sampleRubric();
    d.passRule = "total";
    const s = scoreRubric(d, pick(d, [2, 0]));
    expect(s.knockoutFailed).toBe(false);
    expect(s.passed).toBe(true);
  });

  it("passes at or above the pass grade", () => {
    const d = sampleRubric();
    expect(scoreRubric(d, pick(d, [1, 1])).passed).toBe(true); // 3 ≥ 2.75
    d.criteria[1].knockout = false;
    expect(scoreRubric(d, pick(d, [1, 0])).passed).toBe(false); // 2 < 2.75
  });

  it("gives no grade when the maximum is 0", () => {
    const d = sampleRubric();
    for (const c of d.criteria) for (const l of c.levels) l.points = 0;
    const s = scoreRubric(d, pick(d, [0, 0]));
    expect(s.grade).toBeNull();
  });
});

function rubricGradeOf(d: RubricData, total: number): number {
  const g = rubricGrade(d, total);
  if (g === null) throw new Error("no grade");
  return g;
}

describe("grade settings on a rubric", () => {
  it("default to the calculator's starting values", () => {
    expect(DEFAULT_RUBRIC_GRADE).toEqual({
      passPercent: 55,
      passGrade: 5.5,
      minGrade: 1,
      maxGrade: 10,
      decimals: 1,
    });
  });

  it("are validated by the rubric schema", () => {
    const d = sampleRubric();
    expect(RubricDataSchema.safeParse({ ...d, grade: DEFAULT_RUBRIC_GRADE }).success).toBe(true);
    const bad = [
      { ...DEFAULT_RUBRIC_GRADE, passPercent: 100 },
      { ...DEFAULT_RUBRIC_GRADE, minGrade: 6 },
      { ...DEFAULT_RUBRIC_GRADE, decimals: 3 },
      { ...DEFAULT_RUBRIC_GRADE, extra: 1 },
    ];
    for (const grade of bad)
      expect(RubricDataSchema.safeParse({ ...d, grade }).success).toBe(false);
  });
});

describe("toScore (what the server may keep)", () => {
  it("is only criterion → level pairs for a complete fill-in", () => {
    const d = sampleRubric();
    const choice = pick(d, [2, 1]);
    expect(toScore(d, choice)).toEqual(
      d.criteria.map((c) => ({ criterionId: c.id, levelId: choice[c.id] })),
    );
  });

  it("is null when the fill-in is incomplete", () => {
    const d = sampleRubric();
    expect(toScore(d, { [d.criteria[0].id]: d.criteria[0].levels[0].id })).toBeNull();
  });

  it("the boundary refuses a name, a code, a comment or any other extra key", () => {
    const d = sampleRubric();
    const ok = toScore(d, pick(d, [0, 0]))!;
    expect(RubricScoreSchema.safeParse(ok).success).toBe(true);
    for (const extra of [{ name: "Sam" }, { code: 7 }, { comment: "goed" }]) {
      const bad = [{ ...ok[0], ...extra }, ...ok.slice(1)];
      expect(RubricScoreSchema.safeParse(bad).success).toBe(false);
    }
    expect(RubricScoreSchema.safeParse({ levels: ok, name: "Sam" }).success).toBe(false);
  });
});

describe("levelDistribution", () => {
  const scores = (d: RubricData, n: number) =>
    Array.from({ length: n }, (_, i) => toScore(d, pick(d, [i % 3, i % 2]))!);

  it(`shows nothing under ${MIN_SCORES_FOR_INSIGHT} closed fill-ins`, () => {
    expect(MIN_SCORES_FOR_INSIGHT).toBe(5);
    const d = sampleRubric();
    expect(levelDistribution(d, scores(d, 4))).toBeNull();
    expect(levelDistribution(d, [])).toBeNull();
  });

  it("counts how often each level was chosen, per criterion", () => {
    const d = sampleRubric();
    const dist = levelDistribution(d, scores(d, 5));
    expect(dist).not.toBeNull();
    expect(dist!.total).toBe(5);
    expect(dist!.criteria[0].levels.map((l) => l.count)).toEqual([2, 2, 1]);
    expect(dist!.criteria[1].levels.map((l) => l.count)).toEqual([3, 2]);
    expect(dist!.criteria[0].title).toBe("Analyse");
  });

  it("skips levels that no longer exist in the rubric", () => {
    const d = sampleRubric();
    const s = scores(d, 5);
    s[0][0] = { criterionId: d.criteria[0].id, levelId: "00000000-0000-4000-8000-999999999999" };
    const dist = levelDistribution(d, s)!;
    expect(dist.criteria[0].levels.reduce((n, l) => n + l.count, 0)).toBe(4);
  });
});
