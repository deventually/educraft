import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type FrameworkCase,
  frameworkReportMarkdown,
  scoreFrameworkCase,
} from "../../scripts/eval-framework-helpers";
import { buildExtractMessage, parseExtraction } from "~/lib/portfolio/extract";
import { normalizeForMatch } from "~/lib/documents/locate";

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "evals", "portfolio-framework", "cases.json"), "utf8"),
).cases as FrameworkCase[];

/** The answer a perfect model gives for a case: built from the expectations. */
function perfectAnswer(c: FrameworkCase): string {
  return JSON.stringify({
    institution: null,
    outcomes: c.expect.map((e) => ({
      code: `LU${e.code}`,
      title: "t",
      // Real criteria texts: the full line of the form that holds the fragment.
      criteria: e.criteria.map((frag) => ({ text: lineWith(c.form, frag) })),
      requiredEvidence: [],
      outline: e.sections.map((s) => ({ title: s.title, criteria: s.covers ?? [] })),
      literature: e.literature.map((frag) => lineWith(c.form, frag).replace(/^- /, "")),
    })),
  });
}

/** The form's text from the fragment's sentence start to its end, joined over a hyphenated break. */
function lineWith(form: string, frag: string): string {
  const flat = form.replace(/-\n/g, "").replace(/\n/g, " \n");
  const line = flat.split("\n").find((l) => l.toLowerCase().includes(frag.toLowerCase()));
  if (!line) throw new Error(`fragment not in form: ${frag}`);
  return line.replace(/^\s*(\d+\.|-)\s*/, "").trim();
}

describe("portfolio-framework eval cases", () => {
  it("covers a prescribed outline, a form without one and English with an injection", () => {
    expect(cases.map((c) => c.id)).toEqual(
      expect.arrayContaining(["outline-lesson-design", "no-outline", "outline-en-injection"]),
    );
    expect(cases.some((c) => c.locale === "en")).toBe(true);
  });

  it("has expectations that are in the form, with covers that point at a criterion", () => {
    for (const c of cases) {
      const form = normalizeForMatch(c.form).toLowerCase();
      for (const e of c.expect) {
        for (const frag of [...e.criteria, ...e.literature, ...e.sections.map((s) => s.title)])
          expect(form, `${c.id}: ${frag}`).toContain(normalizeForMatch(frag).toLowerCase());
        for (const s of e.sections)
          for (const n of s.covers ?? []) expect(e.criteria[n - 1], `${c.id}`).toBeDefined();
      }
      expect(buildExtractMessage(c.form)).toContain(c.form);
    }
  });

  it("passes a perfect answer on every case", () => {
    for (const c of cases) {
      const s = scoreFrameworkCase(c, parseExtraction(perfectAnswer(c), c.form));
      expect(s, c.id).toMatchObject({ parse: true, pass: true, unverified: 0, extra: 0 });
    }
  });
});

describe("scoreFrameworkCase", () => {
  const c = cases.find((x) => x.id === "outline-lesson-design")!;

  it("fails an answer without the outline (what v1 gives)", () => {
    const answer = JSON.parse(perfectAnswer(c));
    for (const o of answer.outcomes) {
      delete o.outline;
      delete o.literature;
    }
    const s = scoreFrameworkCase(c, parseExtraction(JSON.stringify(answer), c.form));
    expect(s).toMatchObject({ parse: true, criteria: 1, sections: 0, literature: 0, pass: false });
  });

  it("counts an invented section per criterion where the form gives none", () => {
    const none = cases.find((x) => x.id === "no-outline")!;
    const answer = JSON.parse(perfectAnswer(none));
    answer.outcomes[0].outline = [{ title: "Toetsvragen", criteria: [1] }];
    const s = scoreFrameworkCase(none, parseExtraction(JSON.stringify(answer), none.form));
    expect(s.extra).toBe(1);
    expect(s.pass).toBe(false);
  });

  it("counts a wrong criterion link", () => {
    const answer = JSON.parse(perfectAnswer(c));
    answer.outcomes[0].outline[0].criteria = [1];
    const s = scoreFrameworkCase(c, parseExtraction(JSON.stringify(answer), c.form));
    expect(s.covers).toBeLessThan(1);
    expect(s.pass).toBe(false);
  });

  it("scores an unparseable answer as a fail", () => {
    const s = scoreFrameworkCase(c, parseExtraction("geen json", c.form));
    expect(s).toMatchObject({ parse: false, pass: false, criteria: 0 });
  });

  it("writes a Dutch report that names the prompt", () => {
    const row = scoreFrameworkCase(c, parseExtraction(perfectAnswer(c), c.form));
    const md = frameworkReportMarkdown({
      date: "2026-11-11",
      model: "m",
      promptId: "portfolio-framework@v2",
      repeat: 1,
      rows: [row],
    });
    expect(md).toContain("portfolio-framework@v2");
    expect(md).toContain("Geslaagd: 1 van 1.");
  });
});
