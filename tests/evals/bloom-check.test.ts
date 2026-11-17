import { describe, expect, it } from "vitest";
import {
  type CheckRow,
  checkReport,
  loadCheckCourses,
  scoreCheck,
  stableChecks,
  uniqueOutcomes,
} from "../../scripts/eval-bloom-check-helpers";

const p = (level: string | null) =>
  Object.fromEntries(
    ["remember", "understand", "apply", "analyze", "evaluate", "create"].map((l) => [
      l,
      l === level ? 0.9 : 0.1,
    ]),
  );

const row = (text: string, intended: CheckRow["intended"], heard: string | null, run = 1) =>
  ({ course: "c", locale: "nl", text, intended, run, p: p(heard) }) as CheckRow;

describe("the Bloom check's courses", () => {
  it("are the wizard's cases plus new briefs in both languages, none empty, ids unique", () => {
    const courses = loadCheckCourses();
    expect(courses.length).toBeGreaterThanOrEqual(20);
    expect(courses.some((c) => c.expectEmpty)).toBe(false);
    expect(new Set(courses.map((c) => c.id)).size).toBe(courses.length);
    expect(new Set(courses.map((c) => c.locale))).toEqual(new Set(["nl", "en"]));
  });

  it("keeps each outcome once, with its first level", () => {
    const o = (text: string, intended: CheckRow["intended"]) =>
      ({ course: "c", locale: "nl", text, intended }) as const;
    expect(uniqueOutcomes([o("A.", "apply"), o("a. ", "create"), o("B.", null)])).toEqual([
      o("A.", "apply"),
      o("B.", null),
    ]);
  });
});

describe("scoring the check against Bastiaan's labels", () => {
  const labels = { right: "apply", off: "understand", vague: null, missed: "remember" } as const;
  const rows = [
    row("right", "apply", "apply"), // AI right, no flag
    row("off", "analyze", "understand"), // AI off, flagged with the right level
    row("vague", "understand", null), // AI off, flagged "no clear level": right
    row("missed", "apply", "apply"), // AI off, no flag
    row("right", "apply", "create", 2), // AI right, a false alarm
    row("unlabelled", "apply", "create"),
    { ...row("off", "analyze", null, 3), p: null }, // Jev did not answer
  ];

  it("counts flags, right flags, right suggestions and misses", () => {
    expect(scoreCheck(rows, labels)).toEqual({
      labelled: 5,
      aiRight: 2,
      flagged: 3,
      flaggedRight: 2,
      suggestionRight: 2,
      missed: 1,
      unanswered: 1,
    });
  });

  it("counts an outcome stable when every run checks it the same", () => {
    expect(stableChecks(rows)).toEqual({ stable: 4, outcomes: 5 });
  });

  it("reports in plain Dutch, with the fixed threshold and what is unlabelled", () => {
    const md = checkReport({
      date: "2026-11-17",
      jevModel: "typesafe/jev-1.14",
      llmModel: "m",
      repeat: 3,
      rows,
      labels,
      jevMs: [300, 400],
      jevCostUsd: 0.001,
    });
    expect(md).toContain("Drempel 0,7, vast");
    expect(md).toContain("| … terecht (niveau van de AI klopte niet) | 2/3 |");
    expect(md).toContain("| Fout niveau zonder melding (gemist) | 1/3 |");
    expect(md).toContain("ongelabeld: 1");
    expect(md).toContain("350 ms");
  });
});
