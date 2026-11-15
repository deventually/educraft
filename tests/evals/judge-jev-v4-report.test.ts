import { describe, expect, it } from "vitest";
import {
  dimensionTests,
  judgeJevV4Report,
  labelSample,
  retestAgreement,
  rubricSentences,
  scoreSpread,
  type V4Row,
  withLabels,
} from "../../scripts/eval-judge-jev-v4-report";

const row = (over: Partial<V4Row>): V4Row => ({
  key: "rubric-builder/a#1",
  tool: "rubric-builder",
  caseId: "a",
  run: 1,
  set: "holdout",
  dim: "taskFidelity",
  ...over,
});

/** Four outputs of one tool: Bastiaan 5 4 3 4, Sonnet always 4, Jev 5 4 3 3. */
const four: V4Row[] = [
  row({ key: "t/a#1", caseId: "a", truth: 5, sonnet: 4, jev: 5, jevX: 4.8 }),
  row({ key: "t/b#1", caseId: "b", truth: 4, sonnet: 4, jev: 4, jevX: 4.2 }),
  row({ key: "t/c#1", caseId: "c", truth: 3, sonnet: 4, jev: 3, jevX: 3.3 }),
  row({ key: "t/d#1", caseId: "d", truth: 4, sonnet: 4, jev: 3, jevX: 3.4, parts: { a: 0, b: 1 } }),
];

const opts = { margin: 0.25, constant: 4, seed: 20261115, draws: 2000, minPairs: 3 };

describe("version 4 report: the tests per dimension", () => {
  it("test 1: the mean absolute error of Jev, Sonnet and the constant 4, on the same labelled outputs", () => {
    const t = dimensionTests(four, opts);
    expect(t.n).toBe(4);
    expect(t.mae.jev).toBeCloseTo(0.25);
    expect(t.mae.sonnet).toBeCloseTo(0.5);
    expect(t.mae.constant).toBeCloseTo(0.5);
    expect(t.test1.pass).toBe(true);
    expect(t.test1.diff).toBeCloseTo(-0.25);
    expect(t.test1.ci[0]).toBeLessThanOrEqual(t.test1.diff);
    expect(t.test1.ci[1]).toBeGreaterThanOrEqual(t.test1.diff);
    expect(t.test2.pass).toBe(true);
  });

  it("leaves out rows without a label, or where a judge gave no score, for both judges alike", () => {
    const t = dimensionTests(
      [
        ...four,
        row({ key: "t/e#1", sonnet: 4, jev: 1 }),
        row({ key: "t/f#1", truth: 1, sonnet: 4 }),
      ],
      opts,
    );
    expect(t.n).toBe(4);
    expect(t.missing).toBe(1);
  });

  it("gives an interval of zero when Jev and Sonnet give the same scores", () => {
    const same = four.map((r) => ({ ...r, jev: r.sonnet }));
    const t = dimensionTests(same, opts);
    expect(t.test1.ci).toEqual([0, 0]);
    expect(t.test1.confident).toBe(true);
  });

  it("test 3: concordance on same-tool pairs Bastiaan scores differently, a tie counted half", () => {
    const t = dimensionTests(four, opts);
    expect(t.test3.pairs).toBe(5);
    expect(t.test3.jev).toBeCloseTo(4.5 / 5);
    expect(t.test3.sonnet).toBeCloseTo(0.5);
    expect(t.test3.pass).toBe(true);
    const few = dimensionTests(four, { ...opts, minPairs: 10 });
    expect(few.test3.pass).toBeUndefined();
  });

  it("decides: replace when tests 1, 2 and 3 pass; with confidence when the upper bound stays in the margin", () => {
    const t = dimensionTests(four, opts);
    expect(t.decision).toMatch(/^(replace|confident)$/);
    const worse = four.map((r) => ({ ...r, jev: 1, jevX: 1 }));
    expect(dimensionTests(worse, opts).decision).toBe("no");
    expect(dimensionTests(four, { ...opts, minPairs: 10 }).decision).toBe("undecided");
  });

  it("test 4, 5 and 7: mean per tool, the share of the most given score, and how far off", () => {
    const t = dimensionTests(four, opts);
    expect(t.perTool.t ?? t.perTool["rubric-builder"]).toBeDefined();
    const pt = Object.values(t.perTool)[0];
    expect(pt?.truth).toBeCloseTo(4);
    expect(pt?.jev).toBeCloseTo(3.75);
    expect(pt?.sonnet).toBeCloseTo(4);
    expect(t.modeShare.sonnet).toBe(1);
    expect(t.modeShare.truth).toBe(0.5);
    expect(t.off.jev).toEqual({ exact: 3, one: 1, more: 0 });
    expect(t.off.sonnet).toEqual({ exact: 2, one: 2, more: 0 });
    // 3.4 against 4: off by 0.6, within 0.75 of Bastiaan's score
    expect(t.nearMisses.map((r) => r.key)).toEqual(["t/d#1"]);
    // too low, and part a (0) pulled it down
    expect(t.drivers).toEqual({ a: 1 });
  });
});

