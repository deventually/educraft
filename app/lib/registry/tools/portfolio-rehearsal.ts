import type { Tool } from "../types";
import { PORTFOLIO_REHEARSAL_PROMPT_V2 } from "~/lib/prompts/portfolio-rehearsal@v2.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";
import { REHEARSAL_CLOSE, REHEARSAL_START } from "~/lib/portfolio/rehearsal";

/**
 * Proefassessment — brief P29, 29.3. A played assessment committee that has read the
 * teacher's own BDB/BKE dossier. Not in the tool catalogue (BESLUIT-2026-11-05-8): it opens
 * only from step 5 of a dossier, at /portfolio/:id/rehearsal. The server builds the prompt
 * from the dossier (`contextFrom: "dossier"`); the conversation is not saved, only the
 * feedback when the teacher keeps it.
 */
export const portfolioRehearsal: Tool = {
  id: "portfolio-rehearsal",
  slug: "portfolio-rehearsal",
  name: { nl: "Oefen je eindgesprek", en: "Practise your final interview" },
  subtitle: { nl: "Proefassessment", en: "Rehearsal assessment" },
  tagline: {
    nl: "Een gespeelde commissie die jouw dossier las, stelt één vraag tegelijk. Daarna krijg je feedback per criterium.",
    en: "A simulated committee that read your portfolio asks one question at a time. Afterwards you get feedback per criterion.",
  },
  icon: "message-circle",
  userType: "instructor",
  mode: "chat",
  theory: {
    name: { nl: "Criteriumgericht interview (STARR)", en: "Criterion-based interview (STARR)" },
    summary: {
      nl: "In een criteriumgericht interview laat je met eigen voorbeelden zien dat je aan een criterium voldoet: de situatie, je taak, wat je deed, het resultaat en je reflectie.",
      en: "In a criterion-based interview you show with your own examples that you meet a criterion: the situation, your task, what you did, the result and your reflection.",
    },
    keyCitations: [],
  },
  attribution: originalAttribution({
    source: { nl: "Origineel LimeOnIt-instrument.", en: "Original LimeOnIt instrument." },
  }),
  usesContextProfile: true,
  contextFrom: "dossier",
  hiddenFromCatalogue: true,
  storesConversation: false,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-5-5",
  defaultMaxTokens: 3072,
  defaultTemperature: 0.7,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "length",
      label: { nl: "Hoe lang?", en: "How long?" },
      kind: "select",
      required: true,
      defaultValue: "short",
      options: [
        {
          value: "short",
          label: { nl: "Kort (ongeveer 15 minuten)", en: "Short (about 15 minutes)" },
        },
        {
          value: "full",
          label: { nl: "Volledig (ongeveer 30 minuten)", en: "Full (about 30 minutes)" },
        },
      ],
    },
    {
      name: "outcomeIds",
      label: { nl: "Welke leeruitkomsten?", en: "Which learning outcomes?" },
      kind: "multiselect",
      // The dossier's own outcomes; the rehearsal page offers them.
      options: [],
    },
  ],
  stages: [
    {
      id: "interview",
      name: { nl: "Proefassessment", en: "Rehearsal assessment" },
      systemPromptId: PORTFOLIO_REHEARSAL_PROMPT_V2.id,
      output: { kind: "markdown" },
    },
  ],
  chat: {
    starters: [REHEARSAL_START],
    quickReplies: [REHEARSAL_CLOSE],
    allowStop: true,
    allowRegenerate: false,
  },
};
