import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  caseCourse,
  type LessonsCase,
  lessonsReportMarkdown,
  scoreLessonsCase,
} from "../../scripts/eval-design-lessons-helpers";
import { parseLessonsDesign } from "~/lib/courses/designLessons";

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "evals", "course-design-lessons", "cases.json"), "utf8"),
).cases as LessonsCase[];

describe("course-design-lessons eval cases (wizard, step 3)", () => {
  it("covers mbo, hbo and wo, disciplines, wishes, an injection, no schedule and English", () => {
    const ids = cases.map((c) => c.id);
    for (const part of ["mbo", "hbo", "wo", "disciplines", "wishes", "injection", "no-schedule"])
      expect(
        ids.some((id) => id.includes(part)),
        part,
      ).toBe(true);
    expect(cases.some((c) => c.locale === "en")).toBe(true);
  });

  it("is a course after step 2: every case has tests over its own outcomes", () => {
    for (const c of cases) {
      const d = caseCourse(c);
      expect(d.assessments.length, c.id).toBeGreaterThan(0);
      const ids = new Set(d.outcomes.map((o) => o.id));
      for (const a of d.assessments)
        for (const cov of a.coverage) expect(ids.has(cov.outcomeId), c.id).toBe(true);
    }
  });
});

const c: LessonsCase = {
  id: "x",
  locale: "nl",
  name: "Databases",
  weeks: 3,
  sessionsPerWeek: 1,
  disciplines: [{ name: "Theorie" }, { name: "Praktijk" }],
  outcomes: [
    { text: "De student ontwerpt een datamodel.", bloom: "create" },
    { text: "De student schrijft SQL-queries.", bloom: "apply" },
  ],
  assessments: [
    { title: "Eindopdracht", kind: "summative", week: 3, weight: 100, outcomeRefs: [1, 2] },
  ],
  forbid: ["banaan"],
};
const l = (
  title: string,
  week: number,
  refs: number[],
  discipline: number,
  goal = "Kan iets.",
) => ({
  title,
  week,
  kind: "lesson",
  goal,
  outcomeRefs: refs,
  discipline,
});
const score = (lessons: object[]) =>
  scoreLessonsCase(c, parseLessonsDesign(JSON.stringify({ lessons, notes: null }), caseCourse(c)));
// Two disciplines of one lesson each: two lessons a week, three weeks.
const good = [
  l("Datamodel", 1, [1], 1),
  l("SQL", 1, [2], 2),
  l("Normaliseren", 2, [1], 1),
  l("Joins", 2, [2], 2),
  l("Herhaling", 3, [1, 2], 1),
  l("Oefenen", 3, [2], 2),
];

describe("scoreLessonsCase", () => {
  it("passes a series that teaches everything in time, per discipline, with goals", () => {
    const s = score(good);
    expect(s).toMatchObject({ parse: true, lessons: 6, pass: true });
  });

  it("fails what the prompt rules out", () => {
    expect(score(good.filter((x) => !x.outcomeRefs.includes(1)))).toMatchObject({
      taughtOk: false,
      pass: false,
    });
    expect(score(good.slice(0, 2))).toMatchObject({ countOk: false, pass: false });
    expect(score(good.map((x) => ({ ...x, goal: null })))).toMatchObject({
      completeOk: false,
      pass: false,
    });
    expect(score(good.map((x) => ({ ...x, discipline: 1 })))).toMatchObject({
      disciplinesOk: false,
      pass: false,
    });
    expect(score([...good.slice(1), l("Banaan", 1, [1], 1)])).toMatchObject({
      forbidden: 1,
      pass: false,
    });
    expect(scoreLessonsCase(c, parseLessonsDesign("geen json", caseCourse(c)))).toMatchObject({
      parse: false,
      pass: false,
    });
  });

  it("fails an outcome first taught after its summative test", () => {
    const d = { ...c, assessments: [{ ...c.assessments[0]!, week: 2 }] };
    const late = [
      l("SQL", 1, [2], 2),
      l("Pas later", 3, [1], 1),
      l("A", 1, [2], 1),
      l("B", 2, [2], 2),
    ];
    const s = scoreLessonsCase(
      d,
      parseLessonsDesign(JSON.stringify({ lessons: late }), caseCourse(d)),
    );
    expect(s).toMatchObject({ beforeTestOk: false, pass: false });
  });
});

describe("lessonsReportMarkdown", () => {
  it("writes one row per run and the total", () => {
    const md = lessonsReportMarkdown({
      date: "2026-11-11",
      model: "m",
      repeat: 1,
      rows: [score(good)],
    });
    expect(md).toContain("# Eval cursus ontwerpen (lessenreeks) — 2026-11-11");
    expect(md).toContain("| x | ja | 6 | ja | ja | ja | ja | ja | 0 | ja |");
    expect(md).toContain("Geslaagd: 1 van 1.");
  });
});
