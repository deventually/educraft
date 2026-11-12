import type { Tool } from "../types";
import { CONVERSATION_PREP_PROMPT } from "~/lib/prompts/conversation-prep@v1.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";
import { DEFAULT_MODEL } from "~/lib/ai/models";

const CONVERSATION = { nl: "Het gesprek", en: "The conversation" };

/**
 * Een gesprek voorbereiden — brief P39, 39.2. An original LimeOnIt tool for study career
 * coaching: a set of questions for one kind of conversation. Only the situation, never the
 * student; no advice on a study advice (BSA) decision; no counter named by name until the
 * institution lists its own (P39.4).
 */
export const conversationPrep: Tool = {
  id: "conversation-prep",
  slug: "conversation-prep",
  name: { nl: "Een gesprek voorbereiden", en: "Prepare a conversation" },
  subtitle: {
    nl: "Vragen voor een SLB-gesprek, per situatie",
    en: "Questions for a study career conversation, per situation",
  },
  tagline: {
    nl: "Krijg vragen voor een startgesprek, een voortgangsgesprek, een dreigend negatief studieadvies, twijfel over stoppen of de keuze voor een minor of stage: hoe je opent, doorvraagt, afsluit en doorverwijst.",
    en: "Get questions for a starting conversation, a progress conversation, a threatening negative study advice, doubts about quitting or choosing a minor or internship: how to open, follow up, close and refer on.",
  },
  icon: "messages-square",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: { nl: "Gesprekstechniek", en: "Conversation technique" },
    summary: {
      nl: "Een goed voorbereid gesprek begint met open vragen, laat de student aan het woord, vraagt door op wat de student zelf zegt en eindigt met samen gemaakte afspraken. Wat buiten de rol van de SLB'er valt, gaat naar de juiste hulp.",
      en: "A well-prepared conversation starts with open questions, lets the student speak, follows up on what the student says and ends with agreements made together. What falls outside the study career coach's role goes to the right help.",
    },
    keyCitations: [],
  },
  attribution: originalAttribution({
    source: {
      nl: "Origineel LimeOnIt-instrument (brief P39), op basis van algemene gesprekstechniek; geen gespreksmodel.",
      en: "Original LimeOnIt instrument (brief P39), based on general conversation technique; no conversation model.",
    },
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: DEFAULT_MODEL,
  defaultMaxTokens: 3072,
  defaultTemperature: 0.4,
  next: ["difficult-conversation"],
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "situation",
      label: { nl: "Welk gesprek bereid je voor?", en: "Which conversation are you preparing?" },
      kind: "select",
      required: true,
      defaultValue: "progress",
      options: [
        { value: "start", label: { nl: "Startgesprek", en: "Starting conversation" } },
        { value: "progress", label: { nl: "Voortgangsgesprek", en: "Progress conversation" } },
        {
          value: "negative-study-advice",
          label: {
            nl: "Dreigend negatief studieadvies (BSA)",
            en: "Threatening negative binding study advice",
          },
        },
        {
          value: "dropout",
          label: {
            nl: "Twijfel over doorgaan of stoppen",
            en: "Doubts about continuing or quitting",
          },
        },
        {
          value: "minor-or-internship-choice",
          label: { nl: "Keuze voor een minor of stage", en: "Choosing a minor or internship" },
        },
      ],
      group: CONVERSATION,
    },
    {
      name: "phase",
      label: { nl: "Fase van de studie", en: "Phase of the programme" },
      kind: "select",
      required: true,
      defaultValue: "propaedeutic",
      options: [
        { value: "propaedeutic", label: { nl: "Propedeuse", en: "Foundation year" } },
        { value: "main-phase", label: { nl: "Hoofdfase", en: "Main phase" } },
      ],
      group: CONVERSATION,
    },
    {
      name: "goal",
      label: {
        nl: "Wat wil je met het gesprek bereiken? (optioneel)",
        en: "What do you want to achieve with the conversation? (optional)",
      },
      kind: "textarea",
      rows: 2,
      placeholder: {
        nl: "bijv. Samen kijken wat er nodig is om de laatste herkansingen te halen.",
        en: "e.g. Looking together at what it takes to pass the last resits.",
      },
      help: {
        nl: "Kort, over de situatie. Geen namen of persoonlijke gegevens.",
        en: "Short, about the situation. No names or personal details.",
      },
      group: CONVERSATION,
    },
  ],
  stages: [
    {
      id: "questions",
      name: { nl: "Vragenset", en: "Set of questions" },
      description: {
        nl: "Vragen om te openen, door te vragen en af te sluiten, wat je niet vraagt en wanneer je doorverwijst.",
        en: "Questions to open, follow up and close, what not to ask and when to refer on.",
      },
      systemPromptId: CONVERSATION_PREP_PROMPT.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Een vragenset voor de situatie, niet voor een bepaalde student.",
          en: "A set of questions for the situation, not for a particular student.",
        },
      },
    },
  ],
};
