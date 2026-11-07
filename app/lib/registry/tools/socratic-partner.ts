import type { Tool } from "../types";
import { SOCRATIC_PARTNER_PROMPT } from "~/lib/prompts/socratic-partner.prompt";
import { attribution } from "~/lib/prompts/attribution";
import { DEFAULT_MODEL } from "~/lib/ai/models";

const CONTEXT = { nl: "Context", en: "Context" };

export const socraticPartner: Tool = {
  id: "socratic-partner",
  slug: "socratic-partner",
  name: { nl: "Begrip verdiepen met vragen", en: "Deepen understanding with questions" },
  /** Book/technique name shown small under the task-first name. */
  subtitle: {
    nl: "Socratische Partner (kennisverificatie)",
    en: "Socratic Partner (knowledge verification)",
  },
  tagline: {
    nl: "Een onderwijsauteur stelt vragen om je begrip van een onderwerp dieper te maken.",
    en: "An educational author asks questions to deepen your understanding of a subject.",
  },
  icon: "lightbulb",
  userType: "student",
  mode: "chat",
  theory: {
    name: { nl: "Sokratische Dialoog", en: "Socratic Dialogue" },
    summary: {
      nl: "Leer door dialoog met een deskundige die vragen stelt in plaats van antwoorden te geven. De student ontdekt begrip door hun eigen redenering uit te spreken.",
      en: "Learn through dialogue with an expert who asks questions rather than providing answers. Students discover understanding by articulating their own reasoning.",
    },
    keyCitations: ["Socrates (ancient)", "Paul (2005)", "Chin & Brown (2002)"],
  },
  attribution: attribution({
    chapterTitle:
      "From Oracle to Socratic Partner: Redesigning Instruction with AI Through the Science of Learning",
    authors: "Andy Van Schaack & Roman Sarlo",
    sourcePages: "Appendix E.3, pp. 341–343",
    evaluatedWith: {
      nl: "Model-agnostisch (Claude, GPT-4, of gelijkwaardig)",
      en: "Model-agnostic (Claude, GPT-4, or equivalent)",
    },
    adapted: true,
    adaptation: {
      nl: "In het boek is dit een uitgewerkt voorbeeld: de student interviewt de auteur van een biologiehoofdstuk over natuurlijke selectie. Wij maken er een algemene versie van voor het onderwerp en hoofdstuk die de docent invult, met dezelfde opbouw: voorkennis ophalen, uitleggen in eigen woorden, eigen voorbeelden, en een afsluitende samenvatting. In het Nederlands.",
      en: "In the book this is a worked example: the student interviews the author of a biology chapter on natural selection. We make a general version for the subject and chapter the teacher fills in, with the same structure: recall prior knowledge, explain in your own words, your own examples, and a closing summary. In Dutch.",
    },
  }),
  // Learner tutor: the teacher's context profile seeds the level (EQF) with the
  // direct-address register directive (P6.8).
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: DEFAULT_MODEL,
  defaultMaxTokens: 2048,
  defaultTemperature: 0.7,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "subject",
      label: { nl: "Onderwerp", en: "Subject" },
      kind: "text",
      required: true,
      placeholder: { nl: "bijv. Biologie", en: "e.g. Biology" },
      group: CONTEXT,
    },
    {
      name: "chapter",
      label: { nl: "Hoofdstuk titel", en: "Chapter title" },
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: {
        nl: "bijv. Natuurlijke Selectie",
        en: "e.g. Natural Selection",
      },
      group: CONTEXT,
    },
  ],
  stages: [
    {
      id: "socratic",
      name: { nl: "Sokratisch Interview", en: "Socratic Interview" },
      description: {
        nl: "Een onderwijsauteur die je dieper begrip verifieert door dialoog.",
        en: "An educational author who verifies your deeper understanding through dialogue.",
      },
      systemPromptId: SOCRATIC_PARTNER_PROMPT.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Een ondervraging van je conceptueel begrip.",
          en: "An exploration of your conceptual understanding.",
        },
      },
    },
  ],
  chat: {
    greeting: {
      nl: "Hallo! Ik ben de auteur van je lesmateriaal. Ik ben oprecht geïnteresseerd in hoe jij over dit onderwerp denkt. Voordat we beginnen, wat herinner je je van wat je al in de klas hebt geleerd?",
      en: "Hello! I'm the author of your learning material. I'm genuinely interested in how you think about this subject. Before we start, what do you remember from what you already learned in class?",
    },
    starters: [
      {
        nl: "Ik herinner me wat voorkennis van de klas",
        en: "I remember some prior knowledge from class",
      },
      {
        nl: "Ik ben klaar om het hoofdstuk uit te leggen",
        en: "I'm ready to explain the chapter",
      },
      {
        nl: "Laten we een specifiek concept verkennen",
        en: "Let's explore a specific concept",
      },
    ],
    allowStop: true,
    allowRegenerate: true,
  },
};
