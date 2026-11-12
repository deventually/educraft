import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  caseCourse,
  type EvaluationCase,
  evaluationReportMarkdown,
  scoreEvaluationCase,
} from "../../scripts/eval-evaluation-helpers";
import { parseEvaluation } from "~/lib/courses/evaluation";

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "evals", "course-evaluation", "cases.json"), "utf8"),
).cases as EvaluationCase[];

describe("course-evaluation eval cases (P33.2)", () => {
  it("has at least five cases: a teacher's name, an outlier, a small group and a bad test question", () => {
    expect(cases.length).toBeGreaterThanOrEqual(5);
    const ids = cases.map((c) => c.id);
    for (const part of ["name", "outlier", "test-analysis", "small", "injection"])
      expect(
        ids.some((id) => id.includes(part)),
        part,
      ).toBe(true);
    expect(cases.some((c) => c.locale === "en")).toBe(true);
    expect(cases.find((c) => c.id.includes("test-analysis"))?.respondents).toBe(10);
  });

  it("only expects places the course has", () => {
    for (const c of cases) {
      const d = caseCourse(c);
      const ids = new Set([...d.outcomes, ...d.activities, ...d.assessments].map((i) => i.id));
      for (const id of [...(c.expectPlaces ?? []), c.expectDataAt ?? []].flat())
        expect(ids.has(id), `${c.id}: ${id}`).toBe(true);
    }
  });
});

const base: EvaluationCase = {
  id: "x",
  locale: "nl",
  name: "Databases",
  respondents: 12,
  outcomes: ["Je ontwerpt een datamodel."],
  activities: [{ title: "Les normaliseren", week: 1 }],
  assessments: [{ title: "Tentamen", week: 4, kind: "summative" }],
  evaluation: "Normaliseren ging te snel.\nNormaliseren was te snel.\nMeneer Jansen praat zacht.",
  forbid: ["Jansen"],
  expectPlaces: ["act-1"],
};
const answer = (o: object) => JSON.stringify(o);
const three = [
  { place: "act-1", text: "Spreid normaliseren." },
  { place: "course", text: "Deel het rooster eerder." },
  { place: "t-1", text: "Herschrijf vraag 3." },
];

describe("scoreEvaluationCase", () => {
  it("passes a clean answer with three to five improvements on the expected place", () => {
    const raw = answer({
      themes: [
        { label: "Tempo", polarity: "negative", count: 2, quotes: ["Normaliseren ging te snel."] },
      ],
      problems: [],
      improvements: three,
    });
    const s = scoreEvaluationCase(base, parseEvaluation(raw, ctx(base)));
    expect(s).toMatchObject({
      parse: true,
      improvements: 3,
      countOk: true,
      placesOk: true,
      forbidden: 0,
      pass: true,
    });
  });

  it("fails on a forbidden word anywhere in the answer, and on too few improvements", () => {
    const raw = answer({
      themes: [{ label: "Stem van Jansen", polarity: "negative", count: 2, quotes: [] }],
      problems: [],
      improvements: three.slice(0, 2),
    });
    const s = scoreEvaluationCase(base, parseEvaluation(raw, ctx(base)));
    expect(s).toMatchObject({ forbidden: 1, countOk: false, pass: false });
  });

  it("checks the problem from the test data at the test, and the dropped quotes", () => {
    const c = { ...base, forbid: [], expectDataAt: "t-1" };
    const raw = answer({
      themes: [{ label: "Tempo", polarity: "negative", count: 2, quotes: ["Verzonnen."] }],
      problems: [{ place: "t-1", text: "Vraag 3 onderscheidt niet.", basis: "data" }],
      improvements: three,
    });
    const s = scoreEvaluationCase(c, parseEvaluation(raw, ctx(c)));
    expect(s).toMatchObject({ dataOk: true, dropped: 1, pass: true });
    const none = answer({ themes: [], problems: [], improvements: three });
    expect(scoreEvaluationCase(c, parseEvaluation(none, ctx(c)))).toMatchObject({
      dataOk: false,
      pass: false,
    });
  });

  it("fails an unreadable answer", () => {
    expect(scoreEvaluationCase(base, parseEvaluation("nee", ctx(base)))).toMatchObject({
      parse: false,
      pass: false,
    });
  });
});

describe("evaluationReportMarkdown", () => {
  it("writes one row per case and the pass count", () => {
    const md = evaluationReportMarkdown({
      date: "2026-11-12",
      model: "m",
      repeat: 1,
      rows: [
        {
          caseId: "a",
          parse: true,
          themes: 2,
          improvements: 4,
          countOk: true,
          placesOk: true,
          dataOk: true,
          forbidden: 0,
          dropped: 0,
          pass: true,
        },
      ],
    });
    expect(md).toContain("| a | ja | 2 | 4 | ja | ja | ja | 0 | 0 | ja |");
    expect(md).toContain("Geslaagd: 1 van 1.");
  });
});

function ctx(c: EvaluationCase) {
  return { data: caseCourse(c), evaluation: c.evaluation, respondents: c.respondents };
}
