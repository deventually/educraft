import type { Tool } from "../types";
import { CONVERSATION_PREP_PROMPT_V2 } from "~/lib/prompts/conversation-prep@v2.prompt";
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
    nl: "Krijg vragen voor een startgesprek, een voortgangsgesprek, een dreigend negatief studieadvies, twijfel over stoppen of de keuze voor een richting of stage: hoe je opent, doorvraagt, afsluit en doorverwijst.",
    en: "Get questions for a starting conversation, a progress conversation, a threatening negative study advice, doubts about quitting or choosing a direction or internship: how to open, follow up, close and refer on.",
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
          value: "direction-or-internship-choice",
          label: {
            nl: "Keuze voor een richting of stage",
            en: "Choosing a direction or internship",
          },
        },
      ],
      help: {
        nl: "Bij een richting: bijvoorbeeld een uitstroomrichting of keuzedeel in het mbo, of een minor of afstudeerrichting in het hbo.",
        en: "For a direction: for example a specialisation or elective in mbo, or a minor or graduation track in higher education.",
      },
      group: CONVERSATION,
    },
    {
      name: "phase",
      label: { nl: "Fase van de studie", en: "Phase of the programme" },
      kind: "select",
      required: true,
      defaultValue: "first-year",
      options: [
        { value: "first-year", label: { nl: "Eerste jaar", en: "First year" } },
        {
          value: "later-years",
          label: { nl: "Later in de opleiding", en: "Later in the programme" },
        },
      ],
      help: {
        nl: "Bijvoorbeeld: in het mbo is het eerste jaar leerjaar 1, in het hbo de propedeuse. Later in de opleiding is in het mbo leerjaar 2 en verder, in het hbo de hoofdfase.",
        en: "For example, in mbo the first year is year 1; in higher education it is the foundation year. Later in the programme means year 2 and beyond in mbo, and the main phase in higher education.",
      },
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
      systemPromptId: CONVERSATION_PREP_PROMPT_V2.id,
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
