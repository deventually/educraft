import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

describe("tool: peer-tutoring", () => {
  it("registers and resolves by slug", () => {
    const tool = getToolBySlug("peer-tutoring");
    expect(tool).toBeDefined();
    expect(tool?.slug).toBe("peer-tutoring");
  });

  it("is a chat tool with greeting and starters", () => {
    const tool = getToolBySlug("peer-tutoring")!;
    expect(tool.mode).toBe("chat");
    expect(tool.chat).toBeDefined();
    expect(tool.chat?.greeting).toBeDefined();
    expect(tool.chat?.starters).toBeDefined();
  });

  it("builds prompt with no unresolved placeholders", () => {
    const tool = getToolBySlug("peer-tutoring")!;
    const inputs = {
      assignment: "Literature review on climate change",
      discipline: "Environmental Science",
    };

    const prompt = buildSystemPrompt({
      promptId: tool.stages[0]!.systemPromptId,
      values: inputs,
      outputLanguage: "en",
    });

    expect(prompt).not.toMatch(/\{\{(\w+)\}\}/);
    expect(prompt).toContain("source");
  });

  it("retires the bespoke level input (level now flows from the cohort profile)", () => {
    const tool = getToolBySlug("peer-tutoring")!;
    expect(tool.inputs.some((f) => f.name === "level")).toBe(false);
    expect(tool.usesContextProfile).toBe(true);
  });

  it("enforces required input fields", () => {
    const tool = getToolBySlug("peer-tutoring")!;
    const requiredFields = tool.inputs.filter((f) => f.required);
    expect(requiredFields.length).toBeGreaterThan(0);
  });

  it("has NL/EN parity in greeting and starters", () => {
    const tool = getToolBySlug("peer-tutoring")!;
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
    const tool = getToolBySlug("peer-tutoring")!;
    for (const input of tool.inputs) {
      if (typeof input.label !== "string") {
        expect(input.label.nl).toBeDefined();
        expect(input.label.en).toBeDefined();
      }
    }
  });

  it("allows stop and regenerate", () => {
    const tool = getToolBySlug("peer-tutoring")!;
    expect(tool.chat?.allowStop).toBe(true);
    expect(tool.chat?.allowRegenerate).toBe(true);
  });

  it("marks as for student users", () => {
    const tool = getToolBySlug("peer-tutoring")!;
    expect(tool.userType).toBe("student");
  });
});
