import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { getPrompt } from "~/lib/prompts";

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

  it("lets the pedagogical approach stay empty (BDB/BKE plan, PR 3)", () => {
    const field = getToolBySlug("contextualization")!.inputs.find(
      (f) => f.name === "pedagogicalApproach",
    );
    expect(field?.required).not.toBe(true);
    expect(field?.label).toEqual({
      nl: "Jouw pedagogische benadering (optioneel)",
      en: "Your pedagogical approach (optional)",
    });
  });

  it("runs on @v2 and keeps @v1 registered", () => {
    expect(getToolBySlug("contextualization")!.stages[0].systemPromptId).toBe(
      "contextualization@v2",
    );
    expect(getPrompt("contextualization@v1").id).toBe("contextualization@v1");
    expect(getPrompt("contextualization@v2").verbatim).toBe(
      getPrompt("contextualization@v1").verbatim,
    );
  });

  for (const lang of ["nl", "en"] as const) {
    it(`@v2 infers the approach from the outline and says so when it is empty (${lang})`, () => {
      const prompt = buildSystemPrompt({
        promptId: "contextualization@v2",
        values: {
          courseOutline: "Hoorcolleges en een eindtoets.",
          learningObjectives: "De student legt de basisbegrippen uit.",
          pedagogicalApproach: "",
        },
        outputLanguage: lang,
      }).toLowerCase();
      expect(prompt).not.toMatch(/\{\{\w+\}\}/);
      if (lang === "nl") {
        expect(prompt).toContain("is de benadering leeg");
        expect(prompt).toContain("afgeleid uit je cursusopzet");
      } else {
        expect(prompt).toContain("if the approach is empty");
        expect(prompt).toContain("inferred from your course outline");
      }
    });
  }

  it("has NL/EN parity in labels", () => {
    const tool = getToolBySlug("contextualization")!;
    for (const input of tool.inputs) {
      expect(typeof input.label !== "string" && input.label.nl).toBeDefined();
      expect(typeof input.label !== "string" && input.label.en).toBeDefined();
    }
  });
});