describe("version 4 report: labels and samples", () => {
  it("joins Bastiaan's labels to the rows; 'weet ik niet' (null) stays out", () => {
    const rows = [row({ key: "t/a#1" }), row({ key: "t/a#1", dim: "levelFit" })];
    const out = withLabels(rows, { "t/a#1": { taskFidelity: 4, levelFit: null } });
    expect(out[0]?.truth).toBe(4);
    expect(out[1]?.truth).toBeUndefined();
  });

  it("draws the same sample each time: one output per tool for the tuning set, five per tool with different cases for the test set", () => {
    const keys = ["a", "b", "c"].flatMap((t) =>
      ["x", "y", "z", "v", "w", "u"].flatMap((c) => [1, 2, 3].map((r) => `${t}/${c}#${r}`)),
    );
    const tuning = labelSample(keys, { perTool: 1, tools: 2, seed: 20261115 });
    expect(tuning).toHaveLength(2);
    expect(new Set(tuning.map((k) => k.split("/")[0])).size).toBe(2);
    expect(labelSample(keys, { perTool: 1, tools: 2, seed: 20261115 })).toEqual(tuning);
    const test = labelSample(keys, { perTool: 5, seed: 20261115 });
    expect(test).toHaveLength(15);
    for (const t of ["a", "b", "c"]) {
      const cases = test
        .filter((k) => k.startsWith(`${t}/`))
        .map((k) => k.split("/")[1]?.split("#")[0]);
      expect(new Set(cases).size).toBe(5);
    }
  });

  it("measures how well Bastiaan agrees with himself on the repeated outputs", () => {
    const r = retestAgreement(
      { "t/a#1": { taskFidelity: 4, levelFit: 3 } },
      { "t/a#1": { taskFidelity: 5, levelFit: 3 } },
    );
    expect(r.taskFidelity).toEqual({ n: 1, mae: 1 });
    expect(r.levelFit).toEqual({ n: 1, mae: 0 });
  });

  it("finds each dimension's sentence in a rubric", () => {
    const rubric = [
      "# Rubric",
      "",
      "- **taskFidelity** — Does it do the task?",
      "  And this too.",
      "- **formatAdherence** — Headings.",
      "",
      "## Hard checks",
      "",
      "- **x** (cap 2): y",
    ].join("\n");
    expect(rubricSentences(rubric)).toEqual({
      taskFidelity: "Does it do the task? And this too.",
      formatAdherence: "Headings.",
    });
  });
});

describe("version 4 report: what Jev's Scores look like", () => {
  it("per Score part: how many answers, the mean position, and how often each level was the most likely", () => {
    const s = scoreSpread([
      {
        part: "lesson-plan taskFidelity.ownGoal",
        levels: 3,
        score: 2,
        probabilities: { "0": 0, "1": 0.2, "2": 0.8 },
      },
      {
        part: "lesson-plan taskFidelity.ownGoal",
        levels: 3,
        score: 1,
        probabilities: { "0": 0.3, "1": 0.4, "2": 0.3 },
      },
    ]);
    expect(s).toEqual([
      {
        part: "lesson-plan taskFidelity.ownGoal",
        n: 2,
        meanPosition: 0.75,
        top: [0, 1, 1],
        meanTopP: 0.6,
      },
    ]);
  });
});

describe("version 4 report: the markdown", () => {
  it("names both judges with the same rules, the decision per dimension and the cost", () => {
    const md = judgeJevV4Report({
      date: "2026-11-20",
      jevModel: "typesafe/jev-1.14",
      judgeModel: "claude-code::claude-sonnet-5-5",
      source: "2026-11-15c3",
      read: "position",
      calls: 10,
      jevMs: [200],
      jevCostUsd: 0.1,
      outputs: 4,
      judgeCostUsd: 8,
      judgeOutputs: 100,
      rows: four,
      tests: opts,
    });
    expect(md).toContain("# Eval — Jev scoort de dimensies (versie 4)");
    expect(md).toContain("taskFidelity");
    expect(md).toContain("Altijd 4");
    expect(md).toMatch(/per 1\.000 uitvoer/);
    expect(md).toContain("$25.00"); // Jev: 0.1 / 4 × 1000
    expect(md).toContain("$80.00"); // Sonnet: 8 / 100 × 1000
    expect(md).toContain("te weinig labels");
  });
});
