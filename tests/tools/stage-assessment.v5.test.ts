import { describe, expect, it } from "vitest";
import { PROMPTS } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { loc } from "~/lib/i18n/localized";

/**
 * Feedback per report and a summary for OnStage: the internship report and the research report
 * can be assessed together (feedback per report, clearly labelled, plus general feedback for
 * both) or on their own (feedback only about that report). Every result ends its analysis with a
 * short summary per report, paste-ready for OnStage, with a Copy button. @v1 to @v4 stay.
 */
const tool = () => getToolBySlug("stage-assessment")!;
const stage = () => tool().stages[0]!;
const BOTH = "stageverslag+onderzoeksverslag";

const base = {
  document: "x",
  documentType: BOTH,
  track: "",
  studyYear: 3,
  durationWeeks: "",
  assessmentFramework: "C1 Analyse",
  assessmentScale: "",
  companyEvaluation: "",
  submissionNotes: "",
  feedbackHistory: "",
};
const build = (lang: "nl" | "en", values: Record<string, unknown> = base) =>
  buildSystemPrompt({
    promptId: stage().systemPromptId,
    values: values as Record<string, string>,
    outputLanguage: lang,
  });

describe("tool: stage-assessment, feedback per report and a summary for OnStage", () => {
  it("runs on stage-assessment@v5 and keeps @v1 to @v4 registered", () => {
    expect(stage().systemPromptId).toBe("stage-assessment@v5");
    for (const v of ["@v1", "@v2", "@v3", "@v4", "@v5"])
      expect(PROMPTS[`stage-assessment${v}`]).toBeDefined();
  });

  it("offers both reports together as a document type, keeping the old values", () => {
    const options = tool().inputs.find((f) => f.name === "documentType")?.options ?? [];
    const both = options.find((o) => o.value === BOTH);
    expect(loc(both?.label, "nl")).toBe("Stageverslag + onderzoeksverslag (samen)");
    expect(loc(both?.label, "en")).toBe("Internship report + research report (together)");
    expect(options.slice(0, 2).map((o) => o.value)).toEqual(["stageverslag", "onderzoeksverslag"]);
  });

  it("asks for feedback per report, labelled, and general feedback for both", () => {
    const nl = build("nl");
    expect(nl).toContain(BOTH);
    expect(nl).toMatch(/per verslag/i);
    expect(nl).toContain("### Feedback stageverslag");
    expect(nl).toContain("### Feedback onderzoeksverslag");
    expect(nl).toContain("### Algemene feedback (beide verslagen)");
    expect(nl).toMatch(/bewijs uit het ene verslag.*nooit.*ander/i);
    const en = build("en");
    expect(en).toMatch(/per report/i);
    expect(en).toContain("### Feedback internship report");
    expect(en).toContain("### Feedback research report");
    expect(en).toContain("### General feedback (both reports)");
  });

  it("with one report, keeps all feedback and the summary to that report", () => {
    expect(build("nl")).toMatch(/één verslag.*alleen over dat verslag/i);
    expect(build("en")).toMatch(/one report.*only about that report/i);
  });

  it("asks for a short summary per report under the heading the Copy buttons read", () => {
    const heading = stage().output.copyBlocks;
    expect(heading).toEqual({ nl: "Samenvatting voor OnStage", en: "Summary for OnStage" });
    expect(build("nl")).toContain("## 4. Samenvatting voor OnStage");
    expect(build("en")).toContain("## 4. Summary for OnStage");
    // As OnStage asks it: per report a general feedback field and a remark per criterion.
    expect(build("nl")).toContain("#### Algemene feedback");
    expect(build("nl")).toMatch(/per succescriterium.*#### SC1/i);
    expect(build("en")).toContain("#### General feedback");
    expect(build("en")).toMatch(/per success criterion.*#### SC1/i);
  });

  it("leaves no placeholder in either language", () => {
    for (const lang of ["nl", "en"] as const) expect(build(lang)).not.toMatch(/\{\{/);
  });
});
