import { describe, expect, it } from "vitest";
import { getToolBySlugOrThrow } from "~/lib/registry";
import { validateTools } from "~/lib/registry/validate";
import type { Tool } from "~/lib/registry/types";

/** P30.1: a stage says what its result is (`output.exportAs`); the export picks the formats. */
const base = getToolBySlugOrThrow("lesson-plan");
const withExportAs = (exportAs: unknown): Tool =>
  ({
    ...base,
    next: undefined,
    stages: base.stages.map((s) => ({ ...s, output: { ...s.output, exportAs } })),
  }) as Tool;

describe("OutputFormat.exportAs — validation (P30.1)", () => {
  it("accepts a known kind", () => {
    expect(validateTools([withExportAs("table")])).toEqual([]);
  });

  it("refuses an unknown kind", () => {
    expect(validateTools([withExportAs("spreadsheet")]).length).toBeGreaterThan(0);
  });
});

describe("OutputFormat.exportAs — the data (P30.1)", () => {
  const kindOf = (slug: string, stageId: string) =>
    getToolBySlugOrThrow(slug).stages.find((s) => s.id === stageId)?.output.exportAs;

  it.each([
    ["test-items", "blueprint", "table"],
    ["test-items", "items", "test-items"],
    ["rubric-builder", "rubric", "rubric"],
    ["lesson-plan", "lesson", "slides"],
    ["test-analysis", "explain", "table"],
    ["stage-assessment", "assessment", "table"],
  ])("%s · %s is a %s", (slug, stageId, kind) => {
    expect(kindOf(slug, stageId)).toBe(kind);
  });

  it("leaves every other result a plain document (no kind set)", () => {
    expect(
      kindOf("socratic-partner", getToolBySlugOrThrow("socratic-partner").stages[0].id),
    ).toBeUndefined();
  });
});
