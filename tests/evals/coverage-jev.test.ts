import { describe, expect, it } from "vitest";
import { normalizeForMatch } from "~/lib/documents/locate";
import { coverageVerdict, parseCoverageJevAnswer } from "~/lib/courses/coverageJev";
import type { ImportProposal } from "~/lib/courses/import";
import {
  type CoverageCase,
  coverageReport,
  loadCoverageCases,
  scoreCoverageRun,
} from "../../scripts/eval-coverage-jev-helpers";

describe("the coverage-jev cases", () => {
  const cases = loadCoverageCases();

  it("are fictional documents whose labels point at what is in them", () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) {
      const doc = normalizeForMatch(c.document);
      for (const o of c.outcomes) expect(doc).toContain(normalizeForMatch(o));
      for (const a of c.assessments) {
        expect(doc).toContain(normalizeForMatch(a.title));
        expect(["formative", "summative"]).toContain(a.kind);
        for (const n of a.covers) expect(n >= 1 && n <= c.outcomes.length).toBe(true);
      }
    }
    // Both kinds occur, so the kind question is measured both ways.
    const kinds = new Set(cases.flatMap((c) => c.assessments.map((a) => a.kind)));
    expect(kinds).toEqual(new Set(["formative", "summative"]));
  });
});

const CASE: CoverageCase = {
  id: "c",
  locale: "nl",
  courseName: "X",
  description: "",
  document: "",
  outcomes: ["Je ontwerpt een datamodel.", "Je schrijft SQL."],
  assessments: [{ title: "Tentamen SQL", kind: "summative", covers: [2] }],
};

const proposal: ImportProposal = {
  outcomes: [
    {
      key: "o1",
      text: "Je ontwerpt een datamodel.",
      verbatim: true,
      existing: false,
      criteria: [],
    },
    { key: "o2", text: "Je schrijft SQL", verbatim: true, existing: false, criteria: [] },
  ],
  assessments: [
    {
      key: "a1",
      title: "Schriftelijk tentamen SQL",
      kind: "summative",
      // The LLM's mistake: o1 instead of o2.
      outcomeKeys: ["o1"],
      existing: false,
      details: {},
      parts: [],
    },
  ],
  weightsOff: false,
};

describe("scoring one run: does Jev mark the LLM's mistakes, and how often needlessly", () => {
  const answer = parseCoverageJevAnswer({
    answers: {
      summative: { type: "noul", noul: 0.9 },
      covers_o1: { type: "noul", noul: 0.1 },
      covers_o2: { type: "noul", noul: 0.5 },
    },
  });
  const checked = coverageVerdict(proposal.assessments[0]!, ["o1", "o2"], answer);
  const run = scoreCoverageRun(CASE, 1, proposal, new Map([["a1", { answer, checked }]]));

  it("matches tests and outcomes modulo layout, and scores each pair", () => {
    expect(run.missing).toEqual([]);
    expect(run.pairs).toEqual([
      {
        case: "c",
        run: 1,
        test: "Tentamen SQL",
        outcome: 1,
        truth: false,
        llm: true,
        jevP: 0.1,
        marked: true,
      },
      {
        case: "c",
        run: 1,
        test: "Tentamen SQL",
        outcome: 2,
        truth: true,
        llm: false,
        jevP: 0.5,
        marked: false,
      },
    ]);
    expect(run.kinds).toEqual([
      {
        case: "c",
        run: 1,
        test: "Tentamen SQL",
        truth: "summative",
        llm: "summative",
        final: "summative",
        jevP: 0.9,
        marked: false,
      },
    ]);
  });

  it("names a labelled test the LLM did not find", () => {
    const none = scoreCoverageRun(CASE, 1, { ...proposal, assessments: [] }, new Map());
    expect(none.missing).toEqual(["Tentamen SQL"]);
    expect(none.pairs).toEqual([]);
  });

  it("reports caught mistakes and false alarms per question, Jev alone, and the cost", () => {
    const md = coverageReport({
      date: "2026-11-17",
      llmModel: "m",
      jevModel: "j",
      repeat: 1,
      jevMs: [300],
      jevCostUsd: 0.0001,
      runs: [run],
    });
    expect(md).toMatch(/Dekking/);
    expect(md).toMatch(/fouten van de LLM \| 2 \|/);
    expect(md).toMatch(/gevangen\) \| 1\/2 \(50%\) \|/);
    expect(md).toMatch(/Soort/);
    expect(md).toMatch(/Jev alleen/);
    expect(md).toMatch(/300 ms/);
  });
});
