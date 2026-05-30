import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

describe("tool: dialogic-encounters", () => {
  it("registers and resolves by slug", () => {
    const tool = getToolBySlug("dialogic-encounters");
    expect(tool).toBeDefined();
    expect(tool?.slug).toBe("dialogic-encounters");
  });

  it("is a chat tool with greeting and starters", () => {
    const tool = getToolBySlug("dialogic-encounters")!;
    expect(tool.mode).toBe("chat");
    expect(tool.chat).toBeDefined();
    expect(tool.chat?.greeting).toBeDefined();
    expect(tool.chat?.starters).toBeDefined();
  });

  it("builds prompt with no unresolved placeholders", () => {
    const tool = getToolBySlug("dialogic-encounters")!;
    const inputs = {
      theorist: "Jean Piaget",
      theory: "Constructivism",
    };

    const prompt = buildSystemPrompt({
      promptId: tool.stages[0]!.systemPromptId,
      values: inputs,
      outputLanguage: "en",
    });

    expect(prompt).not.toMatch(/\{\{(\w+)\}\}/);
  });

  it("enforces required input fields", () => {
    const tool = getToolBySlug("dialogic-encounters")!;
    const requiredFields = tool.inputs.filter((f) => f.required);
    expect(requiredFields.length).toBeGreaterThan(0);
  });

  it("has theorist selection input", () => {
    const tool = getToolBySlug("dialogic-encounters")!;
    const theoristInput = tool.inputs.find((i) => i.name === "theorist");
    expect(theoristInput).toBeDefined();
    expect(theoristInput?.kind).toBe("select");
  });

  it("has NL/EN parity in greeting and starters", () => {
    const tool = getToolBySlug("dialogic-encounters")!;
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
    const tool = getToolBySlug("dialogic-encounters")!;
    for (const input of tool.inputs) {
      if (typeof input.label !== "string") {
        expect(input.label.nl).toBeDefined();
        expect(input.label.en).toBeDefined();
      }
    }
  });

  it("allows stop and regenerate", () => {
    const tool = getToolBySlug("dialogic-encounters")!;
    expect(tool.chat?.allowStop).toBe(true);
    expect(tool.chat?.allowRegenerate).toBe(true);
  });

  it("marks as for student users", () => {
    const tool = getToolBySlug("dialogic-encounters")!;
    expect(tool.userType).toBe("student");
  });
});
