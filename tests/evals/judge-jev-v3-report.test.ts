import { describe, expect, it } from "vitest";
import { rowKey } from "../../scripts/eval-judge-jev-helpers";
import { judgeJevV3Report, labelRows, type V3Row } from "../../scripts/eval-judge-jev-v3-report";

const row = (over: Partial<V3Row>): V3Row => ({
  tool: "visit-prep",
  caseId: "a",
  run: 1,
  check: "judged",
  set: "holdout",
  family: "act",
  judge: false,
  v2: "pass",
  v3: "pass",
  ...over,
});

const base = {
  date: "2026-11-20",
  jevModel: "typesafe/jev-1.14",
  judgeModel: "claude-code::claude-sonnet-5-5",
  source: "2026-11-20c2",
  order: {
    tuning: { same: 0, total: 0 },
    holdout: { same: 96, total: 100 },
    fresh: { same: 19, total: 20 },
  },
  calls: 10,
  jevMs: [100],
  jevCostUsd: 0.5,
};

describe("the version 3 report", () => {
  it("compares version 2 and 3 per set without labels, the fresh holdout without version 2", () => {
    const md = judgeJevV3Report({
      ...base,
      rows: [
        row({ caseId: "a", v2: "fail", v3: "pass" }),
        row({ caseId: "b", v2: "pass", v3: "pass" }),
        row({
          set: "fresh",
          tool: "portfolio-rehearsal",
          check: "gradeOrVerdict",
          v2: undefined,
          v3: "fail",
          judge: true,
        }),
      ],
    });
    expect(md).toContain(
      "Jev: typesafe/jev-1.14 · checks: v3 · judge: claude-code::claude-sonnet-5-5",
    );
    expect(md).toContain("| Holdout | 2 | 2 → 2 | 1/2 → 2/2 | 0 → 0 | 0 | 1/2 → 2/2 |");
    expect(md).toContain("| Verse holdout | 1 | - → 1 | - → 1/1 | - → 0 | 0 | - → 0/1 |");
    expect(md).toContain("| Holdout | 96/100 | 96% |");
  });

  it("applies the five fixed tests to the labelled holdout rows", () => {
    const rows = [
      row({ caseId: "a", v2: "fail", v3: "pass" }), // v2 false alarm, fixed in v3
      row({
        caseId: "b",
        v2: "fail",
        v3: "fail",
        judge: true,
        evidence: { id: "B02", where: "K1", text: "Je haalt het." },
      }),
      row({ caseId: "c", v2: "pass", v3: "pass", judge: true }), // a miss the judge catches
      row({ caseId: "d", v2: "pass", v3: "pass" }),
      row({
        set: "fresh",
        tool: "portfolio-rehearsal",
        caseId: "f",
        check: "gradeOrVerdict",
        v2: undefined,
        v3: "fail",
        judge: true,
        evidence: { id: "T03", where: "turn 3", text: "Geslaagd." },
      }),
    ];
    const key = (i: number) => rowKey(rows[i] as V3Row);
    const md = judgeJevV3Report({
      ...base,
      rows,
      labels: { [key(0)]: false, [key(1)]: true, [key(2)]: true, [key(4)]: true },
      evidence: { [key(1)]: true, [key(4)]: true },
    });
    const tests = md.slice(md.indexOf("## De toetsen"));
    expect(tests).toContain(
      "| 1. Valse alarmen | v2 1, v3 0: geslaagd | 1/1 echt fout: geslaagd |",
    );
    expect(tests).toContain("| 2. Gemist wat de judge ziet | 1: niet geslaagd | 0: geslaagd |");
    expect(tests).toContain(
      "| 3. Uitvoer zonder LLM | v2 2/4, v3 3/4: geslaagd | 0/1 (geen versie 2) |",
    );
    expect(tests).toContain("| 4. Bewijs in het aangewezen stuk | 1/1: geslaagd | 1/1: geslaagd |");
    expect(tests).toContain("| 5. Volgorde van de opties | 96%: geslaagd | 95%: geslaagd |");
  });

  it("says per sort of check whether Jev may pass or report, and too little data below the minimum", () => {
    const passes = Array.from({ length: 20 }, (_, i) => row({ caseId: `p${i}`, family: "act" }));
    const md = judgeJevV3Report({ ...base, rows: passes, labels: {} });
    const table = md.slice(md.indexOf("## Met vertrouwen"));
    expect(table).toContain("| act | Holdout | 20 | 0 | 15% | ja | 0 | - | - | te weinig |");
    const few = judgeJevV3Report({ ...base, rows: passes.slice(0, 19), labels: {} });
    expect(few.slice(few.indexOf("## Met vertrouwen"))).toContain(
      "| act | Holdout | 19 | 0 | 16% | te weinig |",
    );
  });
});

describe("the rows Bastiaan labels", () => {
  it("are every disagreement, every fail of version 3, and a fixed sample of agreeing passes", () => {
    const rows = [
      row({ caseId: "a", v2: "fail", v3: "pass" }),
      row({ caseId: "b", v3: "fail", judge: true }),
      row({ caseId: "c", v2: "unsettled", v3: "unsettled", judge: true }),
      ...Array.from({ length: 60 }, (_, i) => row({ caseId: `q${i}` })),
      row({ caseId: "code", v3: "pass", by: "code" }),
      row({ caseId: "t", set: "tuning", v2: "fail", v3: "pass" }),
    ];
    const picked = labelRows(rows, { sample: 40, seed: 1 });
    const ids = picked.map((r) => r.caseId);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).not.toContain("c");
    expect(ids).not.toContain("code");
    expect(ids).not.toContain("t");
    expect(picked.filter((r) => r.caseId.startsWith("q"))).toHaveLength(40);
    expect(labelRows(rows, { sample: 40, seed: 1 })).toEqual(picked);
    expect(labelRows(rows, { sample: 40, seed: 1, tuning: true }).map((r) => r.caseId)).toContain(
      "t",
    );
  });
});
