import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";

/**
 * The nulmeting (evals/reports/2026-11-04.md) showed these tools stopping mid-sentence:
 * their full output structure does not fit the old budget. The same budget applies in
 * the app, so teachers got cut-off advice too. Pin a budget that fits.
 */
describe("output budget for long structured outputs", () => {
  it.each([
    ["arcs-reactor", 12288],
    ["authentic-assessment", 12288],
    ["cognitive-architect", 12288],
    ["forum-autograder", 8192],
    // Meting d (2026-11-04d): 2 of 3 eqf6 runs stopped mid-text at 6144.
    ["guided-reflection", 12288],
  ])("%s has room for its whole structure", (slug, min) => {
    const tool = getToolBySlug(slug);
    expect(tool).toBeDefined();
    for (const stage of tool!.stages) {
      expect(stage.maxTokens ?? tool!.defaultMaxTokens ?? 0, stage.id).toBeGreaterThanOrEqual(min);
    }
  });
});
