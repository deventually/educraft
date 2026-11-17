import { describe, expect, it } from "vitest";
import {
  assessmentPassage,
  buildCoverageJevRequest,
  COVERAGE_JEV_THRESHOLDS,
  coverageVerdict,
  outcomeAsWritten,
  parseCoverageJevAnswer,
} from "~/lib/courses/coverageJev";
import type { ImportAssessment } from "~/lib/courses/import";

const DOC = `Hogeschool Fictief — Studiehandleiding Databases (DB2)

2. Leeruitkomsten
LU1 Je ontwerpt een genormaliseerd data-
model voor een gegeven casus.
LU2 Je schrijft SQL-queries met joins.

${"Week 1-7: colleges en practica. ".repeat(80)}

4. Toetsing
| Toets | Week | Weging | Leeruitkomsten |
| Schriftelijk tentamen SQL | 8 | 40% | LU2 |
| Oefentoets SQL | 4 | 0% | LU2 |
Herkansing: week 20.`;

describe("the passage Jev reads: only where the document names the test", () => {
  it("cuts the parts of the document around each mention of the title", () => {
    const p = assessmentPassage("Schriftelijk tentamen SQL", DOC);
    expect(p).toContain("| Schriftelijk tentamen SQL | 8 | 40% | LU2 |");
    expect(p).toContain("| Toets | Week | Weging | Leeruitkomsten |");
    // Not the whole document: the long schedule far away stays out.
    expect(p?.length).toBeLessThan(DOC.length);
    expect(p).not.toContain("Hogeschool Fictief");
  });

  it("is forgiving about layout and case, and gives null when the title is not in the document", () => {
    expect(assessmentPassage("schriftelijk  tentamen sql", DOC)).toContain("| 8 | 40% |");
    expect(assessmentPassage("Mondeling examen", DOC)).toBeNull();
  });

  it("names an outcome as the document writes it, with its code", () => {
    expect(outcomeAsWritten("Je schrijft SQL-queries met joins.", DOC)).toBe(
      "LU2 Je schrijft SQL-queries met joins.",
    );
    // Across a broken line, the code still comes along.
    expect(
      outcomeAsWritten("Je ontwerpt een genormaliseerd datamodel voor een gegeven casus.", DOC),
    ).toMatch(/^LU1 Je ontwerpt/);
    // Not in the document: its own text.
    expect(outcomeAsWritten("Je beheert een server.", DOC)).toBe("Je beheert een server.");
  });
});

describe("the request: one per test, one yes/no per outcome and one for the kind", () => {
  const req = buildCoverageJevRequest(
    {
      title: "Schriftelijk tentamen SQL",
      passage: "| Schriftelijk tentamen SQL | 8 | 40% | LU2 |",
      outcomes: [
        { key: "o1", text: "LU1 Je ontwerpt een datamodel." },
        { key: "o2", text: "LU2 Je schrijft SQL-queries met joins." },
      ],
    },
    "nl",
    "jev-x",
  );

  it("puts the test and its passage in the state as named fields", () => {
    expect(req.model).toBe("jev-x");
    expect(Object.keys(req.state)).toEqual(["assessment", "passage", "about_passage"]);
    expect(req.state.assessment).toBe("Schriftelijk tentamen SQL");
  });

  it("asks each outcome in its own question, naming it, and the kind once", () => {
    expect(Object.keys(req.questions)).toEqual(["summative", "covers_o1", "covers_o2"]);
    expect(req.questions.covers_o2?.instructions).toContain(
      "LU2 Je schrijft SQL-queries met joins.",
    );
    for (const q of Object.values(req.questions)) {
      expect(q.type).toBe("noul");
      expect(q.instructions).toMatch(/`assessment`/);
      expect(q.instructions).toMatch(/`passage`/);
      expect(Object.keys(q.criteria)).toEqual(["true", "false"]);
    }
    const en = buildCoverageJevRequest(
      { title: "Exam", passage: "Exam: LO1", outcomes: [{ key: "o1", text: "LO1 Design." }] },
      "en",
      "jev-x",
    );
    expect(en.questions.summative?.instructions).toMatch(/final grade|pass/i);
  });
});

