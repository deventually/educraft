import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { TOOL_GOALS, TOOL_KEYWORDS } from "~/lib/registry/goals";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

/**
 * P24.3 — Toetsvragen en toetsmatrijs. A two-stage instructor tool: (1) a test blueprint
 * (learning outcome × cognitive level, number of questions and points), (2) questions that
 * follow that blueprint, with an answer model and, for multiple choice, the reason each
 * distractor is wrong. Sources: Anderson & Krathwohl (2001); Haladyna, Downing & Rodriguez
 * (2002).
 */
const tool = () => getToolBySlug("test-items")!;
const values = {
  learningOutcomes:
    "De student berekent en interpreteert een betrouwbaarheidsinterval voor een gemiddelde.\nDe student kiest bij een onderzoeksvraag de passende toets.",
  material:
    "Hoofdstuk 7 en 8 van het statistiekboek: betrouwbaarheidsintervallen, t-toets, chikwadraattoets.",
  questionCount: "12",
  questionTypes: "mixed",
  conditions: "",
};
const blueprintOutput = "## Toetsmatrijs\n\n| Rij | … |";
const runtime = (stage: "blueprint" | "items", lang: "nl" | "en") =>
  buildSystemPrompt({
    promptId: `test-items-${stage}@v1`,
    values,
    outputLanguage: lang,
    priorOutputs: { blueprint: blueprintOutput },
    consumes: tool().stages.find((s) => s.id === stage)?.consumes,
  });

