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
  jevUseCostUsd: 0.25,
  judgeCostUsd: 8,
  judgeOutputs: 100,
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

  it("applies the six fixed tests to the labelled holdout rows, and says when there is too little", () => {
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
      "| 1. Valse alarmen | v2 1, v3 0: geslaagd | 1/1 echt fout: te weinig |",
    );
    expect(tests).toContain(
      "| 2. Gemist: de hybride niet meer dan Sonnet alleen | 2 echt fout gelabeld: te weinig | 1 echt fout gelabeld: te weinig |",
    );
    expect(tests).toContain(
      "| 3. Uitvoer zonder LLM (alleen gerapporteerd) | v2 2/4, v3 3/4 | 0/1 (geen versie 2) |",
    );
    expect(tests).toContain(
      "| 4. Bewijs in het aangewezen stuk | 1/1: te weinig | 1/1: te weinig |",
    );
    expect(tests).toContain("| 5. Volgorde van de opties | 96%: geslaagd | 95%: geslaagd |");
    expect(tests).toContain("| 6. Tweede blik: Jev faalt, Sonnet niet | - | - |");
  });

  it("judges Jev and Sonnet by the same rules per sort of check, counting cases, not runs", () => {
    const passes = Array.from({ length: 30 }, (_, i) => row({ caseId: `p${i}`, family: "act" }));
    const md = judgeJevV3Report({ ...base, rows: passes, labels: {} });
    const table = md.slice(md.indexOf("## Met vertrouwen"));
    expect(table).toContain(
      "| act | Holdout | Jev | 30 | 0 | 10% | ja | 0 | - | - | - | te weinig |",
    );
    expect(table).toContain(
      "| act | Holdout | Sonnet | 30 | 0 | 10% | ja | 0 | - | - | - | te weinig |",
    );
    const few = judgeJevV3Report({ ...base, rows: passes.slice(0, 29), labels: {} });
    expect(few.slice(few.indexOf("## Met vertrouwen"))).toContain(
      "| act | Holdout | Jev | 29 | 0 | 10% | te weinig |",
    );
    const runs = Array.from({ length: 60 }, (_, i) =>
      row({ caseId: `c${i % 20}`, run: 1 + Math.floor(i / 20) }),
    );
    const clustered = judgeJevV3Report({ ...base, rows: runs, labels: {} });
    expect(clustered.slice(clustered.indexOf("## Met vertrouwen"))).toContain(
      "| act | Holdout | Jev | 20 | 0 | 15% | te weinig |",
    );
  });

  it("lets Jev report a failure only when the lower bound of the real share is 60%", () => {
    const fails = (real: number, n: number) =>
      Array.from({ length: n }, (_, i) =>
        row({
          caseId: `f${i}`,
          v3: "fail",
          judge: true,
          evidence: { id: "B01", where: "", text: "x" },
        }),
      ).map((r, i) => [r, i < real] as const);
    const report = (real: number, n: number) => {
      const rows = fails(real, n);
      const labels = Object.fromEntries(rows.map(([r, t]) => [rowKey(r), t]));
      const evidence = Object.fromEntries(
        rows.filter(([, t]) => t).map(([r]) => [rowKey(r), true]),
      );
      const md = judgeJevV3Report({ ...base, rows: rows.map(([r]) => r), labels, evidence });
      return md.slice(md.indexOf("## Met vertrouwen"));
    };
    expect(report(10, 10)).toContain(
      "| act | Holdout | Jev | 0 | 0 | - | te weinig | 10 | 100% | 72% | 100% | ja |",
    );
    expect(report(0, 5)).toContain("| 5 | 0% | 0% | - | te weinig |");
    expect(report(9, 10)).toContain(
      "| act | Holdout | Jev | 0 | 0 | - | te weinig | 10 | 90% | 59% | 100% | nee |",
    );
    expect(report(9, 10)).toContain(
      "| act | Holdout | Sonnet | 0 | 0 | - | te weinig | 10 | 90% | 59% | - | nee |",
    );
  });

  it("sets Jev, Sonnet and the hybrid side by side on the labels, with the cost per 1,000 outputs", () => {
    const rows = [
      row({ caseId: "a", v2: "fail", v3: "pass", judge: false }), // v2 false alarm
      row({ caseId: "b", v2: "pass", v3: "fail", judge: false }), // Jev sees what Sonnet missed
      row({ caseId: "c", v2: "pass", v3: "unsettled", judge: true }), // Sonnet false alarm
      ...Array.from({ length: 10 }, (_, i) => row({ caseId: `q${i}` })),
    ];
    const key = (id: string) => rowKey(rows.find((r) => r.caseId === id) as V3Row);
    const md = judgeJevV3Report({
      ...base,
      rows,
      labels: {
        [key("a")]: false,
        [key("b")]: true,
        [key("c")]: false,
        [key("q0")]: true,
        [key("q1")]: false,
      },
    });
    const side = md.slice(md.indexOf("## Jev en Sonnet naast de labels"));
    expect(side).toContain("| Holdout | Jev v3 | 12 | 0 | 0 + 5 geschat | 58% | $19.23 |");
    expect(side).toContain("| Holdout | Jev v2 | 13 | 1 | 1 + 5 geschat | 46% | - |");
    expect(side).toContain("| Holdout | Sonnet | 13 | 1 | 1 + 5 geschat | 46% | $80.00 |");
    expect(side).toContain(
      "| Holdout | Hybride (Jev, anders Sonnet) | 13 | 1 | 0 + 5 geschat | 54% | $25.38 |",
    );
  });

  it("shows how often a failure is real per probability band, as TypeSafe asks", () => {
    const rows = [
      row({ caseId: "a", v3: "fail", v3P: 0.95, judge: true }),
      row({ caseId: "b", v3: "fail", v3P: 0.92, judge: false }),
      row({ caseId: "c", v3: "pass", v3P: 0.05, judge: true }),
    ];
    const labels = Object.fromEntries(rows.map((r, i) => [rowKey(r), i === 0 || i === 2]));
    const md = judgeJevV3Report({ ...base, rows, labels });
    const cal = md.slice(md.indexOf("## Kalibratie"));
    expect(cal).toContain("| 0,9–1 | 2 | 1 | 50% |");
    expect(cal).toContain("| 0–0,1 | 1 | 1 | 100% |");
  });

  it("quotes the evidence so a backslash or a pipe cannot break the table", () => {
    const md = judgeJevV3Report({
      ...base,
      rows: [row({ v3: "fail", evidence: { id: "B01", where: "K1", text: "a \\| b" } })],
    });
    expect(md).toContain("| B01: a \\\\\\| b |");
  });
});

