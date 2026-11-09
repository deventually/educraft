import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { PROMPTS } from "~/lib/prompts";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { defaultValuesFor } from "~/lib/forms/values";
import { loc } from "~/lib/i18n/localized";

/**
 * P24.1 — Stage Assessment broadened to any written student work against a
 * rubric or framework. Same slug, new prompt version (@v2); @v1 stays
 * registered. Feedback follows Hattie & Timperley (2007).
 */
const tool = () => getToolBySlug("stage-assessment")!;
const field = (name: string) => tool().inputs.find((f) => f.name === name);

const base = {
  document: "x",
  documentType: "essay",
  track: "",
  studyYear: 2,
  durationWeeks: "",
  assessmentFramework: "x",
  assessmentScale: "x",
  companyEvaluation: "",
  submissionNotes: "",
};
const build = (lang: "nl" | "en", values: Record<string, unknown> = base) =>
  buildSystemPrompt({
    promptId: tool().stages[0]!.systemPromptId,
    values: values as Record<string, string>,
    outputLanguage: lang,
  });

describe("tool: stage-assessment @v2 (any student work)", () => {
  it("keeps the slug and uses the task-first name chosen by Bastiaan", () => {
    expect(tool().slug).toBe("stage-assessment");
    expect(loc(tool().name, "nl")).toBe("Studentwerk beoordelen en feedback geven");
    expect(loc(tool().name, "en")).toBe("Assess student work and give feedback");
    // Search on "stage" keeps finding it.
    expect(loc(tool().subtitle, "nl").toLowerCase()).toContain("stage");
    expect(loc(tool().subtitle, "en").toLowerCase()).toContain("internship");
  });

  it("runs on stage-assessment@v2 and keeps @v1 registered", () => {
    expect(tool().stages[0]!.systemPromptId).toBe("stage-assessment@v2");
    expect(PROMPTS["stage-assessment@v1"]).toBeDefined();
    expect(PROMPTS["stage-assessment@v2"]).toBeDefined();
  });

  it("offers general document types and keeps the old values", () => {
    const values = field("documentType")?.options?.map((o) => o.value) ?? [];
    for (const v of ["essay", "adviesrapport", "beroepsproduct", "verslag", "overig"]) {
      expect(values).toContain(v);
    }
    // Old values stay so earlier generations reload unchanged.
    for (const v of [
      "stageverslag",
      "onderzoeksverslag",
      "stageplan",
      "portfolio",
      "afstudeerscriptie",
    ]) {
      expect(values).toContain(v);
    }
  });

  it("makes the internship fields optional and groups them under 'Stage en afstuderen'", () => {
    for (const name of ["durationWeeks", "companyEvaluation"]) {
      const f = field(name)!;
      expect(f.required, name).not.toBe(true);
      expect(f.group, name).toEqual({ nl: "Stage en afstuderen", en: "Internship and graduation" });
    }
    // The optional group comes last, after the framework.
    const names = tool().inputs.map((f) => f.name);
    expect(names.slice(-2)).toEqual(["durationWeeks", "companyEvaluation"]);
    // An optional duration starts empty: an essay is never sent as "1 week".
    expect(defaultValuesFor(tool().inputs).durationWeeks).toBe("");
  });

  it("builds without the internship fields filled in", () => {
    for (const lang of ["nl", "en"] as const) {
      const p = build(lang);
      expect(p).not.toMatch(/\{\{\w+\}\}/);
      expect(p).toContain("essay");
    }
  });

  it("writes feedback along feed up, feed back and feed forward (Hattie & Timperley, 2007)", () => {
    for (const lang of ["nl", "en"] as const) {
      const p = build(lang).toLowerCase();
      expect(p, lang).toContain("feed up");
      expect(p, lang).toContain("feed back");
      expect(p, lang).toContain("feed forward");
      expect(p, lang).toContain("hattie & timperley (2007)");
    }
    expect(tool().theory?.keyCitations).toContain("Hattie & Timperley (2007)");
  });

  it("tells the model how to treat anonymisation codes", () => {
    const nl = build("nl");
    const en = build("en");
    expect(nl).toContain("[STUDENT]");
    expect(nl.toLowerCase()).toMatch(/letterlijk.*vierkante haken|vierkante haken.*letterlijk/);
    expect(nl.toLowerCase()).toMatch(/verzin.*naam|naam.*verzin/);
    expect(en).toContain("[STUDENT]");
    expect(en.toLowerCase()).toMatch(/square brackets/);
    expect(en.toLowerCase()).toMatch(/invent.*name|name.*invent/);
  });

  it("no longer assumes an internship: the closing line names the teacher as examiner", () => {
    expect(build("nl")).toContain(
      "Dit is een concept ter ondersteuning. De docent is examinator en stelt de beoordeling vast.",
    );
    expect(build("en")).toContain(
      "This is a draft for support. The teacher is the examiner and determines the assessment.",
    );
    expect(build("nl").toLowerCase()).not.toContain("stagedocent");
  });

  it("keeps the numbering continuous when the company evaluation is left out", () => {
    // Eval 2026-11-04c: dropping heading 4 left a jump from 3 to 5.
    expect(build("nl")).toMatch(/nummer het volgende kopje dan door als 4/);
    expect(build("en")).toMatch(/number the next heading 4/);
  });
});
