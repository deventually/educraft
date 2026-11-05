import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { parseHardChecks } from "../../scripts/eval-helpers";

const dir = join(__dirname, "../../evals/test-analysis");
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as {
  id: string;
  description: string;
  outputLanguage: string;
  values: Record<string, string>;
}[];

/** The quality gate of brief P24 for a new tool (24.5). */
describe("test-analysis eval meets the P24 quality gate", () => {
  it("has at least five cases: three ordinary, two with a known error, one in English", () => {
    expect(cases.length).toBeGreaterThanOrEqual(5);
    const known = cases.filter((c) => /known-error/.test(c.id));
    expect(known.length).toBeGreaterThanOrEqual(2);
    expect(cases.length - known.length).toBeGreaterThanOrEqual(3);
    expect(cases.some((c) => c.outputLanguage === "en")).toBe(true);
  });

  it("has a wrong answer key, too few candidates, and raw scores the tool must not compute", () => {
    expect(cases.some((c) => /wrong-key/.test(c.id) && c.values.questions !== "")).toBe(true);
    expect(cases.some((c) => /small-sample/.test(c.id))).toBe(true);
    expect(cases.some((c) => /raw-scores/.test(c.id))).toBe(true);
  });

  it("feeds numbers as the utility writes them, without names", () => {
    const fromUtility = cases.filter((c) => !/raw-scores/.test(c.id));
    for (const c of fromUtility) {
      expect(c.values.analysis, c.id).toMatch(/LimeOnIt\*\*\n/);
      expect(c.values.analysis, c.id).toMatch(/\| (Vraag|Question) \| Max \| p \| Rit \| Rir \|/);
    }
  });

  it("only uses the tool's own inputs", () => {
    const names = new Set(getToolBySlug("test-analysis")!.inputs.map((f) => f.name));
    for (const c of cases) {
      for (const key of Object.keys(c.values)) expect(names.has(key), `${c.id}: ${key}`).toBe(true);
    }
  });

  it("judges the brief's own expectations: the explanation fits the numbers and invents none", () => {
    expect(rubric).toMatch(/Cronbach/);
    const ids = parseHardChecks(rubric).map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "missedKnownError",
        "inventedNumbers",
        "wrongReading",
        "thresholdAsNorm",
        "inventedSources",
        "decidesForTeacher",
      ]),
    );
  });
});
