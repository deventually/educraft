import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type ImportCase,
  importReportMarkdown,
  scoreImportCase,
} from "../../scripts/eval-import-helpers";
import { parseImport } from "~/lib/courses/import";
import { emptyCourseData } from "~/lib/courses/schema";
import { normalizeForMatch } from "~/lib/documents/locate";

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "evals", "course-import", "cases.json"), "utf8"),
).cases as ImportCase[];

describe("course-import eval cases (P26.3)", () => {
  it("has at least five cases, with the known faults of the brief", () => {
    expect(cases.length).toBeGreaterThanOrEqual(5);
    const ids = cases.map((c) => c.id);
    for (const fault of ["vague", "three-courses", "weights-off", "injection"])
      expect(
        ids.some((id) => id.includes(fault)),
        fault,
      ).toBe(true);
    expect(cases.some((c) => c.locale === "en")).toBe(true);
  });

  it("has a test blueprint and a marking model case (course-import@v2)", () => {
    const ids = cases.map((c) => c.id);
    for (const kind of ["blueprint", "marking-model"])
      expect(ids.some((id) => id.includes(kind), kind)).toBe(true);
    expect(cases.filter((c) => c.expectDocument).length).toBeGreaterThanOrEqual(2);
  });

  for (const c of cases) {
    it(`${c.id}: every expected outcome is verbatim in the document`, () => {
      const doc = normalizeForMatch(c.document);
      for (const o of c.expectOutcomes)
        expect(doc.includes(normalizeForMatch(o).replace(/[.;:]$/, "")), o).toBe(true);
    });
  }
});

const c: ImportCase = {
  id: "x",
  locale: "nl",
  document: "1. Je kent SQL.\n2. Je ontwerpt een datamodel.\nTentamen week 8, 60%. Opdracht 40%.",
  expectOutcomes: ["Je kent SQL.", "Je ontwerpt een datamodel."],
  noBloomHigherThan: { "Je kent SQL.": "remember" },
  forbidOutcomes: ["vliegen"],
  expectAssessments: [{ title: "tentamen", week: 8, weight: 60 }],
  expectWeightsOff: false,
};
const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    outcomes: [
      { text: "Je kent SQL.", bloomProposal: null },
      { text: "Je ontwerpt een datamodel.", bloomProposal: "create" },
    ],
    assessments: [
      { title: "Tentamen", week: 8, weight: 60, outcomeRefs: [1] },
      { title: "Opdracht", weight: 40, outcomeRefs: [2] },
    ],
    ...over,
  });
const score = (raw: string) => scoreImportCase(c, parseImport(raw, c.document, emptyCourseData()));

describe("scoreImportCase", () => {
  it("passes a faithful answer", () => {
    expect(score(answer())).toMatchObject({
      parse: true,
      found: 1,
      extra: 0,
      unverified: 0,
      forbidden: 0,
      assessments: 1,
      bloomOk: true,
      weightsOk: true,
      pass: true,
    });
  });

  it("fails on broken JSON, an invented or paraphrased outcome, a forbidden one", () => {
    expect(score("kapot")).toMatchObject({ parse: false, pass: false });
    const invented = answer({
      outcomes: [
        { text: "Je kent SQL." },
        { text: "Je ontwerpt een datamodel." },
        { text: "Je kunt vliegen." },
      ],
    });
    expect(score(invented)).toMatchObject({ extra: 1, unverified: 1, forbidden: 1, pass: false });
    const para = answer({
      outcomes: [{ text: "Je kent SQL." }, { text: "Je maakt een datamodel." }],
    });
    expect(score(para)).toMatchObject({ found: 0.5, pass: false });
  });

  it("fails an invented Bloom level, a wrong weight and a missed weight warning", () => {
    const bloom = answer({
      outcomes: [
        { text: "Je kent SQL.", bloomProposal: "apply" },
        { text: "Je ontwerpt een datamodel." },
      ],
    });
    expect(score(bloom)).toMatchObject({ bloomOk: false, pass: false });
    const weight = answer({
      assessments: [
        { title: "Tentamen", week: 8, weight: 50 },
        { title: "Opdracht", weight: 50 },
      ],
    });
    expect(score(weight)).toMatchObject({ assessments: 0, pass: false });
    expect(
      scoreImportCase(
        { ...c, expectWeightsOff: true },
        parseImport(answer(), c.document, emptyCourseData()),
      ),
    ).toMatchObject({ weightsOk: false, pass: false });
  });

  it("checks what a test blueprint or marking model adds", () => {
    const doc = `${c.document}\nModule DB1. Cesuur 75%.\nS-An 1.1 Registreert requirements.\nOnderdeel Datamodel (knock-out), 60%: Het model werkt.`;
    const withDoc: ImportCase = {
      ...c,
      document: doc,
      expectDocument: {
        module: { code: "DB1" },
        criteria: ["Registreert requirements."],
        passMark: 75,
        parts: [{ title: "datamodel", weight: 60, knockOut: true }],
      },
    };
    const good = answer({
      module: { code: "DB1", studyYear: null },
      outcomes: [
        { text: "Je kent SQL.", bloomProposal: null },
        {
          text: "Je ontwerpt een datamodel.",
          criteria: [{ code: "S-An 1.1", text: "Registreert requirements." }],
        },
      ],
      assessments: [
        {
          title: "Tentamen",
          week: 8,
          weight: 60,
          outcomeRefs: [1],
          passMark: 75,
          parts: [
            {
              title: "Datamodel",
              outcomeRefs: [2],
              weight: 60,
              knockOut: true,
              pass: "Het model werkt.",
            },
          ],
        },
        { title: "Opdracht", weight: 40, outcomeRefs: [2] },
      ],
    });
    const run = (raw: string) => scoreImportCase(withDoc, parseImport(raw, doc, emptyCourseData()));
    expect(run(good)).toMatchObject({ documentOk: true, unverified: 0, pass: true });
    const invented = good.replace("Het model werkt.", "Het model is prachtig.");
    expect(run(invented)).toMatchObject({ unverified: 1, pass: false });
    expect(run(answer())).toMatchObject({ documentOk: false, pass: false });
  });

  it("writes a Dutch report with one row per case", () => {
    const md = importReportMarkdown({
      date: "2026-11-05",
      model: "m",
      repeat: 1,
      rows: [{ ...score(answer()), caseId: "x" }],
    });
    expect(md).toContain("| x |");
    expect(md).toContain("Geslaagd: 1 van 1.");
  });
});
