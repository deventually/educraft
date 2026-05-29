import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

describe("tool: forum-autograder", () => {
  it("registers and resolves by slug", () => {
    const tool = getToolBySlug("forum-autograder");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("forum-autograder");
  });

  it("builds prompt with no unresolved placeholders", () => {
    const tool = getToolBySlug("forum-autograder")!;
    const inputs = {
      discussionThread: "Sample forum discussion text",
      learningObjectives: "Students should understand key concepts",
      rubric: "Quality of reasoning, evidence, participation",
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
    const tool = getToolBySlug("forum-autograder")!;
    const requiredFields = tool.inputs.filter((f) => f.required);
    expect(requiredFields.length).toBeGreaterThan(0);
  });

  it("has NL/EN parity in labels", () => {
    const tool = getToolBySlug("forum-autograder")!;
    for (const input of tool.inputs) {
      expect(typeof input.label !== "string" && input.label.nl).toBeDefined();
      expect(typeof input.label !== "string" && input.label.en).toBeDefined();
    }
  });
});
