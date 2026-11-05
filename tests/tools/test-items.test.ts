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
const blueprintOutput = [
  "## Toetsmatrijs",
  "",
  "| Rij | Leeruitkomst | Denkniveau | Vraagvorm | Aantal vragen | Punten per vraag | Punten |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  "| R1 | Betrouwbaarheidsinterval | Toepassen | Meerkeuze | 8 | 1 | 8 |",
  "| R2 | Passende toets kiezen | Analyseren | Open | 4 | 3 | 12 |",
  "| Totaal | | | | 12 | | 20 |",
].join("\n");
const runtime = (stage: "blueprint" | "items", lang: "nl" | "en") =>
  buildSystemPrompt({
    promptId: tool().stages.find((s) => s.id === stage)!.systemPromptId,
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
    expect(t.stages[1]?.systemPromptId).toBe("test-items-items@v3");
    expect(t.stages[1]?.consumes).toEqual([
      { placeholder: "blueprint", fromStageId: "blueprint" },
      { placeholder: "questionPlan", fromStageId: "blueprint", derive: "question-plan" },
    ]);
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
  });

  it("asks for one clean final version and only one defensible answer (en)", () => {
    const p = runtime("items", "en").toLowerCase();
    expect(p).toContain("simple numbers");
    expect(p).toContain("only the final version");
    expect(p).toContain("no second version");
    expect(p).toContain("other common view");
    expect(p).toContain("on which experts disagree");
    expect(p).toContain("no arrows");
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
    expect(getPrompt("test-items-items@v2").verbatim).toMatch(/LimeOnIt/);
    expect(getPrompt("test-items-items@v3").verbatim).toMatch(/LimeOnIt/);
  });

  // Metingen t and u: correction traces in the answer-model headings and three options in
  // statistics; two rounds of prompt text did not help. @v2 gets a fixed plan per question,
  // computed in code from the blueprint table (STATUS.md, Later).
  it("gives the questions stage a fixed plan per question, computed from the blueprint", () => {
    const nl = runtime("items", "nl");
    expect(nl).toContain(
      "- Vraag 1 (1 pt): Rij R1, toepassen, meerkeuze met vier opties (A tot en met D)",
    );
    expect(nl).toContain("- Vraag 12 (3 pt): Rij R2, analyseren, open vraag");
    expect(nl.toLowerCase()).toContain("vaste vraagindeling");
    const en = runtime("items", "en");
    expect(en).toContain("- Question 9 (3 pt): Row R2, analyze, open question");
    expect(en.toLowerCase()).toContain("fixed question plan");
  });

  it("always asks for four options, no longer three (nl, en)", () => {
    const nl = runtime("items", "nl").toLowerCase();
    expect(nl).toContain("vier opties");
    expect(nl).not.toContain("gebruik dan drie opties");
    const en = runtime("items", "en").toLowerCase();
    expect(en).toContain("four options");
    expect(en).not.toContain("use three options");
  });

  // Meting v: one statistics run was cut off at question 8 at 24576 tokens.
  it("gives the questions stage the largest output budget the registry allows", () => {
    expect(tool().stages[1]!.maxTokens).toBe(32000);
  });

  // Meting v: a correct t-value (2,131) that was not in the material failed inventedContent.
  it("puts a table value that is not in the material in the question, as given (nl, en)", () => {
    const nl = runtime("items", "nl").toLowerCase();
    expect(nl).toContain("tabelwaarde");
    expect(nl).toContain("gegeven:");
    const en = runtime("items", "en").toLowerCase();
    expect(en).toContain("table value");
    expect(en).toContain("given:");
  });

  it("keeps @v1 and @v2 registered for results made with them", () => {
    expect(getPrompt("test-items-items@v1")).toBeDefined();
    expect(getPrompt("test-items-items@v2")).toBeDefined();
  });

  // Metingen p, r2, u and w: the first question of a new row got the previous row in its
  // answer-model heading ("Row R1 is not used; this is Row R2"), carried over from the
  // identical headings above it. @v3 states the row once, in its own heading above its
  // questions, so no question heading repeats a row.
  it("groups the answer model per row, with the row in its own heading (nl)", () => {
    const p = runtime("items", "nl");
    expect(p).toContain("### Rij Rx — denkniveau (vraag a–b)");
    expect(p).toContain("#### Vraag n");
    expect(p).not.toContain("### Vraag n — Rij Rx");
    expect(p.toLowerCase()).toContain("onder het kopje van zijn rij");
  });

  it("groups the answer model per row, with the row in its own heading (en)", () => {
    const p = runtime("items", "en");
    expect(p).toContain("### Row Rx — cognitive level (questions a–b)");
    expect(p).toContain("#### Question n");
    expect(p).not.toContain("### Question n — Row Rx");
    expect(p.toLowerCase()).toContain("under the heading of its row");
  });
});

describe("test-items → course (P26.2)", () => {
  it("only the blueprint stage exports a question-level matrix, as data", () => {
    expect(tool().stages.map((s) => s.courseExport)).toEqual(["assessment-items", undefined]);
  });
});
