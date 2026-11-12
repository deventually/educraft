import { readFileSync } from "node:fs";
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
      kindOf("socratic-partner", getToolBySlugOrThrow("socratic-partner").stages[0]!.id),
    ).toBeUndefined();
  });
});

/** P30.4: a slides result says which of its headings become the deck, in both languages. */
describe("OutputFormat.slides (P30.4)", () => {
  const stage = base.stages[0]!;
  const withOutput = (output: object): Tool =>
    ({ ...base, next: undefined, stages: [{ ...stage, output }] }) as Tool;

  it("is required for a slides result", () => {
    const { slides: _, ...rest } = stage.output;
    expect(validateTools([withOutput({ ...rest, exportAs: "slides" })]).length).toBeGreaterThan(0);
  });

  it("needs all three headings in both languages", () => {
    const slides = { ...stage.output.slides, closing: { nl: "Terugkomen" } };
    expect(validateTools([withOutput({ ...stage.output, slides })]).length).toBeGreaterThan(0);
  });

  it("names headings the lesson-plan prompt really writes, in each language", () => {
    const outline = stage.output.slides;
    expect(outline).toBeDefined();
    for (const locale of ["nl", "en"] as const) {
      const prompt = readFileSync(`app/lib/prompts/files/lesson-plan.${locale}.md`, "utf8");
      for (const heading of Object.values(outline!)) expect(prompt).toContain(heading[locale]);
    }
  });
});
