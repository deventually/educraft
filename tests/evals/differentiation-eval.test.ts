import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { parseHardChecks } from "../../scripts/eval-helpers";

const dir = join(__dirname, "../../evals/differentiation");
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as {
  id: string;
  description: string;
  outputLanguage: string;
  profile?: { eqf?: number };
  values: Record<string, string>;
}[];

/** The quality gate of brief P24 for a new tool (24.7). */
describe("differentiation eval meets the P24 quality gate", () => {
  it("has at least five cases: three ordinary, two with a known error, one in English", () => {
    expect(cases.length).toBeGreaterThanOrEqual(5);
    const known = cases.filter((c) => /known-error/.test(c.id));
    expect(known.length).toBeGreaterThanOrEqual(2);
    expect(cases.length - known.length).toBeGreaterThanOrEqual(3);
    expect(cases.some((c) => c.outputLanguage === "en")).toBe(true);
  });

  it("has the known errors: a vague goal, material that misses the goal, a lowered goal", () => {
    for (const kind of ["vague-goal", "material-mismatch", "lowered-goal"]) {
      expect(
        cases.some((c) => c.id.startsWith(kind) && /known-error/.test(c.id)),
        kind,
      ).toBe(true);
    }
  });

  it("covers an explanation as well as a task, and a spread of levels", () => {
    expect(cases.some((c) => /explanation/.test(c.id))).toBe(true);
    const levels = new Set(cases.map((c) => c.profile?.eqf));
    expect(Math.min(...[...levels].map(Number))).toBeLessThanOrEqual(4);
    expect(Math.max(...[...levels].map(Number))).toBeGreaterThanOrEqual(6);
  });

  it("only uses the tool's own inputs", () => {
    const names = new Set(getToolBySlug("differentiation")!.inputs.map((f) => f.name));
    for (const c of cases) {
      for (const key of Object.keys(c.values)) expect(names.has(key), `${c.id}: ${key}`).toBe(true);
    }
  });

  it("judges the brief's own expectations, including finding the known error", () => {
    expect(rubric).toMatch(/Tomlinson/);
    const ids = parseHardChecks(rubric).map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "missedKnownError",
        "differentGoal",
        "challengeIsMoreWork",
        "supportDoesTheThinking",
        "variantNotWrittenOut",
        "inventedSources",
        "wrongContent",
      ]),
    );
  });
});
