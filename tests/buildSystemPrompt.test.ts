import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { guidedReflection } from "~/lib/registry/tools/guided-reflection";
import { cognitiveArchitect } from "~/lib/registry/tools/cognitive-architect";
import type { ContextProfile } from "~/lib/context/types";

const baseValues = {
  onderwerp: "RESTful API-ontwerp",
  niveau: "hoofdfase",
  scope: "één les",
  duur: 90,
  modaliteit: "contactonderwijs",
  voorkennis: "HTTP-basis",
  bigIdea: "Resources en representaties",
  essentieleVraag: "Wanneer is een API RESTful?",
  leeruitkomsten: "Ontwerp een resource-model",
  bewijs: "Code review",
  relevantie: "Backend-werkveld",
  artefacten: ["een college-outline", "een werkvorm/activiteit"],
};

describe("buildSystemPrompt", () => {
  it("injects the output language label", () => {
    const sys = buildSystemPrompt({
      promptId: guidedReflection.stages[0].systemPromptId,
      values: baseValues,
      outputLanguage: "nl",
    });
    expect(sys).toContain("in het Nederlands");
    expect(sys).toContain("RESTful API-ontwerp");
  });

  it("collapses an empty context profile cleanly", () => {
    const sys = buildSystemPrompt({
      promptId: guidedReflection.stages[0].systemPromptId,
      values: baseValues,
      profile: null,
      outputLanguage: "nl",
    });
    expect(sys).not.toContain("{{contextProfile}}");
  });

  it("injects an HBO-i context profile", () => {
    const profile: ContextProfile = {
      id: "p1",
      name: "SE jaar 2",
      domain: "ICT",
      hboiLevel: 2,
      architectureLayers: ["Software"],
      activities: ["Realiseren"],
      tools: "Java",
    };
    const sys = buildSystemPrompt({
      promptId: guidedReflection.stages[0].systemPromptId,
      values: baseValues,
      profile,
      outputLanguage: "nl",
    });
    expect(sys).toContain("hbo-i");
    expect(sys).toContain("Java");
  });

  it("injects a consumed prior-stage output for multi-stage tools", () => {
    const generatorStage = cognitiveArchitect.stages.find((s) => s.id === "generator")!;
    const sys = buildSystemPrompt({
      promptId: generatorStage.systemPromptId,
      values: {},
      outputLanguage: "nl",
      consumes: generatorStage.consumes,
      priorOutputs: { analyst: "## Coordinates Document\nVoorbeeldinhoud" },
    });
    expect(sys).toContain("Voorbeeldinhoud");
  });

  it("throws when a required prior-stage output is missing", () => {
    const validatorStage = cognitiveArchitect.stages.find((s) => s.id === "validator")!;
    expect(() =>
      buildSystemPrompt({
        promptId: validatorStage.systemPromptId,
        values: {},
        outputLanguage: "nl",
        consumes: validatorStage.consumes,
        priorOutputs: { analyst: "doc" }, // missing "generator"
      }),
    ).toThrow();
  });
});
