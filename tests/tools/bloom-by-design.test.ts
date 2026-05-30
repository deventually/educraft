import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

describe("tool: bloom-by-design", () => {
  it("registers and resolves by slug", () => {
    const tool = getToolBySlug("bloom-by-design");
    expect(tool).toBeDefined();
    expect(tool?.slug).toBe("bloom-by-design");
  });

  it("is a chat tool with greeting and starters", () => {
    const tool = getToolBySlug("bloom-by-design")!;
    expect(tool.mode).toBe("chat");
    expect(tool.chat).toBeDefined();
    expect(tool.chat?.greeting).toBeDefined();
    expect(tool.chat?.starters).toBeDefined();
  });

  it("builds prompt with no unresolved placeholders", () => {
    const tool = getToolBySlug("bloom-by-design")!;
    const inputs = {
      learningOutcome: "Students will be able to analyze case studies",
      assessmentGoals: "Evaluate critical thinking skills",
      context: "Business management course",
    };

    const prompt = buildSystemPrompt({
      promptId: tool.stages[0]!.systemPromptId,
      values: inputs,
      outputLanguage: "en",
    });

    expect(prompt).not.toMatch(/\{\{(\w+)\}\}/);
    expect(prompt).toContain("learning");
  });

  it("enforces required input fields", () => {
    const tool = getToolBySlug("bloom-by-design")!;
    const requiredFields = tool.inputs.filter((f) => f.required);
    expect(requiredFields.length).toBeGreaterThan(0);
  });

  it("has NL/EN parity in greeting and starters", () => {
    const tool = getToolBySlug("bloom-by-design")!;
    if (tool.chat?.greeting && typeof tool.chat.greeting !== "string") {
      expect(tool.chat.greeting.nl).toBeDefined();
      expect(tool.chat.greeting.en).toBeDefined();
    }
    for (const starter of tool.chat?.starters || []) {
      if (typeof starter !== "string") {
        expect(starter.nl).toBeDefined();
        expect(starter.en).toBeDefined();
      }
    }
  });

  it("has NL/EN parity in labels", () => {
    const tool = getToolBySlug("bloom-by-design")!;
    for (const input of tool.inputs) {
      if (typeof input.label !== "string") {
        expect(input.label.nl).toBeDefined();
        expect(input.label.en).toBeDefined();
      }
    }
  });

  it("allows stop and regenerate", () => {
    const tool = getToolBySlug("bloom-by-design")!;
    expect(tool.chat?.allowStop).toBe(true);
    expect(tool.chat?.allowRegenerate).toBe(true);
  });

  it("marks as for student users", () => {
    const tool = getToolBySlug("bloom-by-design")!;
    expect(tool.userType).toBe("student");
  });
});
