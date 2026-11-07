import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { parseHardChecks } from "../../scripts/eval-helpers";

const dir = join(__dirname, "../../evals/engagement-check");
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as {
  id: string;
  description: string;
  outputLanguage: string;
  values: Record<string, string>;
}[];

/** The measurement of brief P31.3: the book's own examples with their known scores. */
describe("engagement-check eval (P31.3)", () => {
  it("has the two worked examples of the book, legacy and enhanced, with their known scores", () => {
    for (const [id, score] of [
      ["book-e2-legacy", "6/18"],
      ["book-e2-enhanced", "14/18"],
      ["book-f2-legacy", "9/18"],
      ["book-f2-enhanced", "13/18"],
    ] as const) {
      const c = cases.find((x) => x.id === id);
      expect(c, id).toBeDefined();
      expect(c!.description, id).toContain(score);
    }
  });

  it("adds at least three hbo assignments, in Dutch", () => {
    const hbo = cases.filter((c) => c.id.startsWith("hbo-"));
    expect(hbo.length).toBeGreaterThanOrEqual(3);
    expect(hbo.every((c) => c.outputLanguage === "nl")).toBe(true);
  });

  it("only uses the tool's own inputs, and always the activity", () => {
    const names = new Set(getToolBySlug("engagement-check")!.inputs.map((f) => f.name));
    for (const c of cases) {
      expect(c.values.activity, c.id).toBeTruthy();
      for (const key of Object.keys(c.values)) expect(names.has(key), `${c.id}: ${key}`).toBe(true);
    }
  });

  it("caps the brief's failures: a level without evidence, an invented reason, another scale", () => {
    const checks = parseHardChecks(rubric);
    const cap = (id: string) => checks.find((c) => c.id === id)?.cap;
    expect(cap("levelWithoutEvidence")).toBe(2);
    expect(cap("inventedReason")).toBe(2);
    expect(cap("otherScale")).toBe(1);
    expect(cap("computedTotal")).toBeLessThanOrEqual(3);
  });
});
