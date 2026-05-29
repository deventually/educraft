import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

describe("tool: contextualization", () => {
  it("registers and resolves by slug", () => {
    const tool = getToolBySlug("contextualization");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("contextualization");
  });

  it("builds prompt with no unresolved placeholders", () => {
    const tool = getToolBySlug("contextualization")!;
    const inputs = {
      courseOutline: "Course covers fundamentals of programming",
      learningObjectives: "Students will write simple programs",
      pedagogicalApproach: "Active learning with peer programming",
    };

    const prompt = buildSystemPrompt({
      promptId: tool.stages[0].systemPromptId,
      values: inputs,
      outputLanguage: "nl",
    });
    expect(prompt).not.toMatch(/\{\{(\w+)\}\}/);
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("enforces required fields", () => {
    const tool = getToolBySlug("contextualization")!;
    const requiredFields = tool.inputs.filter((f) => f.required);
    expect(requiredFields.length).toBeGreaterThan(0);
  });

  it("has NL/EN parity in labels", () => {
    const tool = getToolBySlug("contextualization")!;
    for (const input of tool.inputs) {
      expect(typeof input.label !== "string" && input.label.nl).toBeDefined();
      expect(typeof input.label !== "string" && input.label.en).toBeDefined();
    }
  });
});
