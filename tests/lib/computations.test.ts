import { describe, expect, it } from "vitest";
import { getToolBySlugOrThrow } from "~/lib/registry";
import { validateTools } from "~/lib/registry/validate";
import { COMPUTATION_IDS, computeResultNote } from "~/lib/template/computations";

/**
 * P31.3 — a stage can name a computation (`output.computed`) that turns its finished
 * output into a short note computed in code, shown under the result. Registry data,
 * validated at boot; no per-tool branch in the UI.
 */
describe("result computations", () => {
  it("knows the engagement score", () => {
    expect(COMPUTATION_IDS).toContain("engagement-index");
  });

  it("returns the note for a stage that names a computation", () => {
    const table = [
      "| Retrieval Practice | High (3) | x |",
      "| Spaced Practice | High (3) | x |",
      "| Interleaving | High (3) | x |",
      "| Dual Coding | High (3) | x |",
      "| Concrete Examples | High (3) | x |",
      "| Elaboration | High (3) | x |",
    ].join("\n");
    expect(computeResultNote("engagement-index", table, "en")).toBe(
      "Engagement score: 18 of 18 points (100%).",
    );
  });

  it("returns null without a computation", () => {
    expect(computeResultNote(undefined, "anything", "nl")).toBeNull();
  });

  it("refuses an unknown computation id at boot", () => {
    const base = getToolBySlugOrThrow("differentiation");
    const broken = {
      ...base,
      stages: [{ ...base.stages[0]!, output: { kind: "markdown" as const, computed: "nope" } }],
    };
    // @ts-expect-error an unknown id is exactly what validation must catch
    const issues = validateTools([broken]);
    expect(issues.length).toBeGreaterThan(0);
  });
});