describe("tool: test-items", () => {
  it("registers as a two-stage instructor tool: blueprint, then questions from it", () => {
    const t = tool();
    expect(t).toBeDefined();
    expect(t.mode).toBe("one-shot");
    expect(t.userType).toBe("instructor");
    expect(t.usesContextProfile).toBe(true);
    expect(t.enabled).toBe(true);
    expect(t.stages.map((s) => s.id)).toEqual(["blueprint", "items"]);
    expect(t.stages[0]?.systemPromptId).toBe("test-items-blueprint@v1");
    expect(t.stages[1]?.systemPromptId).toBe("test-items-items@v1");
    expect(t.stages[1]?.consumes).toEqual([{ placeholder: "blueprint", fromStageId: "blueprint" }]);
  });

  it("names the task first, in both languages", () => {
    expect(loc(tool().name, "nl")).toBe("Toetsvragen en toetsmatrijs maken");
    expect(loc(tool().name, "en")).toBe("Write test questions and a blueprint");
  });

  it("needs outcomes, material and a number of questions; conditions are optional", () => {
    const field = (n: string) => tool().inputs.find((f) => f.name === n);
    expect(field("learningOutcomes")?.required).toBe(true);
    expect(field("material")?.required).toBe(true);
    expect(field("questionCount")?.required).toBe(true);
    expect(field("conditions")?.required).not.toBe(true);
    const types = field("questionTypes");
    expect(types?.kind).toBe("select");
    expect(types?.options?.map((o) => o.value)).toEqual(["multiple-choice", "mixed", "open"]);
    expect(types?.defaultValue).toBe("mixed");
  });

  it("is an original LimeOnIt tool that names its verified sources", () => {
    const t = tool();
    expect(t.attribution.original).toBe(true);
    expect(t.theory.keyCitations).toEqual(
      expect.arrayContaining([
        "Anderson & Krathwohl (2001)",
        "Haladyna, Downing & Rodriguez (2002)",
      ]),
    );
  });

  it("is findable under assessing, by 'toetsmatrijs', 'toetsvragen' and 'meerkeuze'", () => {
    expect(TOOL_GOALS["test-items"]).toBe("assess");
    expect(TOOL_KEYWORDS["test-items"]).toEqual(
      expect.arrayContaining([
        "toetsmatrijs",
        "toetsvragen",
        "meerkeuze",
        "afleiders",
        "blueprint",
      ]),
    );
  });

  it("has room for a whole set of questions with their answer model", () => {
    const items = tool().stages[1]!;
    expect(items.maxTokens ?? tool().defaultMaxTokens).toBeGreaterThanOrEqual(16000);
  });

  // Meting p: three of 18 runs were cut off in the questions stage (calculation-heavy
  // statistics), with the text itself far below the budget: the thinking ate it.
  it("leaves the questions stage room to think through calculations", () => {
    expect(tool().stages[1]!.maxTokens).toBeGreaterThanOrEqual(24576);
  });

  it("asks for one clean final version and only one defensible answer (nl)", () => {
    const p = runtime("items", "nl").toLowerCase();
    expect(p).toContain("eenvoudige getallen");
    expect(p).toContain("alleen de eindversie");
    expect(p).toContain("geen tweede versie");
    expect(p).toContain("andere gangbare opvatting");
    // Meting r2: a distractor that states a strict methodological position stayed defensible.
    expect(p).toContain("waarover vakmensen het oneens zijn");
    expect(p).toContain("geen pijltjes");
    // Meting t: row traces in headings, three options, one option that stands out by form.
    expect(p).toContain("in de volgorde van de matrijs");
    expect(p).toContain("valt op door zijn vorm");
    expect(p).toContain("waarom er geen vierde");
  });

  it("asks for one clean final version and only one defensible answer (en)", () => {
    const p = runtime("items", "en").toLowerCase();
    expect(p).toContain("simple numbers");
    expect(p).toContain("only the final version");
    expect(p).toContain("no second version");
    expect(p).toContain("other common view");
    expect(p).toContain("on which experts disagree");
    expect(p).toContain("no arrows");
    expect(p).toContain("in the order of the blueprint");
    expect(p).toContain("stands out by its form");
    expect(p).toContain("why there is no fourth");
  });

  for (const stage of ["blueprint", "items"] as const) {
    for (const lang of ["nl", "en"] as const) {
      it(`resolves every placeholder (${stage}, ${lang})`, () => {
        const p = runtime(stage, lang);
        expect(p).not.toMatch(/\{\{\w+\}\}/);
        expect(p).toContain(values.material);
        expect(p.toLowerCase()).toContain("voice & bounds");
      });
    }
  }

  it("the questions stage builds on the blueprint", () => {
    expect(runtime("items", "nl")).toContain(blueprintOutput);
    expect(runtime("items", "en")).toContain(blueprintOutput);
  });

  it("guards the blueprint rules (nl)", () => {
    const p = runtime("blueprint", "nl").toLowerCase();
    expect(p).toContain("anderson & krathwohl");
    expect(p).toContain("verzin niets");
    expect(p).toContain("voorstel");
    expect(p).toContain("telt op"); // the blueprint adds up
    expect(p).toContain("niet opgenomen"); // an outcome without an observable verb
    expect(p).toContain("niet te meten met meerkeuze");
    expect(p).toContain(
      "| rij | leeruitkomst | denkniveau | vraagvorm | aantal vragen | punten per vraag | punten |",
    );
    expect(p).toContain("dit is een concept. de docent stelt de toets vast.");
  });

  it("guards the blueprint rules (en)", () => {
    const p = runtime("blueprint", "en").toLowerCase();
    expect(p).toContain("anderson & krathwohl");
    expect(p).toContain("invent nothing");
    expect(p).toContain("proposal");
    expect(p).toContain("adds up");
    expect(p).toContain("not included");
    expect(p).toContain("cannot be measured with multiple choice");
    expect(p).toContain(
      "| row | learning outcome | cognitive level | question type | number of questions | points per question | points |",
    );
    expect(p).toContain("this is a draft. the teacher decides on the test.");
  });

  it("guards the item-writing rules from Haladyna et al. (nl)", () => {
    const p = runtime("items", "nl").toLowerCase();
    expect(p).toContain("haladyna");
    expect(p).toContain("precies één goed antwoord");
    expect(p).toContain("geen aanwijzing"); // no clue to the key in the stem or options
    expect(p).toContain("aannemelijk"); // plausible distractors
    expect(p).toContain("waarom fout");
    expect(p).toContain("geen van bovenstaande");
    expect(p).toContain("niet"); // negatives in the stem
    expect(p).toContain("de matrijs is van de docent"); // follow the blueprint exactly
    expect(p).toContain("antwoordmodel");
    expect(p).toContain("verzin niets");
    expect(p).toContain("dit is een concept. de docent stelt de toets vast.");
  });

  it("guards the item-writing rules from Haladyna et al. (en)", () => {
    const p = runtime("items", "en").toLowerCase();
    expect(p).toContain("haladyna");
    expect(p).toContain("exactly one correct answer");
    expect(p).toContain("no clue");
    expect(p).toContain("plausible");
    expect(p).toContain("why it is wrong");
    expect(p).toContain("none of the above");
    expect(p).toContain("the blueprint belongs to the teacher");
    expect(p).toContain("answer model");
    expect(p).toContain("invent nothing");
    expect(p).toContain("this is a draft. the teacher decides on the test.");
  });

  it("keeps an honest verbatim: the tool is not from the book", () => {
    expect(getPrompt("test-items-blueprint@v1").verbatim).toMatch(/LimeOnIt/);
    expect(getPrompt("test-items-items@v1").verbatim).toMatch(/LimeOnIt/);
  });
});
