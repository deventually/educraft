import { describe, expect, it } from "vitest";
import { getToolBySlugOrThrow } from "~/lib/registry";
import { validateTools } from "~/lib/registry/validate";
import type { Tool } from "~/lib/registry/types";

/** Fields filled from an assessment model, chosen by a select field (`Tool.assessmentModels`). */
const base = getToolBySlugOrThrow("stage-assessment");
const tool = (patch: Partial<Tool>): Tool => ({ ...base, next: undefined, ...patch }) as Tool;

describe("Tool.assessmentModels — validation", () => {
  it("accepts the stage assessment as it is", () => {
    expect(validateTools([tool({})])).toEqual([]);
  });

  it("refuses a byField that does not exist or is not a select", () => {
    expect(validateTools([tool({ assessmentModels: { byField: "nope" } })]).length).toBeGreaterThan(
      0,
    );
    expect(
      validateTools([tool({ assessmentModels: { byField: "track" } })]).length,
    ).toBeGreaterThan(0);
  });

  it("refuses model-backed fields on a tool without assessment models", () => {
    expect(validateTools([tool({ assessmentModels: undefined })]).length).toBeGreaterThan(0);
  });
});
