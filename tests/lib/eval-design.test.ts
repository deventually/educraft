import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type DesignCase,
  designReportMarkdown,
  scoreDesignCase,
} from "../../scripts/eval-design-helpers";
import { parseOutcomesDesign } from "~/lib/courses/design";
import { emptyCourseData } from "~/lib/courses/schema";

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "evals", "course-design-outcomes", "cases.json"), "utf8"),
).cases as DesignCase[];

describe("course-design-outcomes eval cases (wizard, step 1)", () => {
  it("covers mbo, hbo and wo, disciplines, an injection, a vague description and English", () => {
    const ids = cases.map((c) => c.id);
    for (const part of ["mbo", "hbo", "wo", "disciplines", "injection", "vague"])
      expect(
        ids.some((id) => id.includes(part)),
        part,
      ).toBe(true);
    expect(cases.some((c) => c.locale === "en")).toBe(true);
    expect(cases.some((c) => c.expectEmpty)).toBe(true);
  });
});

const c: DesignCase = {
  id: "x",
  locale: "nl",
  name: "Databases",
  brief: { description: "Studenten ontwerpen en bevragen databases." },
  disciplines: ["Wiskunde"],
  minTopBloom: "create",
  forbid: ["banaan"],
};
const outcome = (text: string, bloom: string, n = 2) => ({
  text,
  bloom,
  criteria: Array.from({ length: n }, (_, i) => `Criterium ${i + 1}.`),
});
const good = [
  outcome("De student ontwerpt een datamodel voor een casus.", "create"),
  outcome("De student schrijft SQL-queries met joins.", "apply"),
  outcome("De student legt normaliseren uit met de wiskunde van verzamelingen.", "understand"),
];
const score = (outcomes: unknown[], notes: string | null = null, k: DesignCase = c) =>
  scoreDesignCase(k, parseOutcomesDesign(JSON.stringify({ outcomes, notes }), emptyCourseData()));

describe("scoreDesignCase", () => {
  it("passes a proposal that keeps the rules", () => {
    expect(score(good)).toMatchObject({
      parse: true,
      count: 3,
      countOk: true,
      criteriaOk: true,
      bloomOk: true,
      vague: 0,
      studentOk: true,
      disciplinesOk: true,
      forbidden: 0,
      pass: true,
    });
  });

  it("fails too few outcomes, too few criteria, vague verbs and a forbidden word", () => {
    expect(score(good.slice(0, 2))).toMatchObject({ countOk: false, pass: false });
    expect(score([...good, outcome("De student kent SQL.", "remember", 1)])).toMatchObject({
      criteriaOk: false,
      vague: 1,
      pass: false,
    });
    expect(score([...good, outcome("De student eet een banaan.", "apply")])).toMatchObject({
      forbidden: 1,
      pass: false,
    });
    expect(score([...good, outcome("Je schrijft een rapport.", "create")])).toMatchObject({
      studentOk: false,
      pass: false,
    });
  });

  it("fails a flat or too low Bloom spread and an outcome without a level", () => {
    const flat = good.map((o) => ({ ...o, bloom: "apply" }));
    expect(score(flat)).toMatchObject({ bloomOk: false, pass: false });
    expect(score([...good, outcome("De student test een query.", "")])).toMatchObject({
      bloomOk: false,
    });
  });

  it("finds a discipline in the notes, and misses one that is nowhere", () => {
    const noMaths = good.map((o) => ({
      ...o,
      text: o.text.replace(" met de wiskunde van verzamelingen", ""),
    }));
    expect(score(noMaths)).toMatchObject({ disciplinesOk: false, pass: false });
    expect(score(noMaths, "LU3 hoort bij wiskunde.")).toMatchObject({ disciplinesOk: true });
  });

  it("passes an empty answer with notes only where the case expects one", () => {
    const vague = { ...c, expectEmpty: true };
    expect(score([], "Wat moeten studenten kunnen?", vague)).toMatchObject({ pass: true });
    expect(score([], "Wat moeten studenten kunnen?")).toMatchObject({ pass: false });
    expect(score(good, null, vague)).toMatchObject({ pass: false });
  });

  it("fails an unparseable answer", () => {
    expect(scoreDesignCase(c, parseOutcomesDesign("kapot", emptyCourseData()))).toMatchObject({
      parse: false,
      pass: false,
    });
  });
});

describe("designReportMarkdown", () => {
  it("writes one row per case and the total", () => {
    const md = designReportMarkdown({
      date: "2026-11-11",
      model: "m",
      repeat: 1,
      rows: [score(good)],
    });
    expect(md).toContain("| x | ja | 3 |");
    expect(md).toContain("Geslaagd: 1 van 1.");
  });
});
