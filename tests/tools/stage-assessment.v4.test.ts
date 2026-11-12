import { describe, expect, it } from "vitest";
import { PROMPTS } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { loc } from "~/lib/i18n/localized";

/**
 * P38.4: opened from a track, the final assessment gets the earlier feedback of that track
 * (`{{feedbackHistory}}`, empty outside a track) and says per criterion whether the improvement
 * asked for earlier was taken up. @v3 stays registered.
 */
const tool = () => getToolBySlug("stage-assessment")!;
const field = () => tool().inputs.find((f) => f.name === "feedbackHistory");

const base = {
  document: "x",
  documentType: "stageverslag",
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
    promptId: tool().stages[0]!.systemPromptId,
    values: values as Record<string, string>,
    outputLanguage: lang,
  });

describe("tool: stage-assessment with the feedback line (P38.4)", () => {
  it("runs on stage-assessment@v4 and keeps @v1 to @v3 registered", () => {
    expect(tool().stages[0]!.systemPromptId).toBe("stage-assessment@v4");
    for (const v of ["@v1", "@v2", "@v3", "@v4"])
      expect(PROMPTS[`stage-assessment${v}`]).toBeDefined();
  });

  it("has an optional earlier-feedback field that a track fills", () => {
    const f = field();
    expect(f?.kind).toBe("textarea");
    expect(f?.required).not.toBe(true);
    expect(f?.prefillFromTrack).toEqual({ source: "feedbackHistory" });
    expect(loc(f?.label, "nl")).toMatch(/eerdere feedback/i);
    expect(loc(f?.label, "en")).toMatch(/earlier feedback/i);
  });

  it("asks per criterion whether the earlier improvement was taken up, only with a history", () => {
    const nl = build("nl", { ...base, feedbackHistory: "### Concepten, ronde 1\n- Noem bronnen." });
    expect(nl).toContain("Noem bronnen.");
    expect(nl).toMatch(/eerder gevraagde verbetering/i);
    expect(nl).toMatch(/opgepakt/i);
    const en = build("en", { ...base, feedbackHistory: "### Drafts, round 1\n- Cite sources." });
    expect(en).toContain("Cite sources.");
    expect(en).toMatch(/improvement asked for earlier/i);
    expect(en).toMatch(/taken up/i);
  });

  it("says an empty history means no follow-up, and leaves no placeholder", () => {
    expect(build("nl")).toMatch(/leeg.*geen opvolging/i);
    expect(build("en")).toMatch(/empty.*no follow-up/i);
    for (const lang of ["nl", "en"] as const) expect(build(lang)).not.toMatch(/\{\{/);
  });
});
