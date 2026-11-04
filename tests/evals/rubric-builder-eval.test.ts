import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { parseHardChecks } from "../../scripts/eval-helpers";

const dir = join(__dirname, "../../evals/rubric-builder");
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as {
  id: string;
  description: string;
  outputLanguage: string;
  values: Record<string, string>;
}[];

/** The quality gate of brief P24 for a new tool (24.2). */
describe("rubric-builder eval meets the P24 quality gate", () => {
  it("has at least five cases: three ordinary, two with a known error, one in English", () => {
    expect(cases.length).toBeGreaterThanOrEqual(5);
    const known = cases.filter((c) => /known-error/.test(c.id));
    expect(known.length).toBeGreaterThanOrEqual(2);
    expect(cases.length - known.length).toBeGreaterThanOrEqual(3);
    expect(cases.some((c) => c.outputLanguage === "en")).toBe(true);
  });

  it("has a case with an existing rubric whose levels overlap or are not observable", () => {
    expect(
      cases.some((c) => /known-error/.test(c.id) && (c.values.existingRubric ?? "").length > 0),
    ).toBe(true);
  });

  it("has a case with an outcome that is not observable, where the tool must sharpen first", () => {
    expect(cases.some((c) => /vague-outcome/.test(c.id))).toBe(true);
  });

  it("only uses the tool's own inputs", () => {
    const names = new Set(getToolBySlug("rubric-builder")!.inputs.map((f) => f.name));
    for (const c of cases) {
      for (const key of Object.keys(c.values)) expect(names.has(key), `${c.id}: ${key}`).toBe(true);
    }
  });

  it("judges the brief's own expectations, including finding the known error", () => {
    expect(rubric).toMatch(/Brookhart/);
    expect(rubric).toMatch(/self-check/i);
    const ids = parseHardChecks(rubric).map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "missedKnownError",
        "overlappingLevels",
        "inventedOutcomes",
        "inventedSources",
        "unmarkedProposal",
        "wrongArithmetic",
      ]),
    );
  });
});
