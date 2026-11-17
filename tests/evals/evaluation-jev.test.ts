import { describe, expect, it } from "vitest";
import {
  goldCount,
  goldThemesFor,
  loadThemeCountCases,
  themeCountReport,
} from "../../scripts/eval-evaluation-jev-helpers";

describe("the theme-count cases", () => {
  const cases = loadThemeCountCases();

  it("give every answer of every survey its themes, from the existing cases and two larger ones", () => {
    expect(cases.length).toBe(7);
    expect(new Set(cases.map((c) => c.case.id)).size).toBe(7);
    for (const c of cases) {
      expect(c.lines.length).toBe(c.answers.length);
      const keys = new Set(c.themes.map((t) => t.key));
      for (const l of c.lines) for (const k of l) expect(keys.has(k)).toBe(true);
      // Every theme is made by at least two students: a theme the app would keep.
      for (const t of c.themes)
        expect(c.lines.filter((l) => l.includes(t.key)).length).toBeGreaterThanOrEqual(2);
    }
    // The larger surveys are where counting gets hard.
    expect(Math.max(...cases.map((c) => c.answers.length))).toBeGreaterThanOrEqual(40);
  });
});

describe("matching a theme of the LLM to the truth, by its quotes", () => {
  const answers = [
    "Feedback kwam laat.",
    "Gastcollege top, maar feedback laat.",
    "Gastcollege leuk.",
    "Prima.",
  ];
  const lines = [["fb"], ["guest", "fb"], ["guest"], []];

  it("takes the themes most of its quoted answers make", () => {
    expect(goldThemesFor(["Feedback kwam laat."], answers, lines)).toEqual(["fb"]);
    expect(goldThemesFor(["Gastcollege leuk", "Gastcollege top"], answers, lines)).toEqual([
      "guest",
    ]);
  });

  it("keeps both when a single quote makes two themes (a merged theme), none without quotes", () => {
    expect(goldThemesFor(["Gastcollege top, maar feedback laat."], answers, lines)).toEqual([
      "guest",
      "fb",
    ]);
    expect(goldThemesFor([], answers, lines)).toEqual([]);
    expect(goldThemesFor(["Prima."], answers, lines)).toEqual([]);
  });

  it("counts the answers that make any of the matched themes, once each", () => {
    expect(goldCount(["fb"], lines)).toBe(2);
    expect(goldCount(["guest", "fb"], lines)).toBe(3);
    expect(goldCount([], lines)).toBeNull();
  });
});

describe("the report", () => {
  it("compares the LLM's count and Jev's count with the truth, and Jev per answer", () => {
    const md = themeCountReport({
      date: "2026-11-17",
      llmModel: "llm",
      jevModel: "jev",
      repeat: 1,
      jevMs: [200, 400],
      jevCostUsd: 0.001,
      themes: [
        {
          caseId: "c#1",
          label: "A",
          gold: ["a"],
          goldCount: 3,
          llmCount: 4,
          jev: { count: 3, unsettled: 0, unanswered: 0 },
        },
        {
          caseId: "c#1",
          label: "B",
          gold: [],
          goldCount: null,
          llmCount: 2,
          jev: { count: 2, unsettled: 1, unanswered: 0 },
        },
      ],
      perAnswer: [
        { caseId: "c#1", theme: "a", truth: true, verdict: "yes" },
        { caseId: "c#1", theme: "a", truth: false, verdict: "unsettled" },
      ],
    });
    expect(md).toContain("model: llm");
    expect(md).toMatch(/\| LLM \| 0 \| 1 \|/);
    expect(md).toMatch(/\| Jev \| 1 \| 0 \|/);
    expect(md).toContain("niet te vergelijken: 1");
    expect(md).toContain("300 ms");
  });
});
