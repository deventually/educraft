import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { getToolHelpOverlay } from "~/lib/help/registry";
import { getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { TOOL_GOALS } from "~/lib/registry/goals";
import { TOOL_KEYWORDS } from "~/lib/registry/keywords";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

/**
 * P39.3 — Feedback op reflectie of POP. A study coach lays an anonymised reflection report or
 * personal development plan next to an assessment model and gets feedforward: what is already
 * strong and the next step, never a grade or level. Nothing is kept.
 */
const tool = () => getToolBySlug("reflection-feedback")!;
const values = {
  documentType: "reflection",
  document: "In week 3 liep mijn presentatie mis. [STUDENT-1] gaf aan dat ik te snel praatte.",
  assessmentFramework: "C1 Terugblikken\nC2 Alternatieven",
};
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({ promptId: "feedforward@v2", values, outputLanguage: lang });

describe("tool: reflection-feedback (P39.3)", () => {
  it("is a one-shot tool for teachers that keeps nothing and never reaches a colleague", () => {
    const t = tool();
    expect(t.mode).toBe("one-shot");
    expect(t.userType).toBe("instructor");
    expect(t.stages.map((s) => s.systemPromptId)).toEqual(["feedforward@v2"]);
    expect(t.storesConversation).toBe(false);
    expect(t.handlesStudentWork).toBe(true);
    expect(t.usesContextProfile).toBe(true);
  });

  it("names the task first, in both languages", () => {
    expect(loc(tool().name, "nl")).toBe("Feedback op reflectie of POP");
    expect(loc(tool().name, "en")).toBe("Feedback on a reflection or PDP");
  });

  it("takes a reflection or POP, anonymised in the browser, and a model for it", () => {
    const t = tool();
    expect(t.assessmentModels).toEqual({ byField: "documentType" });
    const type = t.inputs.find((f) => f.name === "documentType");
    expect(type?.options?.map((o) => o.value)).toEqual(["reflection", "development-plan"]);
    const doc = t.inputs.find((f) => f.name === "document");
    expect(doc?.kind).toBe("document");
    expect(doc?.redact).toBe(true);
    expect(doc?.required).toBe(true);
    expect(loc(doc?.help, "nl").toLowerCase()).toContain("geen namen");
    expect(loc(doc?.help, "en").toLowerCase()).toContain("no names");
    const framework = t.inputs.find((f) => f.name === "assessmentFramework");
    expect(framework?.required).toBe(true);
    expect(framework?.prefillFromAssessmentModel).toEqual({ source: "framework" });
  });

  it("has no grading scale: feedforward never judges", () => {
    const t = tool();
    expect(t.inputs.some((f) => f.prefillFromAssessmentModel?.source === "scale")).toBe(false);
    expect(t.stages[0]!.output.guard).toBe("no-judgement");
  });

  it("is an original LimeOnIt tool, findable under assessing", () => {
    expect(tool().attribution.original).toBe(true);
    expect(getPrompt("feedforward@v2").verbatim).toMatch(/LimeOnIt/);
    expect(TOOL_GOALS["reflection-feedback"]).toBe("assess");
    expect(TOOL_KEYWORDS["reflection-feedback"]).toEqual(
      expect.arrayContaining(["reflectie", "pop", "slb", "feedforward", "reflection"]),
    );
  });

  it("has a help page in both languages that says nothing is kept", () => {
    expect(getToolHelpOverlay("reflection-feedback", "nl")).toMatch(/niet bewaard/i);
    expect(getToolHelpOverlay("reflection-feedback", "en")).toMatch(/not kept/i);
  });

  it("keeps feedforward@v1 registered for the track and its eval", () => {
    expect(getPrompt("feedforward@v1").id).toBe("feedforward@v1");
  });

  for (const lang of ["nl", "en"] as const) {
    it(`resolves every placeholder (${lang})`, () => {
      const p = runtime(lang);
      expect(p).not.toMatch(/\{\{\w+\}\}/);
      expect(p).toContain(values.document);
      expect(p).toContain(values.assessmentFramework);
    });
  }

  it("guards the brief's demands (nl)", () => {
    const p = runtime("nl").toLowerCase();
    expect(p).toContain("voice & bounds");
    expect(p).toContain("geen niveau, geen cijfer");
    expect(p).toContain("letterlijk");
    expect(p).toContain("raad nooit wie erachter zit");
    expect(p).toContain("over het werk, niet over de persoon");
    // An SLB reflection is personal: no advice about health, home or money.
    expect(p).toContain("geen advies over gezondheid, thuis of geld");
    expect(p).toContain("limeonit bewaart deze feedback niet.");
  });

  it("guards the brief's demands (en)", () => {
    const p = runtime("en").toLowerCase();
    expect(p).toContain("voice & bounds");
    expect(p).toContain("no level, no grade");
    expect(p).toContain("literally");
    expect(p).toContain("never guess who is behind it");
    expect(p).toContain("about the work, not the person");
    expect(p).toContain("no advice about health, home or money");
    expect(p).toContain("limeonit does not keep this feedback.");
  });
});
