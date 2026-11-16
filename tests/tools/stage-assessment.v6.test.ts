import { describe, expect, it } from "vitest";
import { PROMPTS } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

/**
 * @v6: the summary for OnStage follows OnStage's assessment form: one general feedback at the
 * top (with both reports, combined over both), then per report a remark per criterion.
 * @v1 to @v5 stay registered.
 */
const tool = () => getToolBySlug("stage-assessment")!;
const stage = () => tool().stages[0]!;

const base = {
  document: "x",
  documentType: "stageverslag+onderzoeksverslag",
  track: "",
  studyYear: 3,
  durationWeeks: "",
  assessmentFramework: "SC1 Analyse",
  assessmentScale: "",
  companyEvaluation: "",
  submissionNotes: "",
  feedbackHistory: "",
};
const build = (lang: "nl" | "en") =>
  buildSystemPrompt({
    promptId: stage().systemPromptId,
    values: base as unknown as Record<string, string>,
    outputLanguage: lang,
  });

describe("tool: stage-assessment, both reports together in the summary for OnStage (@v6)", () => {
  it("runs on stage-assessment@v6 and keeps @v1 to @v5 registered", () => {
    expect(stage().systemPromptId).toBe("stage-assessment@v6");
    for (const v of ["@v1", "@v2", "@v3", "@v4", "@v5", "@v6"])
      expect(PROMPTS[`stage-assessment${v}`]).toBeDefined();
  });

  it("follows OnStage's form: one general feedback on top, combined over both reports", () => {
    const nl = build("nl");
    expect(nl).toMatch(
      /### Algemene feedback.*gecombineerde feedback over beide verslagen.*### Stageverslag/s,
    );
    // Per report the teacher keeps a short general feedback of its own, under the combined one.
    expect(nl).toMatch(/### Stageverslag.*#### Algemene feedback.*alleen over dit verslag/s);
    expect(nl).not.toContain("### Algemeen (beide verslagen)");
    const en = build("en");
    expect(en).toMatch(
      /### General feedback.*combined feedback on both reports.*### Internship report/s,
    );
    expect(en).toMatch(/### Internship report.*#### General feedback.*only about this report/s);
    expect(en).not.toContain("### General (both reports)");
  });

  it("always names the report in a heading, also with one report, and keeps word counts a guideline", () => {
    expect(build("nl")).toMatch(/ook bij één verslag/i);
    expect(build("en")).toMatch(/also with one report/i);
    expect(build("nl")).toMatch(/richtlijn/i);
    expect(build("en")).toMatch(/guideline/i);
  });

  it("leaves no placeholder in either language", () => {
    for (const lang of ["nl", "en"] as const) expect(build(lang)).not.toMatch(/\{\{/);
  });
});
