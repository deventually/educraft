import type { Tool } from "../types";
import { TEST_ANALYSIS_PROMPT } from "~/lib/prompts/test-analysis@v1.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";

const TEST = { nl: "Toets", en: "Test" };

/**
 * Toetsanalyse uitleggen — brief P24, 24.5b. An original LimeOnIt tool: it explains numbers that
 * were computed in code (the item-analysis utility, which fills `analysis` via "Laat uitleggen",
 * or an export from the test system). The AI computes nothing; it says which questions to look
 * at first and why, and what the teacher can do with a question that did not work.
 */
export const testAnalysis: Tool = {
  id: "test-analysis",
  slug: "test-analysis",
  name: { nl: "Toetsanalyse uitleggen", en: "Explain a test analysis" },
  subtitle: {
    nl: "Welke vragen je na de toets herziet, en waarom",
    en: "Which questions to revise after a test, and why",
  },
  tagline: {
    nl: "Laat de p-waarde, Rit, Rir en alfa van je toets uitleggen: welke vragen je eerst bekijkt, waarom, en wat je met een foute vraag kunt doen. De AI rekent niets zelf.",
    en: "Have the p-value, Rit, Rir and alpha of your test explained: which questions to look at first, why, and what you can do with a faulty question. The AI computes nothing itself.",
  },
  icon: "chart-column",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: { nl: "Klassieke testtheorie", en: "Classical test theory" },
    summary: {
      nl: "De p-waarde zegt hoe moeilijk een vraag was, de Rit en Rir hoe goed hij onderscheidt tussen kandidaten die de stof wel en niet beheersen, en Cronbachs alfa hoe betrouwbaar de totaalscore is (Cronbach, 1951). Grenswaarden zijn vuistregels: de getallen zijn een reden om een vraag opnieuw te lezen, geen oordeel (Van Berkel et al., 2023).",
      en: "The p-value says how hard a question was, the Rit and Rir how well it discriminates between candidates who do and do not master the material, and Cronbach's alpha how reliable the total score is (Cronbach, 1951). Thresholds are rules of thumb: the numbers are a reason to reread a question, not a verdict (Van Berkel et al., 2023).",
    },
    keyCitations: ["Cronbach (1951)", "Van Berkel et al. (2023)"],
  },
  attribution: originalAttribution({
    source: {
      nl: "Origineel LimeOnIt-instrument. Klassieke testtheorie naar Cronbach (1951) en Van Berkel e.a. (red.), Toetsen in het hoger onderwijs (5e editie, 2023).",
      en: "Original LimeOnIt instrument. Classical test theory after Cronbach (1951) and Van Berkel et al. (eds.), Toetsen in het hoger onderwijs (5th edition, 2023).",
    },
  }),
  usesContextProfile: false,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-5-5",
  defaultMaxTokens: 8192,
  defaultTemperature: 0.2,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "analysis",
      label: { nl: "Uitkomsten van de toetsanalyse", en: "Results of the test analysis" },
      kind: "textarea",
      required: true,
      rows: 10,
      placeholder: {
        nl: "| Vraag | Max | p | Rit | Rir | Alfa zonder deze vraag |\n| V1 | 1 | 0,82 | 0,41 | 0,33 | 0,76 |",
        en: "| Question | Max | p | Rit | Rir | Alpha without this question |\n| Q1 | 1 | 0.82 | 0.41 | 0.33 | 0.76 |",
      },
      help: {
        nl: 'Reken de getallen uit met het hulpmiddel "Toetsuitslag per vraag analyseren" en klik daar op "Laat uitleggen", of plak de itemanalyse uit je toetssysteem. Alleen getallen per vraag, geen namen.',
        en: 'Compute the numbers with the utility "Analyse test results per question" and click "Explain this" there, or paste the item analysis from your test system. Numbers per question only, no names.',
      },
      group: TEST,
    },
    {
      name: "testInfo",
      label: { nl: "Over de toets (optioneel)", en: "About the test (optional)" },
      kind: "textarea",
      rows: 3,
      placeholder: {
        nl: "bijv. Kennistoets statistiek, 30 meerkeuzevragen met 4 opties, cesuur 55%, eindtoets van blok 2.",
        en: "e.g. Statistics knowledge test, 30 multiple-choice questions with 4 options, pass mark 55%, end-of-term test.",
      },
      help: {
        nl: "Noem bij meerkeuze het aantal antwoordopties: dan kan de tool de raadkans meenemen.",
        en: "For multiple choice, give the number of answer options: the tool can then take the guessing level into account.",
      },
      group: TEST,
    },
    {
      name: "questions",
      label: {
        nl: "Vragen en antwoordsleutel (optioneel)",
        en: "Questions and answer key (optional)",
      },
      kind: "textarea",
      rows: 6,
      placeholder: {
        nl: "Plak de vragen die opvallen, met de sleutel. Dan kan de tool wijzen op een mogelijke oorzaak in de tekst.",
        en: "Paste the questions that stand out, with the key. The tool can then point to a possible cause in the text.",
      },
      group: TEST,
    },
  ],
  stages: [
    {
      id: "explain",
      name: { nl: "Uitleg", en: "Explanation" },
      systemPromptId: TEST_ANALYSIS_PROMPT.id,
      output: {
        kind: "structured-sections",
        hint: {
          nl: "In het kort, de betrouwbaarheid, de vragen om eerst te bekijken, wat goed werkt, vervolgstappen en wat de getallen niet zeggen.",
          en: "In short, reliability, the questions to look at first, what works well, next steps and what the numbers do not say.",
        },
      },
    },
  ],
};
