import { describe, expect, it } from "vitest";
import {
  expectedFault,
  type HatReview,
  loadScreenCases,
  type ScreenCase,
  type ScreenRow,
  screenReport,
  summarise,
} from "../../scripts/eval-review-screen-helpers";

// The quick check's eval: what the reviewers say is the truth; a skipped reviewer that had a
// warning is a miss. Both sets were fixed before Jev ever ran (evals/review-screen/README.md).

describe("the cases", () => {
  const cases = loadScreenCases();

  it("reads the role-agent cases and the holdout, each with a set", () => {
    expect(cases.some((c) => c.set === "role-agents" && c.id === "ae-vague-outcome")).toBe(true);
    expect(cases.filter((c) => c.set === "holdout").length).toBeGreaterThanOrEqual(12);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });

  it("knows the expected fault only where a case says something about that reviewer", () => {
    const vague = cases.find((c) => c.id === "ae-vague-outcome")!;
    expect(expectedFault(vague, "assessment-expert")).toBe(true);
    expect(expectedFault(vague, "inclusion")).toBeNull();
    const clean = cases.find((c) => c.id === "ae-clean")!;
    expect(expectedFault(clean, "assessment-expert")).toBe(false);
    const h = cases.find((c) => c.id === "h02-programming-portfolio-only")!;
    expect(expectedFault(h, "ai-resilience")).toBe(true);
    expect(expectedFault(h, "designer")).toBe(false);
  });
});

const kase = (id: string, set: ScreenCase["set"], faults: string[] = []): ScreenCase => ({
  id,
  set,
  locale: "nl",
  course: { outcomes: [], activities: [], assessments: [] },
  faults,
});
const review = (caseId: string, agent: string, warnings: number, infos = 0): HatReview => ({
  caseId,
  agent,
  run: 1,
  parsed: true,
  findings: [
    ...Array.from({ length: warnings }, () => ({ severity: "warning" as const, message: "w" })),
    ...Array.from({ length: infos }, () => ({ severity: "info" as const, message: "i" })),
  ],
});
const row = (
  caseId: string,
  agent: string,
  run: boolean,
  set: ScreenCase["set"] = "holdout",
): ScreenRow => ({
  set,
  caseId,
  agent,
  repeat: 1,
  verdict: { run, reasons: run ? ["x"] : [] },
  ms: 300,
  costUsd: 1e-4,
});

describe("scoring a skip against what the reviewer said", () => {
  const cases = [kase("c1", "holdout", ["student"]), kase("c2", "holdout")];
  const reviews = [
    review("c1", "student", 1),
    review("c1", "designer", 0, 2),
    review("c2", "student", 0),
    review("c2", "designer", 0),
  ];

  it("counts a skipped reviewer with a warning, or with an expected fault, as missed", () => {
    const s = summarise(
      cases,
      [
        row("c1", "student", false),
        row("c1", "designer", false),
        row("c2", "student", false),
        row("c2", "designer", true),
      ],
      reviews,
    );
    expect(s.pairs).toBe(4);
    expect(s.skipped).toBe(3);
    expect(s.missedWarning).toEqual(["c1/student"]);
    expect(s.missedExpected).toEqual(["c1/student"]);
    expect(s.missedInfoOnly).toEqual(["c1/designer"]);
    expect(s.rightlySkipped).toEqual(["c2/student"]);
  });

  it("treats a pair as skipped when any Jev run skipped it, and reports unstable pairs", () => {
    const rows = [row("c2", "student", false), { ...row("c2", "student", true), repeat: 2 }];
    const s = summarise(cases, rows, reviews);
    expect(s.skipped).toBe(1);
    expect(s.unstable).toEqual(["c2/student"]);
  });

  it("writes a report with both sets and the misses spelled out", () => {
    const md = screenReport(
      {
        date: "2026-11-17",
        label: "t",
        jevModel: "typesafe/jev-1.14",
        reviewModel: "claude-code::claude-sonnet-5-5",
        repeat: 1,
      },
      cases,
      [row("c1", "student", false), row("c2", "student", false)],
      reviews,
    );
    expect(md).toMatch(/Holdout/);
    expect(md).toMatch(/c1\/student/);
    expect(md).toMatch(/Overgeslagen/);
  });
});
