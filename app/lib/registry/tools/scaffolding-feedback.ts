import type { Tool } from "../types";
import { SCAFFOLDING_FEEDBACK_PROMPT } from "~/lib/prompts/scaffolding-feedback.prompt";
import { attribution } from "~/lib/prompts/attribution";

const CONTEXT = { nl: "Context", en: "Context" };

export const scaffoldingFeedback: Tool = {
  id: "scaffolding-feedback",
  slug: "scaffolding-feedback",
  name: {
    nl: "Scaffolding Feedback — Warme Begeleiding",
    en: "Scaffolding Feedback — Warm Guidance",
  },
  tagline: {
    nl: "Een geduldig tutor die stap voor stap je probleemoplossing begeleidt.",
    en: "A patient tutor who guides your problem-solving step by step.",
  },
  icon: "graduation-cap",
  userType: "student",
  mode: "chat",
  theory: {
    name: {
      nl: "Cognitieve Begeleiding",
      en: "Cognitive Scaffolding",
    },
    summary: {
      nl: "Leer door progressieve, begeleide praktijk met warm feedback. Taak-complexiteit wordt geleidelijk opgebouwd terwijl steun afneemt.",
      en: "Learn through progressive, guided practice with warm feedback. Task complexity builds gradually as support fades.",
    },
    keyCitations: ["Sweller (1988)", "Hattie & Timperley (2007)", "Vygotsky (1978)"],
  },
  attribution: attribution({
    chapterTitle: "Scaffolding with Formative Feedback: A Deployable AI Tutoring Prompt System",
    authors: "multiple authors",
    sourcePages: "pp. 279–310",
    evaluatedWith: { nl: "Claude", en: "Claude" },
    adapted: false,
  }),
  // Learner tutor: the cohort's context profile seeds the level (EQF) with the
  // direct-address register directive (P6.8).
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-4-6",
  defaultMaxTokens: 2048,
  defaultTemperature: 0.7,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "subject",
      label: {
        nl: "Onderwerp",
        en: "Subject",
      },
      kind: "text",
      required: true,
      placeholder: {
        nl: "bijv. Algebra, Precalculus, Statistiek",
        en: "e.g. Algebra, Precalculus, Statistics",
      },
      group: CONTEXT,
    },
    {
      name: "studentBackground",
      label: {
        nl: "Hoe zou je je wiskundige achtergrond beschrijven?",
        en: "How would you describe your math background?",
      },
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: {
        nl: "bijv. Ik heb wiskundige angst, maar wil echt leren",
        en: "e.g. I have math anxiety but want to really learn",
      },
      group: CONTEXT,
    },
  ],
  stages: [
    {
      id: "tutoring",
      name: { nl: "Scaffolding Tutoring", en: "Scaffolding Tutoring" },
      description: {
        nl: "Warme, stap-voor-stap begeleiding voor wiskundige probleemoplossing.",
        en: "Warm, step-by-step guidance for mathematical problem-solving.",
      },
      systemPromptId: SCAFFOLDING_FEEDBACK_PROMPT.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Geduldig, begeleide instructie met formief feedback.",
          en: "Patient, guided instruction with formative feedback.",
        },
      },
    },
  ],
  chat: {
    greeting: {
      nl: "Welkom! Ik ben je tutor en ik ben blij je te helpen met {{subject}}. We gaan dit stap voor stap doen, en elke stap is belangrijk. Klaar om te beginnen?",
      en: "Welcome! I'm your tutor and I'm glad to help you with {{subject}}. We're going to take this step by step, and every step matters. Ready to start?",
    },
    starters: [
      {
        nl: "Ja, ik ben klaar. Geef me een probleem.",
        en: "Yes, I'm ready. Give me a problem.",
      },
      {
        nl: "Ik ben nerveus, maar ik wil dit proberen",
        en: "I'm nervous, but I want to try",
      },
      {
        nl: "Laten we beginnen met iets makkelijks",
        en: "Let's start with something easy",
      },
    ],
    allowStop: true,
    allowRegenerate: true,
  },
};