const noul = (p: number) => ({ type: "noul", noul: p });
const body = (ps: Record<string, number>) => ({
  answers: Object.fromEntries(Object.entries(ps).map(([k, p]) => [k, noul(p)])),
  usage: { cost: 3e-5 },
});

describe("reading the answer", () => {
  it("keeps every probability and the cost", () => {
    const r = parseCoverageJevAnswer(body({ summative: 0.9, covers_o1: 0.1, covers_o2: 0.8 }));
    expect(r).toMatchObject({ usable: true, summative: 0.9, costUsd: 3e-5 });
    expect(r.covers).toEqual({ o1: 0.1, o2: 0.8 });
    expect(parseCoverageJevAnswer("nonsense")).toMatchObject({ usable: false, covers: {} });
  });
});

describe("the truth table: Jev checks the LLM's reading, the teacher decides", () => {
  const a: ImportAssessment = {
    key: "a1",
    title: "Tentamen",
    kind: "summative",
    outcomeKeys: ["o1", "o2"],
    existing: false,
    details: {},
    parts: [],
  };
  const keys = ["o1", "o2", "o3"];
  const verdict = (ps: Record<string, number>, x: ImportAssessment = a) =>
    coverageVerdict(x, keys, parseCoverageJevAnswer(body(ps)));

  it("starts from TypeSafe's thresholds", () => {
    expect(COVERAGE_JEV_THRESHOLDS).toEqual({ yes: 0.7, no: 0.3 });
  });

  it("adds no check when Jev clearly agrees", () => {
    const r = verdict({ summative: 0.9, covers_o1: 0.8, covers_o2: 0.95, covers_o3: 0.1 });
    expect(r).toEqual(a);
  });

  it("marks a ticked outcome Jev says no to, or is unsure about, and never unticks it", () => {
    const r = verdict({ summative: 0.9, covers_o1: 0.1, covers_o2: 0.5, covers_o3: 0.1 });
    expect(r.outcomeKeys).toEqual(["o1", "o2"]);
    expect(r.check).toEqual({ kind: false, outcomeKeys: ["o1", "o2"] });
  });

  it("marks an unticked outcome only when Jev clearly says yes, and never ticks it", () => {
    const r = verdict({ summative: 0.9, covers_o1: 0.9, covers_o2: 0.9, covers_o3: 0.8 });
    expect(r.outcomeKeys).toEqual(["o1", "o2"]);
    expect(r.check).toEqual({ kind: false, outcomeKeys: ["o3"] });
    // Unsure about an unticked one: the document does not settle it, nothing is proposed.
    expect(verdict({ summative: 0.9, covers_o1: 0.9, covers_o2: 0.9, covers_o3: 0.5 })).toEqual(a);
  });

  it("marks the kind when Jev clearly disagrees or is unsure, and keeps the LLM's kind", () => {
    const sure = { covers_o1: 0.9, covers_o2: 0.9, covers_o3: 0.1 };
    expect(verdict({ ...sure, summative: 0.1 })).toMatchObject({
      kind: "summative",
      check: { kind: true, outcomeKeys: [] },
    });
    expect(verdict({ ...sure, summative: 0.5 }).check).toEqual({ kind: true, outcomeKeys: [] });
    const formative = { ...a, kind: "formative" as const };
    expect(verdict({ ...sure, summative: 0.1 }, formative)).toEqual(formative);
  });

  it("fills a kind the LLM left open when Jev is sure, and marks it when not", () => {
    const { kind: _k, ...open } = a;
    const sure = { covers_o1: 0.9, covers_o2: 0.9, covers_o3: 0.1 };
    expect(verdict({ ...sure, summative: 0.2 }, open)).toEqual({ ...open, kind: "formative" });
    expect(verdict({ ...sure, summative: 0.8 }, open)).toEqual({ ...open, kind: "summative" });
    expect(verdict({ ...sure, summative: 0.5 }, open)).toEqual({
      ...open,
      check: { kind: true, outcomeKeys: [] },
    });
  });

  it("treats a question Jev left out as unsure, and an unusable answer as no answer", () => {
    expect(verdict({ covers_o1: 0.9, covers_o2: 0.9 }).check).toEqual({
      kind: true,
      outcomeKeys: [],
    });
    expect(coverageVerdict(a, keys, parseCoverageJevAnswer("nonsense"))).toEqual(a);
  });
});
