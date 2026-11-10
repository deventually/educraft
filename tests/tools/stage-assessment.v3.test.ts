import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { PROMPTS } from "~/lib/prompts";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { defaultValuesFor } from "~/lib/forms/values";
import { loc } from "~/lib/i18n/localized";

/**
 * Assessment models: the framework and scale no longer start as the HBO-i Informatica
 * internship model. The teacher picks a model (own or starter); the framework stays required,
 * the scale becomes optional. Without a scale the prompt (@v3) gives feedback only.
 */
const tool = () => getToolBySlug("stage-assessment")!;
const field = (name: string) => tool().inputs.find((f) => f.name === name);

const base = {
  document: "x",
  documentType: "essay",
  track: "",
  studyYear: 2,
  durationWeeks: "",
  assessmentFramework: "C1 stelling",
  assessmentScale: "",
  companyEvaluation: "",
  submissionNotes: "",
};
const build = (lang: "nl" | "en", values: Record<string, unknown> = base) =>
  buildSystemPrompt({
    promptId: tool().stages[0]!.systemPromptId,
    values: values as Record<string, string>,
    outputLanguage: lang,
  });

describe("tool: stage-assessment with assessment models", () => {
  it("runs on stage-assessment@v3 and keeps @v1 and @v2 registered", () => {
    expect(tool().stages[0]!.systemPromptId).toBe("stage-assessment@v3");
    for (const v of ["@v1", "@v2", "@v3"]) expect(PROMPTS[`stage-assessment${v}`]).toBeDefined();
  });

  it("starts with an empty framework and scale instead of the Informatica model", () => {
    const values = defaultValuesFor(tool().inputs);
    expect(values.assessmentFramework).toBe("");
    expect(values.assessmentScale).toBe("");
  });

  it("keeps the framework required and makes the scale optional", () => {
    expect(field("assessmentFramework")?.required).toBe(true);
    expect(field("assessmentScale")?.required).not.toBe(true);
  });

  it("lets an assessment model fill both fields, chosen by the document type", () => {
    expect(tool().assessmentModels).toEqual({ byField: "documentType" });
    expect(field("assessmentFramework")?.prefillFromAssessmentModel).toEqual({
      source: "framework",
    });
    expect(field("assessmentScale")?.prefillFromAssessmentModel).toEqual({ source: "scale" });
  });

  it("tells the teacher where the framework comes from and what an empty scale means", () => {
    expect(loc(field("assessmentFramework")?.placeholder, "nl")).toMatch(/beoordelingsmodel/i);
    expect(loc(field("assessmentFramework")?.placeholder, "en")).toMatch(/assessment model/i);
    expect(loc(field("assessmentScale")?.help, "nl")).toMatch(/alleen feedback/i);
    expect(loc(field("assessmentScale")?.help, "en")).toMatch(/feedback only/i);
  });

  it("gives feedback only, without a judgement, when no scale is given", () => {
    const nl = build("nl");
    expect(nl).toMatch(/geen beoordelingsschaal/i);
    expect(nl).toMatch(/alleen feedback/i);
    const en = build("en");
    expect(en).toMatch(/no grading scale/i);
    expect(en).toMatch(/feedback only/i);
  });

  it("leaves no placeholder unresolved, with or without a scale", () => {
    for (const lang of ["nl", "en"] as const) {
      expect(build(lang)).not.toMatch(/\{\{/);
      expect(build(lang, { ...base, assessmentScale: "O/V/G" })).not.toMatch(/\{\{/);
    }
  });

  it("no longer tells the teacher the HBO-i model is pre-filled by default", async () => {
    const { readFileSync } = await import("node:fs");
    const help = (lang: string) =>
      readFileSync(`app/content/help/tools/stage-assessment.${lang}.md`, "utf8");
    expect(help("nl")).not.toMatch(/Standaard staat het HBO-i/);
    expect(help("nl")).toMatch(/beoordelingsmodel/i);
    expect(help("en")).not.toMatch(/HBO-i internship rubric \(level 2\) is pre-filled by default/);
    expect(help("en")).toMatch(/assessment model/i);
    expect(loc(tool().attribution.source, "nl")).not.toMatch(/standaardkader/i);
  });
});
