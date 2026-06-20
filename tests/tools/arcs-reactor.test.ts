import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { profilePrefillValues } from "~/lib/forms/values";
import type { ContextProfile } from "~/lib/context/types";

const profile = (studyYear?: 1 | 2 | 3 | 4): ContextProfile => ({
  id: "p",
  name: "p",
  studyYear,
});

describe("tool: arcs-reactor", () => {
  it("registers and resolves by slug", () => {
    const tool = getToolBySlug("arcs-reactor");
    expect(tool?.id).toBe("arcs-reactor");
  });

  it("builds prompt with no unresolved placeholders", () => {
    const tool = getToolBySlug("arcs-reactor")!;
    const inputs = {
      discipline: "Web development",
      cursusniveau: "main phase (years 2-3)",
      modaliteit: "in-person",
      groepsgrootte: 30,
      studentkenmerken: "strong programmers, little maths",
      barriere: "students skip the automated-testing exercises",
    };
    const prompt = buildSystemPrompt({
      promptId: tool.stages[0].systemPromptId,
      values: inputs,
      outputLanguage: "nl",
    });
    expect(prompt).not.toMatch(/\{\{(\w+)\}\}/);
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("puts the required motivation problem before the optional student background", () => {
    const tool = getToolBySlug("arcs-reactor")!;
    const names = tool.inputs.map((f) => f.name);
    const barriere = tool.inputs.find((f) => f.name === "barriere")!;
    const kenmerken = tool.inputs.find((f) => f.name === "studentkenmerken")!;
    // The load-bearing barrier (what the ARCS-V diagnosis keys off) comes first;
    // the optional background field follows, so the two can't be confused.
    expect(names.indexOf("barriere")).toBeLessThan(names.indexOf("studentkenmerken"));
    expect(barriere.required).toBe(true);
    expect(kenmerken.required).toBeFalsy();
  });

  it("forces a conscious course-level choice (no silent year-1 default)", () => {
    const tool = getToolBySlug("arcs-reactor")!;
    const level = tool.inputs.find((f) => f.name === "cursusniveau")!;
    // No default => the form starts unselected; a placeholder makes that visible
    // and `required` blocks submit until the teacher picks the real level.
    expect(level.defaultValue).toBeUndefined();
    expect(level.placeholder).toBeDefined();
    expect(level.required).toBe(true);
  });

  it("prefills course level from the profile's study year (no double entry)", () => {
    const tool = getToolBySlug("arcs-reactor")!;
    const level = tool.inputs.find((f) => f.name === "cursusniveau")!;
    expect(level.prefillFromProfile?.source).toBe("studyYear");
    // Years 2 and 3 both map to the main phase; year 4 to graduation.
    expect(profilePrefillValues(tool.inputs, profile(2)).cursusniveau).toBe(
      "main phase (years 2-3)",
    );
    expect(profilePrefillValues(tool.inputs, profile(3)).cursusniveau).toBe(
      "main phase (years 2-3)",
    );
    expect(profilePrefillValues(tool.inputs, profile(4)).cursusniveau).toBe(
      "graduation phase (year 4)",
    );
    // No study year (or no profile) → not prefilled, so it stays a conscious choice.
    expect(profilePrefillValues(tool.inputs, profile(undefined)).cursusniveau).toBeUndefined();
    expect(profilePrefillValues(tool.inputs, null).cursusniveau).toBeUndefined();
  });

  it("has NL/EN parity in labels", () => {
    const tool = getToolBySlug("arcs-reactor")!;
    for (const input of tool.inputs) {
      expect(typeof input.label !== "string" && input.label.nl).toBeDefined();
      expect(typeof input.label !== "string" && input.label.en).toBeDefined();
    }
  });
});
