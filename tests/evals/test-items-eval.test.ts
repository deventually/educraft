import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { COUNTED_CHECKS, parseHardChecks } from "../../scripts/eval-helpers";

const dir = join(__dirname, "../../evals/test-items");
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as {
  id: string;
  description: string;
  outputLanguage: string;
  values: Record<string, string>;
}[];

/** The quality gate of brief P24 for a new tool (24.3). */
describe("test-items eval meets the P24 quality gate", () => {
  it("has at least five cases: three ordinary, two with a known error, one in English", () => {
    expect(cases.length).toBeGreaterThanOrEqual(5);
    const known = cases.filter((c) => /known-error/.test(c.id));
    expect(known.length).toBeGreaterThanOrEqual(2);
    expect(cases.length - known.length).toBeGreaterThanOrEqual(3);
    expect(cases.some((c) => c.outputLanguage === "en")).toBe(true);
  });

  it("covers each question type and the brief's known errors", () => {
    const types = new Set(cases.map((c) => c.values.questionTypes));
    expect(types).toEqual(new Set(["multiple-choice", "mixed", "open"]));
    expect(cases.some((c) => /vague-outcome/.test(c.id))).toBe(true);
    expect(cases.some((c) => /create-with-mc/.test(c.id))).toBe(true);
    expect(cases.some((c) => /arithmetic/.test(c.id))).toBe(true);
  });

  it("only uses the tool's own inputs, and fills every required one", () => {
    const tool = getToolBySlug("test-items")!;
    const names = new Set(tool.inputs.map((f) => f.name));
    for (const c of cases) {
      for (const key of Object.keys(c.values)) expect(names.has(key), `${c.id}: ${key}`).toBe(true);
      for (const f of tool.inputs.filter((f) => f.required)) {
        expect(c.values[f.name]?.length, `${c.id}: ${f.name}`).toBeGreaterThan(0);
      }
    }
  });

  it("judges the brief's own expectations: one correct answer, no clue in the stem, a blueprint that adds up", () => {
    expect(rubric).toMatch(/Haladyna/);
    expect(rubric).toMatch(/Anderson & Krathwohl/);
    const ids = parseHardChecks(rubric).map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "missedKnownError",
        "twoCorrectAnswers",
        "clueInStem",
        "blueprintMismatch",
        "inventedContent",
        "unmarkedProposal",
      ]),
    );
  });
});

// Meting x: the judge took the @v3 layout (one heading per row, the question numbers below
// it) for a deviation, and a line with the A–D distribution for a missing table.
it("tells the judge the @v3 answer-model layout and the A–D line are the required format", () => {
  const flat = rubric.replace(/\s+/g, " ");
  expect(flat).toContain('"### Row Rx — level (questions a–b)"');
  expect(flat).toContain('"#### Question n"');
  expect(flat).toContain("is the required format, not a deviation");
  expect(flat).toContain("a line under the table");
});

// Metingen p, r2, u and w: a correction inside an answer-model heading, always at the first
// question of a new row. Counted in code: the judge named it only as the weakest aspect.
describe("correctionInHeading (counted)", () => {
  const output = (heading: string) =>
    ["### Stage: items", "", "## Answer model", "", heading, "", "**Correct answer:** B."].join(
      "\n",
    );
  const check = COUNTED_CHECKS.correctionInHeading!;

  it("is a counted hard check in the rubric", () => {
    expect(parseHardChecks(rubric).find((c) => c.id === "correctionInHeading")?.counted).toBe(true);
  });

  it("fails a heading that corrects its row", () => {
    expect(check(output("### Question 6 — Row R1 is not used here; Row R2, Evaluate"))).toBe(true);
    expect(check(output("### Question 6 — Row R1 is not used; this is Row R2, Evaluate"))).toBe(
      true,
    );
    expect(check(output("### Question 6 — Row R1→R2 note: Row R2, Evaluate"))).toBe(true);
    expect(check(output("### Question 5 — Row R1→R2: Row R2, Evaluate"))).toBe(true);
    expect(check(output("#### Vraag 6 — Rij R1 -> Rij R2"))).toBe(true);
  });

  it("passes clean headings, in the @v2 and the @v3 layout", () => {
    expect(check(output("### Question 6 — Row R2, Evaluate"))).toBe(false);
    expect(check(output("### Rij R2 — Evalueren (vraag 6–10)"))).toBe(false);
    expect(check(output("#### Vraag 6"))).toBe(false);
  });

  it("ignores arrows outside headings, such as a worked calculation", () => {
    expect(check(output("### Question 6 — Row R2, Apply\n\n- pulse 96 → 1 (band 91–110)"))).toBe(
      false,
    );
  });
});
