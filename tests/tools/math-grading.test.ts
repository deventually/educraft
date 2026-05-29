import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

describe("tool: math-grading", () => {
  it("registers and resolves by slug", () => {
    const tool = getToolBySlug("math-grading");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("math-grading");
  });

  it("is a one-shot tool (not chat, not multi-stage)", () => {
    const tool = getToolBySlug("math-grading")!;
    expect(tool.mode).toBe("one-shot");
  });

  it("has exactly one stage", () => {
    const tool = getToolBySlug("math-grading")!;
    expect(tool.stages.length).toBe(1);
  });

  it("includes an image input field", () => {
    const tool = getToolBySlug("math-grading")!;
    const imageField = tool.inputs.find((f) => f.kind === "image");
    expect(imageField).toBeDefined();
    expect(imageField?.name).toBe("handwrittenResponse");
    expect(imageField?.accept).toBe("image/png,image/jpeg");
  });

  it("has text input fields for rubric and context", () => {
    const tool = getToolBySlug("math-grading")!;
    const rubricField = tool.inputs.find((f) => f.name === "rubric");
    const contextField = tool.inputs.find((f) => f.name === "learningContext");

    expect(rubricField).toBeDefined();
    expect(rubricField?.kind).toBe("textarea");
    expect(contextField).toBeDefined();
    expect(contextField?.kind).toBe("textarea");
  });

  it("marks image field as required", () => {
    const tool = getToolBySlug("math-grading")!;
    const imageField = tool.inputs.find((f) => f.kind === "image");
    expect(imageField?.required).toBe(true);
  });

  it("defaults to a vision-capable model", () => {
    const tool = getToolBySlug("math-grading")!;
    // Default model should support images
    // Typical choices: claude-sonnet-4-6, claude-opus-4-8
    expect(["claude-sonnet-4-6", "claude-opus-4-8"]).toContain(tool.defaultModel);
  });

  it("builds prompt with no unresolved placeholders", () => {
    const tool = getToolBySlug("math-grading")!;
    const inputs = {
      handwrittenResponse: "mock_base64_image_data", // Will be stripped from system prompt
      rubric: "Points awarded: 0-5 for setup, 0-5 for execution, 0-5 for reasoning",
      learningContext: "Grade 10 Algebra: solving systems of equations",
    };

    const prompt = buildSystemPrompt({
      promptId: tool.stages[0].systemPromptId,
      values: inputs,
      outputLanguage: "nl",
    });

    // Should not contain unresolved placeholders
    expect(prompt).not.toMatch(/\{\{(\w+)\}\}/);
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("enforces required fields", () => {
    const tool = getToolBySlug("math-grading")!;
    const requiredFields = tool.inputs.filter((f) => f.required);
    expect(requiredFields.length).toBeGreaterThan(0);

    // Image should be required
    const imageRequired = requiredFields.find((f) => f.kind === "image");
    expect(imageRequired).toBeDefined();
  });

  it("has NL/EN parity in all labels and help text", () => {
    const tool = getToolBySlug("math-grading")!;

    for (const input of tool.inputs) {
      // label must have both nl and en
      if (typeof input.label !== "string") {
        expect(input.label.nl).toBeDefined();
        expect(input.label.en).toBeDefined();
      }

      // placeholder, help, and group if present must also be bilingual
      if (input.placeholder && typeof input.placeholder !== "string") {
        expect(input.placeholder.nl).toBeDefined();
        expect(input.placeholder.en).toBeDefined();
      }

      if (input.help && typeof input.help !== "string") {
        expect(input.help.nl).toBeDefined();
        expect(input.help.en).toBeDefined();
      }

      if (input.group && typeof input.group !== "string") {
        expect(input.group.nl).toBeDefined();
        expect(input.group.en).toBeDefined();
      }
    }

    // Stage name and description must be bilingual
    const stage = tool.stages[0];
    expect(typeof stage.name !== "string" && stage.name.nl).toBeDefined();
    expect(typeof stage.name !== "string" && stage.name.en).toBeDefined();

    if (stage.description) {
      expect(typeof stage.description !== "string" && stage.description.nl).toBeDefined();
      expect(typeof stage.description !== "string" && stage.description.en).toBeDefined();
    }
  });

  it("has proper attribution to the book chapter", () => {
    const tool = getToolBySlug("math-grading")!;
    expect(tool.attribution).toBeDefined();
    expect(tool.attribution.chapterTitle).toContain("Math");
  });

  it("is enabled and marked for phase 1", () => {
    const tool = getToolBySlug("math-grading")!;
    expect(tool.enabled).toBe(true);
    expect(tool.phase).toBe(1);
  });

  it("is an instructor tool", () => {
    const tool = getToolBySlug("math-grading")!;
    expect(tool.userType).toBe("instructor");
  });

  it("has structured output format (sections or JSON)", () => {
    const tool = getToolBySlug("math-grading")!;
    const output = tool.stages[0].output;
    expect(["markdown", "json", "structured-sections"]).toContain(output.kind);
  });

  it("provides proper NL/EN output hints", () => {
    const tool = getToolBySlug("math-grading")!;
    const output = tool.stages[0].output;
    if (output.hint) {
      expect(typeof output.hint !== "string" && output.hint.nl).toBeDefined();
      expect(typeof output.hint !== "string" && output.hint.en).toBeDefined();
    }
  });
});
