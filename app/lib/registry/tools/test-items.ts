import type { Tool } from "../types";
import { TEST_ITEMS_BLUEPRINT, TEST_ITEMS_ITEMS } from "~/lib/prompts/test-items.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";

const CONTENT = { nl: "Leeruitkomsten en leerstof", en: "Learning outcomes and material" };
const TEST = { nl: "Toets", en: "Test" };

/**
 * Toetsvragen en toetsmatrijs maken — brief P24, 24.3. An original LimeOnIt tool in two
 * stages: (1) a test blueprint (learning outcome × cognitive level, question type, number
 * of questions, points) that adds up; (2) the questions from that blueprint, with an
 * answer model and, for multiple choice, why each distractor is wrong.
 */
export const testItems: Tool = {
  id: "test-items",
  slug: "test-items",
  name: { nl: "Toetsvragen en toetsmatrijs maken", en: "Write test questions and a blueprint" },
  subtitle: {
    nl: "Matrijs naar Bloom, vragen met antwoordmodel",
    en: "Blueprint after Bloom, questions with answer model",
  },
  tagline: {
    nl: "Maak bij je leeruitkomsten eerst een toetsmatrijs die optelt, en daarna de vragen volgens die matrijs, met antwoordmodel en bij meerkeuze de reden waarom elke afleider fout is.",
    en: "First build a test blueprint for your learning outcomes that adds up, then the questions that follow it, with an answer model and, for multiple choice, why each distractor is wrong.",
  },
  icon: "clipboard-check",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: {
      nl: "Toetsmatrijs naar de herziene taxonomie van Bloom, en richtlijnen voor meerkeuzevragen",
      en: "Test blueprint after the revised Bloom's taxonomy, and multiple-choice item-writing guidelines",
    },
    summary: {
      nl: "Een toetsmatrijs verdeelt de vragen over de leeruitkomsten en toetst elke leeruitkomst op het denkniveau van het werkwoord (Anderson & Krathwohl, 2001). Een goede meerkeuzevraag heeft precies één goed antwoord, geen aanwijzing naar dat antwoord en aannemelijke afleiders die echte fouten van studenten vangen (Haladyna, Downing & Rodriguez, 2002).",
      en: "A test blueprint spreads the questions over the learning outcomes and tests each outcome at the cognitive level of its verb (Anderson & Krathwohl, 2001). A good multiple-choice question has exactly one correct answer, no clue to that answer and plausible distractors that catch real student errors (Haladyna, Downing & Rodriguez, 2002).",
    },
    keyCitations: ["Anderson & Krathwohl (2001)", "Haladyna, Downing & Rodriguez (2002)"],
  },
  attribution: originalAttribution({
    source: {
      nl: "Origineel LimeOnIt-instrument, naar Anderson & Krathwohl (2001) en Haladyna, Downing & Rodriguez (2002).",
      en: "Original LimeOnIt instrument, after Anderson & Krathwohl (2001) and Haladyna, Downing & Rodriguez (2002).",
    },
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-5-5",
  defaultMaxTokens: 8192,
  defaultTemperature: 0.3,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "learningOutcomes",
      prefillFromCourse: { source: "learningOutcomes" },
      label: { nl: "Leeruitkomsten", en: "Learning outcomes" },
      kind: "textarea",
      required: true,
      rows: 4,
      placeholder: {
        nl: "Eén per regel, bijv. De student berekent en interpreteert een betrouwbaarheidsinterval voor een gemiddelde.",
        en: "One per line, e.g. The student calculates and interprets a confidence interval for a mean.",
      },
      help: {
        nl: 'Gebruik een waarneembaar werkwoord, zoals berekent, verklaart of kiest. Een leeruitkomst met "begrijpt" of "kent" neemt de tool niet op; hij stelt dan een scherpere formulering voor.',
        en: 'Use an observable verb, such as calculates, explains or chooses. The tool leaves out an outcome with "understands" or "knows" and proposes a sharper wording.',
      },
      group: CONTENT,
    },
    {
      name: "material",
      label: { nl: "Leerstof", en: "Material" },
      kind: "textarea",
      required: true,
      rows: 6,
      placeholder: {
        nl: "Plak de kern van de leerstof, of beschrijf de begrippen, formules en voorbeelden waar de toets over gaat.",
        en: "Paste the core of the material, or describe the concepts, formulas and examples the test covers.",
      },
      help: {
        nl: "De vragen en antwoorden komen alleen uit wat hier staat. Hoe concreter, hoe beter de afleiders.",
        en: "The questions and answers come only from what is here. The more concrete, the better the distractors.",
      },
      group: CONTENT,
    },
    {
      name: "questionCount",
      label: { nl: "Aantal vragen", en: "Number of questions" },
      kind: "number",
      required: true,
      min: 2,
      max: 60,
      step: 1,
      defaultValue: 12,
      group: TEST,
    },
    {
      name: "questionTypes",
      label: { nl: "Vraagvormen", en: "Question types" },
      kind: "select",
      defaultValue: "mixed",
      options: [
        { value: "multiple-choice", label: { nl: "Alleen meerkeuze", en: "Multiple choice only" } },
        { value: "mixed", label: { nl: "Meerkeuze en open", en: "Multiple choice and open" } },
        { value: "open", label: { nl: "Alleen open vragen", en: "Open questions only" } },
      ],
      group: TEST,
    },
    {
      name: "conditions",
      label: {
        nl: "Punten, toetsduur en weging (optioneel)",
        en: "Points, test duration and weighting (optional)",
      },
      kind: "textarea",
      rows: 3,
      placeholder: {
        nl: "bijv. 40 punten, 60 minuten, leeruitkomst 2 telt dubbel. Cesuur 55%.",
        en: "e.g. 40 points, 60 minutes, outcome 2 counts double. Pass mark 55%.",
      },
      help: {
        nl: "Leeg laten mag: dan doet de tool een voorstel, en dat staat er ook bij.",
        en: "You may leave this empty: the tool then makes a proposal, and says so.",
      },
      group: TEST,
    },
  ],
  stages: [
    {
      id: "blueprint",
      name: { nl: "1. Toetsmatrijs", en: "1. Test blueprint" },
      description: {
        nl: "Per leeruitkomst het denkniveau, de vraagvorm, het aantal vragen en de punten, in een tabel die optelt.",
        en: "For each learning outcome the cognitive level, question type, number of questions and points, in a table that adds up.",
      },
      systemPromptId: TEST_ITEMS_BLUEPRINT.id,
      output: {
        kind: "structured-sections",
        hint: {
          nl: "Koppeling met de leeruitkomsten, de toetsmatrijs als tabel, verdeling en punten, en een zelfcheck.",
          en: "Link to the learning outcomes, the test blueprint as a table, distribution and points, and a self-check.",
        },
      },
    },
    {
      id: "items",
      name: { nl: "2. Toetsvragen", en: "2. Test questions" },
      description: {
        nl: "De vragen volgens de matrijs, met antwoordmodel en bij meerkeuze de reden waarom elke afleider fout is.",
        en: "The questions from the blueprint, with an answer model and, for multiple choice, why each distractor is wrong.",
      },
      systemPromptId: TEST_ITEMS_ITEMS.id,
      consumes: [{ placeholder: "blueprint", fromStageId: "blueprint" }],
      // Meting p: calculation-heavy sets ran out of budget while thinking.
      maxTokens: 24576,
      output: {
        kind: "structured-sections",
        hint: {
          nl: "De vragen klaar voor studenten, het antwoordmodel, een controle tegen de matrijs en een zelfcheck.",
          en: "The questions ready for students, the answer model, a check against the blueprint and a self-check.",
        },
      },
    },
  ],
};
