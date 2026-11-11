import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type AssessmentsCase,
  assessmentsReportMarkdown,
  caseCourse,
  scoreAssessmentsCase,
} from "../../scripts/eval-design-assessments-helpers";
import { parseAssessmentsDesign } from "~/lib/courses/designAssessments";

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "evals", "course-design-assessments", "cases.json"), "utf8"),
).cases as AssessmentsCase[];

describe("course-design-assessments eval cases (wizard, step 2)", () => {
  it("covers mbo, hbo and wo, the school's forms, an injection, no weeks and English", () => {
    const ids = cases.map((c) => c.id);
    for (const part of ["mbo", "hbo", "wo", "forms", "injection", "no-weeks"])
      expect(
        ids.some((id) => id.includes(part)),
        part,
      ).toBe(true);
    expect(cases.some((c) => c.locale === "en")).toBe(true);
  });
});

const c: AssessmentsCase = {
  id: "x",
  locale: "nl",
  name: "Databases",
  ec: 5,
  weeks: 8,
  outcomes: [
    { text: "De student ontwerpt een datamodel.", bloom: "create" },
    { text: "De student schrijft SQL-queries.", bloom: "apply" },
  ],
  forms: ["tentamen", "beroepsproduct"],
  forbid: ["banaan"],
};
const good = [
  { title: "Oefenen", kind: "formative", week: 4, outcomeRefs: [1, 2], form: "Oefententamen" },
  { title: "Tentamen", kind: "summative", week: 8, weight: 40, outcomeRefs: [2], form: "Tentamen" },
  {
    title: "Datamodel",
    kind: "summative",
    week: 8,
    weight: 60,
    outcomeRefs: [1],
    form: "Beroepsproduct",
  },
];
const score = (assessments: unknown[], k: AssessmentsCase = c) =>
  scoreAssessmentsCase(k, parseAssessmentsDesign(JSON.stringify({ assessments }), caseCourse(k)));

describe("scoreAssessmentsCase", () => {
  it("passes a programme that keeps the rules", () => {
    expect(score(good)).toMatchObject({
      parse: true,
      summative: 2,
      summativeOk: true,
      coveredOk: true,
      weightsOk: true,
      formativeOk: true,
      weeksOk: true,
      formsOk: true,
      forbidden: 0,
      pass: true,
    });
  });

  it("fails an outcome without a summative test, and weights that miss 100", () => {
    expect(score([good[0], good[1]])).toMatchObject({ coveredOk: false, weightsOk: false });
  });

  it("fails without formative practice before a summative test", () => {
    const late = [{ ...good[0], week: 8 }, good[1], good[2]];
    expect(score(late)).toMatchObject({ formativeOk: false, pass: false });
    expect(score([good[1], good[2]])).toMatchObject({ formativeOk: false });
  });

  it("fails too many summative tests for a small course, and a missing week", () => {
    const many = [
      good[0],
      ...[1, 2, 3].map((n) => ({ ...good[1], title: `T${n}`, weight: 25, outcomeRefs: [1, 2] })),
      { ...good[2], weight: 25 },
    ];
    expect(score(many)).toMatchObject({ summative: 4, summativeOk: false });
    expect(score([good[0], good[1], { ...good[2], week: null }])).toMatchObject({
      weeksOk: false,
    });
  });

  it("fails a form the school does not use, and a forbidden word", () => {
    expect(score([good[0], good[1], { ...good[2], form: "Poster" }])).toMatchObject({
      formsOk: false,
    });
    expect(score([...good.slice(0, 2), { ...good[2], title: "Banaan" }])).toMatchObject({
      forbidden: 1,
      pass: false,
    });
  });

  it("does not ask for weeks when the course has none", () => {
    const noWeeks = { ...c, weeks: undefined };
    const r = score(
      good.map((a) => ({ ...a, week: null })),
      noWeeks,
    );
    expect(r).toMatchObject({ weeksOk: true, formativeOk: true, pass: true });
  });
});

describe("assessmentsReportMarkdown", () => {
  it("writes one row per case and the total", () => {
    const md = assessmentsReportMarkdown({
      date: "2026-11-11",
      model: "m",
      repeat: 1,
      rows: [score(good)],
    });
    expect(md).toContain("| x | ja | 2 |");
    expect(md).toContain("Geslaagd: 1 van 1.");
  });
});