describe("the rows Bastiaan labels", () => {
  it("are every fail of Jev (v2 or v3) or Sonnet, and a fixed sample of the rest", () => {
    const rows = [
      row({ caseId: "a", v2: "fail", v3: "pass" }),
      row({ caseId: "b", v3: "fail", judge: true }),
      row({ caseId: "c", v2: "unsettled", v3: "unsettled", judge: true }),
      row({ caseId: "u", v2: "pass", v3: "unsettled", judge: false }),
      ...Array.from({ length: 60 }, (_, i) => row({ caseId: `q${i}` })),
      row({ caseId: "code", v3: "pass", by: "code" }),
      row({ caseId: "t", set: "tuning", v2: "fail", v3: "pass" }),
    ];
    const picked = labelRows(rows, { sample: 40, seed: 1 });
    const ids = picked.map((r) => r.caseId);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).toContain("c");
    expect(ids).not.toContain("code");
    expect(ids).not.toContain("t");
    expect(picked.filter((r) => r.caseId.startsWith("q") || r.caseId === "u")).toHaveLength(40);
    expect(labelRows(rows, { sample: 40, seed: 1 })).toEqual(picked);
    expect(labelRows(rows, { sample: 40, seed: 1, tuning: true }).map((r) => r.caseId)).toContain(
      "t",
    );
  });
});
