import { describe, expect, it } from "vitest";
import { getToolBySlugOrThrow } from "~/lib/registry";
import { validateTools } from "~/lib/registry/validate";
import type { Tool } from "~/lib/registry/types";

/** An image field can offer the figures of an uploaded document (`InputField.imagesFrom`). */
const base = getToolBySlugOrThrow("stage-assessment");
const withImagesFrom = (imagesFrom: string): Tool =>
  ({
    ...base,
    next: undefined,
    inputs: base.inputs.map((f) => (f.kind === "image" ? { ...f, imagesFrom } : f)),
  }) as Tool;

describe("InputField.imagesFrom — validation", () => {
  it("accepts a document field of the same tool", () => {
    expect(validateTools([withImagesFrom("document")])).toEqual([]);
  });

  it("refuses a field that does not exist or is not a document", () => {
    expect(validateTools([withImagesFrom("nope")]).length).toBeGreaterThan(0);
    expect(validateTools([withImagesFrom("documentType")]).length).toBeGreaterThan(0);
  });
});

describe("InputField.imagesFrom — the data", () => {
  it("the stage assessment offers the figures of the uploaded document", () => {
    const figures = base.inputs.find((f) => f.kind === "image");
    expect(figures?.imagesFrom).toBe("document");
  });
});
