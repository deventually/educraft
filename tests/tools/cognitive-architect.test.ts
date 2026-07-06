import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { getRuntimePrompt } from "~/lib/prompts";

// Covers every input field name so `buildSystemPrompt` can resolve the analyst
// stage (the only stage that reads the tool inputs).
const SAMPLE_INPUTS = {
  gradeSubject: "hbo jaar 2, Databases",
  learningObjective: "Studenten kunnen een genormaliseerd datamodel ontwerpen.",
  legacyActivity: "Lees hoofdstuk 4 en beantwoord de vragen.",
  instructionalPhase: "Guided Practice",
  sourceMaterials: "Casus: een webshop-database met vier tabellen.",
  preferredApproach: "Socratische dialoog",
};

// Stand-in outputs of the two producing stages, keyed by stage id.
const PRIOR_OUTPUTS = {
  analyst: "## Instructional Coordinates Document\nCER-diagnose … coordinates …",
  generator: "## Student System Prompt\nYou are the Curious Novice … student prompt …",
};

describe("tool: cognitive-architect", () => {
  it("resolves by slug as a context-aware, one-shot tool", () => {
    const tool = getToolBySlug("cognitive-architect");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("cognitive-architect");
    expect(tool?.mode).toBe("one-shot");
    expect(tool?.usesContextProfile).toBe(true);
  });

  it("has the four Cognitive Architect stages in order", () => {
    const tool = getToolBySlug("cognitive-architect")!;
    expect(tool.stages.map((s) => s.id)).toEqual([
      "analyst",
      "generator",
      "validator",
      "transcript-analyst",
    ]);
    // The entry stage consumes nothing; the other three do.
    expect(tool.stages[0].consumes ?? []).toEqual([]);
  });

  it("only consumes outputs from EARLIER stages, and each placeholder is present in the consuming prompt", () => {
    const tool = getToolBySlug("cognitive-architect")!;
    const indexOf = new Map(tool.stages.map((s, i) => [s.id, i]));

    for (const stage of tool.stages) {
      const stageIdx = indexOf.get(stage.id)!;
      for (const dep of stage.consumes ?? []) {
        // The source stage exists…
        expect(indexOf.has(dep.fromStageId)).toBe(true);
        // …and strictly precedes the consumer (no self- or forward-references).
        expect(indexOf.get(dep.fromStageId)!).toBeLessThan(stageIdx);
        // …and the placeholder it fills actually appears in this stage's prompt,
        // in both language variants (otherwise the wiring is dead).
        for (const lang of ["nl", "en"] as const) {
          expect(getRuntimePrompt(stage.systemPromptId, lang)).toContain(`{{${dep.placeholder}}}`);
        }
      }
    }
  });

  it("wires the exact consumes chain: generator←analyst, validator/transcript←analyst+generator", () => {
    const tool = getToolBySlug("cognitive-architect")!;
    const byId = Object.fromEntries(tool.stages.map((s) => [s.id, s]));

    expect(byId.generator.consumes).toEqual([
      { placeholder: "coordinatesDocument", fromStageId: "analyst" },
    ]);
    for (const id of ["validator", "transcript-analyst"]) {
      expect(byId[id].consumes).toEqual([
        { placeholder: "coordinatesDocument", fromStageId: "analyst" },
        { placeholder: "studentPrompt", fromStageId: "generator" },
      ]);
      // The two optional stages are marked optional.
      expect(byId[id].optional).toBe(true);
    }
  });

  it("guards the resolution test: sample values cover every input name", () => {
    const tool = getToolBySlug("cognitive-architect")!;
    for (const input of tool.inputs) {
      expect(SAMPLE_INPUTS).toHaveProperty(input.name);
    }
  });

  it("resolves every stage's prompt with no unresolved placeholders (nl + en)", () => {
    const tool = getToolBySlug("cognitive-architect")!;
    for (const lang of ["nl", "en"] as const) {
      for (const stage of tool.stages) {
        const prompt = buildSystemPrompt({
          promptId: stage.systemPromptId,
          values: SAMPLE_INPUTS,
          outputLanguage: lang,
          consumes: stage.consumes,
          priorOutputs: PRIOR_OUTPUTS,
        });
        expect(prompt).not.toMatch(/\{\{\w+\}\}/);
        expect(prompt.length).toBeGreaterThan(100);
      }
    }
  });

  it("has NL/EN parity across inputs and stage names/descriptions", () => {
    const tool = getToolBySlug("cognitive-architect")!;

    for (const input of tool.inputs) {
      if (typeof input.label !== "string") {
        expect(input.label.nl).toBeDefined();
        expect(input.label.en).toBeDefined();
      }
      if (input.placeholder && typeof input.placeholder !== "string") {
        expect(input.placeholder.nl).toBeDefined();
        expect(input.placeholder.en).toBeDefined();
      }
      if (input.help && typeof input.help !== "string") {
        expect(input.help.nl).toBeDefined();
        expect(input.help.en).toBeDefined();
      }
      if (input.group && typeof input.group !== "string") {
        expect(input.group.nl).toBeDefined();
        expect(input.group.en).toBeDefined();
      }
    }

    for (const stage of tool.stages) {
      expect(typeof stage.name !== "string" && stage.name.nl).toBeTruthy();
      expect(typeof stage.name !== "string" && stage.name.en).toBeTruthy();
      if (stage.description) {
        expect(typeof stage.description !== "string" && stage.description.nl).toBeTruthy();
        expect(typeof stage.description !== "string" && stage.description.en).toBeTruthy();
      }
    }
  });

  it("carries CC BY 4.0 attribution and is flagged as adapted", () => {
    const tool = getToolBySlug("cognitive-architect")!;
    expect(tool.attribution).toBeDefined();
    expect(tool.attribution.license).toBe("CC BY 4.0");
    expect(tool.attribution.adapted).toBe(true);
  });
});
