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
      submissionNotes: "",
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
        submissionNotes: "",
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

  it("forbids hallucination and demands strictly factual, evidence-based output", () => {
    const tool = getToolBySlug("stage-assessment")!;
    const values = {
      document: "x",
      documentType: "stageverslag",
      track: "",
      studyYear: 3,
      durationWeeks: 20,
      assessmentFramework: "x",
      assessmentScale: "x",
      companyEvaluation: "",
      submissionNotes: "",
    };
    const nl = buildSystemPrompt({
      promptId: tool.stages[0].systemPromptId,
      values,
      outputLanguage: "nl",
    });
    const en = buildSystemPrompt({
      promptId: tool.stages[0].systemPromptId,
      values,
      outputLanguage: "en",
    });
    // Explicit no-hallucination + stay-factual instruction in both languages.
    expect(nl.toLowerCase()).toMatch(/hallucineer|verzin/);
    expect(nl.toLowerCase()).toContain("feitelijk");
    expect(nl.toLowerCase()).toMatch(/onzeker/);
    expect(en.toLowerCase()).toMatch(/hallucinate|fabricate/);
    expect(en.toLowerCase()).toContain("factual");
    expect(en.toLowerCase()).toMatch(/uncertain/);
  });

  it("scopes the assessment to the selected document type (no 'wrong document' false flags)", () => {
    const tool = getToolBySlug("stage-assessment")!;
    const base = {
      document: "x",
      documentType: "onderzoeksverslag",
      track: "",
      studyYear: 3,
      durationWeeks: 20,
      assessmentFramework: "x",
      assessmentScale: "x",
      companyEvaluation: "",
      submissionNotes: "",
    };
    const nl = buildSystemPrompt({
      promptId: tool.stages[0].systemPromptId,
      values: base,
      outputLanguage: "nl",
    });
    const en = buildSystemPrompt({
      promptId: tool.stages[0].systemPromptId,
      values: base,
      outputLanguage: "en",
    });
    // The framework may list criteria for several document types; the prompt must
    // tell the model to mark non-matching criteria as out of scope, not "missing"
    // or "wrong document".
    expect(nl.toLowerCase()).toContain("niet van toepassing op dit documenttype");
    expect(nl.toLowerCase()).toMatch(/verkeerde document/);
    expect(en.toLowerCase()).toContain("not applicable to this document type");
    expect(en.toLowerCase()).toMatch(/wrong document/);
    // The selected document type is interpolated into the scoping rule.
    expect(nl).toContain("onderzoeksverslag");
    // Output must be named after the actual document type, not defaulted to
    // "stageverslag" / "internship report".
    expect(nl.toLowerCase()).toContain("werkelijke type document");
    expect(nl.toLowerCase()).toMatch(/nooit standaard vanuit dat het een stageverslag/);
    expect(en.toLowerCase()).toContain("actual document type");
    expect(en.toLowerCase()).toMatch(/never default to calling it an internship report/);
  });

  it("treats a whole portfolio as covering all learning outcomes (Analyseren + Realiseren)", () => {
    const tool = getToolBySlug("stage-assessment")!;
    const values = {
      document: "x",
      documentType: "portfolio",
      track: "",
      studyYear: 3,
      durationWeeks: 20,
      assessmentFramework: "x",
      assessmentScale: "x",
      companyEvaluation: "",
      submissionNotes: "",
    };
    const nl = buildSystemPrompt({
      promptId: tool.stages[0].systemPromptId,
      values,
      outputLanguage: "nl",
    });
    const en = buildSystemPrompt({
      promptId: tool.stages[0].systemPromptId,
      values,
      outputLanguage: "en",
    });
    expect(nl.toLowerCase()).toMatch(/geheel.*portfolio|portfolio.*geheel/);
    expect(nl).toContain("Analyseren");
    expect(nl).toContain("Realiseren");
    expect(en.toLowerCase()).toMatch(/whole.*portfolio|portfolio.*whole/);
  });

  it("offers an optional teacher-notes field that scopes the assessment as trusted guidance", () => {
    const tool = getToolBySlug("stage-assessment")!;
    const notes = tool.inputs.find((f) => f.name === "submissionNotes");
    expect(notes).toBeDefined();
    expect(notes?.kind).toBe("textarea");
    expect(notes?.required).not.toBe(true);

    // The note text is injected and the prompt frames it as trusted (vs the
    // student document) and able to put parts out of scope (e.g. graded later).
    const note =
      "Alleen onderzoeksverslag en stageverslag nu; het beroepsproduct volgt en wordt apart via de eindpresentatie beoordeeld.";
    const nl = buildSystemPrompt({
      promptId: tool.stages[0].systemPromptId,
      values: {
        document: "x",
        documentType: "stageverslag",
        track: "",
        studyYear: 3,
        durationWeeks: 20,
        assessmentFramework: "x",
        assessmentScale: "x",
        companyEvaluation: "",
        submissionNotes: note,
      },
      outputLanguage: "nl",
    });
    const en = buildSystemPrompt({
      promptId: tool.stages[0].systemPromptId,
      values: {
        document: "x",
        documentType: "stageverslag",
        track: "",
        studyYear: 3,
        durationWeeks: 20,
        assessmentFramework: "x",
        assessmentScale: "x",
        companyEvaluation: "",
        submissionNotes: "Only the report is assessed now; the product is graded separately later.",
      },
      outputLanguage: "en",
    });
    expect(nl).toContain(note); // the teacher's note reaches the model
    expect(nl.toLowerCase()).toMatch(/toelichting van de docent/);
    expect(nl.toLowerCase()).toMatch(/buiten scope|apart\/later beoordeeld|buiten de slaagregel/);
    expect(en.toLowerCase()).toMatch(/teacher'?s notes/);
    expect(en.toLowerCase()).toMatch(/out of scope|assessed separately/);
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
