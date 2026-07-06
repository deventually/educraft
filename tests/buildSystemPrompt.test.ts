import { describe, it, expect } from "vitest";
import { buildSystemPrompt, reinforceLanguage } from "~/lib/template/buildSystemPrompt";
import type { ChatMessage } from "~/lib/registry/types";
import { guidedReflection } from "~/lib/registry/tools/guided-reflection";
import { cognitiveArchitect } from "~/lib/registry/tools/cognitive-architect";
import { dialogicEncounters } from "~/lib/registry/tools/dialogic-encounters";
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

  it("appends an explicit output-language directive that switches with the language", () => {
    // The chat prompt itself carries no {{outputLanguage}} placeholder, so a
    // central directive is what guarantees the model answers in the selected
    // language — even after a conversation that began in another language.
    const args = {
      promptId: dialogicEncounters.stages[0].systemPromptId,
      values: { theorist: "Jean Piaget" },
    };
    const nl = buildSystemPrompt({ ...args, outputLanguage: "nl" });
    const en = buildSystemPrompt({ ...args, outputLanguage: "en" });

    expect(nl).toContain("altijd volledig in het Nederlands");
    expect(en).toContain("always respond entirely in English");
    expect(en).not.toContain("altijd volledig in het Nederlands");
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
      country: "NL",
      sector: "hbo",
      domain: "ICT",
      tools: "Java",
      packValues: {
        beheersingsniveau: 2,
        architectuurlagen: ["Software"],
        activiteiten: ["Realiseren"],
      },
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

  it("emits the direct-address level directive for a learner audience", () => {
    const profile: ContextProfile = { id: "p2", name: "SE jaar 1", eqf: 4 };
    const learner = buildSystemPrompt({
      promptId: guidedReflection.stages[0].systemPromptId,
      values: baseValues,
      profile,
      outputLanguage: "en",
      audience: "learner",
    });
    expect(learner).toContain("Pitch your vocabulary");
    expect(learner).not.toContain("Match complexity");

    // The instructor default keeps the substance-first directive.
    const instructor = buildSystemPrompt({
      promptId: guidedReflection.stages[0].systemPromptId,
      values: baseValues,
      profile,
      outputLanguage: "en",
    });
    expect(instructor).toContain("Match complexity");
    expect(instructor).not.toContain("Pitch your vocabulary");
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

describe("reinforceLanguage", () => {
  const history: ChatMessage[] = [
    { role: "user", content: "Leg uit wat OOP is." },
    { role: "assistant", content: "Objectgeoriënteerd programmeren is…" },
    { role: "user", content: "Tell me more." },
  ];

  it("echoes the directive on the last user turn so a mid-chat switch wins", () => {
    const out = reinforceLanguage(history, "en");
    // Earlier turns are untouched…
    expect(out[0]).toEqual(history[0]);
    expect(out[1]).toEqual(history[1]);
    // …only the final user turn carries the recency reminder.
    expect(out[2].content).toContain("Tell me more.");
    expect(out[2].content).toContain("always respond entirely in English");
  });

  it("uses the target language for the reminder", () => {
    const out = reinforceLanguage(history, "nl");
    expect(out.at(-1)?.content).toContain("altijd volledig in het Nederlands");
  });

  it("does not mutate the original history (kept clean for the transcript)", () => {
    const before = history[2].content;
    reinforceLanguage(history, "en");
    expect(history[2].content).toBe(before);
  });

  it("leaves messages untouched when the last turn is not a user message", () => {
    const ending: ChatMessage[] = [{ role: "assistant", content: "Hallo!" }];
    expect(reinforceLanguage(ending, "en")).toBe(ending);
  });

  it("returns an empty history unchanged", () => {
    const empty: ChatMessage[] = [];
    expect(reinforceLanguage(empty, "nl")).toBe(empty);
  });
});
