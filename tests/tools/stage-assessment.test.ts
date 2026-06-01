import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

/**
 * Stage- & afstudeerbeoordeling: a docent-facing one-shot tool that drafts
 * feedback + a provisional verdict for internship/thesis documents against a
 * (replaceable) assessment framework. Engine-neutral: HBO-i nakijkmodel ships
 * as the default framework, but any study can paste its own.
 */
describe("tool: stage-assessment", () => {
  it("registers and resolves by slug", () => {
    const tool = getToolBySlug("stage-assessment");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("stage-assessment");
  });

  it("is a one-shot, single-stage instructor tool", () => {
    const tool = getToolBySlug("stage-assessment")!;
    expect(tool.mode).toBe("one-shot");
    expect(tool.stages.length).toBe(1);
    expect(tool.userType).toBe("instructor");
  });

  it("takes the student document and document-type/year/duration context", () => {
    const tool = getToolBySlug("stage-assessment")!;
    const doc = tool.inputs.find((f) => f.name === "document");
    const type = tool.inputs.find((f) => f.name === "documentType");
    const year = tool.inputs.find((f) => f.name === "studyYear");
    const weeks = tool.inputs.find((f) => f.name === "durationWeeks");
    // `document` is the upload-or-paste control: its value is still a plain
    // string consumed as {{document}}, so buildSystemPrompt is unaffected.
    expect(doc?.kind).toBe("document");
    expect(doc?.required).toBe(true);
    expect(type?.kind).toBe("select");
    expect(year?.kind).toBe("number");
    expect(weeks?.kind).toBe("number");
  });

  it("is generic: the assessment framework + scale are editable inputs with HBO-i defaults", () => {
    const tool = getToolBySlug("stage-assessment")!;
    const framework = tool.inputs.find((f) => f.name === "assessmentFramework");
    const scale = tool.inputs.find((f) => f.name === "assessmentScale");
    expect(framework?.kind).toBe("textarea");
    expect(scale?.kind).toBe("textarea");
    // HBO-i nakijkmodel ships as a replaceable default.
    expect(String(framework?.defaultValue ?? "")).toMatch(/succescriteri|Analyseren|SC1/i);
    expect(String(scale?.defaultValue ?? "")).toMatch(/onvoldoende/i);
  });

  it("accepts an optional company-mentor evaluation and optional figures", () => {
    const tool = getToolBySlug("stage-assessment")!;
    const eval_ = tool.inputs.find((f) => f.name === "companyEvaluation");
    const figures = tool.inputs.find((f) => f.kind === "image");
    expect(eval_).toBeDefined();
    expect(eval_?.required).not.toBe(true);
    expect(figures).toBeDefined();
    expect(figures?.required).not.toBe(true);
    expect(figures?.accept).toContain("image/");
  });

  it("builds a prompt with no unresolved placeholders", () => {
    const tool = getToolBySlug("stage-assessment")!;
    const inputs = {
      document: "Hoofdstuk 1 Inleiding ... Dit stageverslag beschrijft ...",
      documentType: "stageverslag",
      track: "Software",
      studyYear: 3,
      durationWeeks: 20,
      assessmentFramework: "SC1 onderzoek; SC2 onderbouwing; SC3 belanghebbenden",
      assessmentScale: "O=0, V=6, G=10; één O = onvoldoende",
      companyEvaluation: "",
    };
    const prompt = buildSystemPrompt({
      promptId: tool.stages[0].systemPromptId,
      values: inputs,
      outputLanguage: "nl",
    });
    expect(prompt).not.toMatch(/\{\{(\w+)\}\}/);
    expect(prompt.length).toBeGreaterThan(200);
  });

  it("encodes the core guardrails: advisory, no fabrication, examinator decides", () => {
    const tool = getToolBySlug("stage-assessment")!;
    const nl = tool.stages[0].systemPromptId;
    const prompt = buildSystemPrompt({
      promptId: nl,
      values: {
        document: "x",
        documentType: "stageverslag",
        track: "",
        studyYear: 3,
        durationWeeks: 20,
        assessmentFramework: "x",
        assessmentScale: "x",
        companyEvaluation: "",
      },
      outputLanguage: "nl",
    });
    // Document is data, not instructions.
    expect(prompt.toLowerCase()).toMatch(/instructie|nooit als instructie/);
    // No fabricated evidence.
    expect(prompt.toLowerCase()).toMatch(/niet aangetroffen/);
    // Examinator decides; this is a concept.
    expect(prompt.toLowerCase()).toMatch(/examinator/);
  });

  it("uses a vision-capable default model and a low temperature for consistency", () => {
    const tool = getToolBySlug("stage-assessment")!;
    expect(["claude-sonnet-4-6", "claude-opus-4-8"]).toContain(tool.defaultModel);
    expect(tool.defaultTemperature ?? 1).toBeLessThanOrEqual(0.5);
  });

  it("enforces required fields", () => {
    const tool = getToolBySlug("stage-assessment")!;
    expect(tool.inputs.filter((f) => f.required).length).toBeGreaterThan(0);
  });

  it("has NL/EN parity in labels, placeholders, help and groups", () => {
    const tool = getToolBySlug("stage-assessment")!;
    for (const input of tool.inputs) {
      if (typeof input.label !== "string") {
        expect(input.label.nl, input.name).toBeDefined();
        expect(input.label.en, input.name).toBeDefined();
      }
      for (const key of ["placeholder", "help", "group"] as const) {
        const v = input[key];
        if (v && typeof v !== "string") {
          expect(v.nl, `${input.name}.${key}`).toBeDefined();
          expect(v.en, `${input.name}.${key}`).toBeDefined();
        }
      }
    }
  });

  it("is an original LimeOnIt instrument, not a book chapter", () => {
    const tool = getToolBySlug("stage-assessment")!;
    expect(tool.attribution.original).toBe(true);
    expect(tool.attribution.source).toBeDefined();
    expect(tool.attribution.bookTitle).toBeUndefined();
  });

  it("has structured output and is enabled for phase 1", () => {
    const tool = getToolBySlug("stage-assessment")!;
    expect(["markdown", "json", "structured-sections"]).toContain(tool.stages[0].output.kind);
    expect(tool.enabled).toBe(true);
    expect(tool.phase).toBe(1);
  });
});
