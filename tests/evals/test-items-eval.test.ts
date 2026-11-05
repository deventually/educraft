import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { parseHardChecks } from "../../scripts/eval-helpers";

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
