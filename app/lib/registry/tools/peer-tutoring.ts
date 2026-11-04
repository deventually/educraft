import type { Tool } from "../types";
import { PEER_TUTORING_PROMPT } from "~/lib/prompts/peer-tutoring.prompt";
import { attribution } from "~/lib/prompts/attribution";

const CONTEXT = { nl: "Context", en: "Context" };

export const peerTutoring: Tool = {
  id: "peer-tutoring",
  slug: "peer-tutoring",
  name: { nl: "Bronnen leren beoordelen", en: "Learn to judge sources" },
  /** Book/technique name shown small under the task-first name. */
  subtitle: { nl: "Peer Tutoring (bronnenevaluatie)", en: "Peer Tutoring (source evaluation)" },
  tagline: {
    nl: "Leer onderzoeksbronnen kritisch evalueren met begeleiding van een gelijkwaardige peer.",
    en: "Learn to critically evaluate research sources with guidance from an equal peer.",
  },
  icon: "book-open",
  userType: "student",
  mode: "chat",
  theory: {
    name: {
      nl: "Kritisch Denken in Onderzoek",
      en: "Critical Thinking in Research",
    },
    summary: {
      nl: "Ontwikkel onderzoeksvaardigheden door stap-voor-stap begeleiding in bronnevaluatie. Leer frames zoals CRAAP, RADAR en SIFT toe.",
      en: "Develop research skills through step-by-step guidance in source evaluation. Apply frameworks like CRAAP, RADAR, and SIFT.",
    },
    keyCitations: ["Kuhn (2010)", "Metzger & Flanagin (2008)", "Sward (2006)"],
  },
  attribution: attribution({
    chapterTitle:
      "Generative AI Peer Tutoring to Support Peer-Reviewed Source Identification and Evaluation",
    authors:
      "Rae Mair, Michelle Kelley, Taylar Wenzel, Andrea C. Burrows Borowczak, Yuqing Li, & Mike Borowczak",
    sourcePages: "pp. 236–239",
    evaluatedWith: {
      nl: "ChatGPT, Claude, Copilot en Gemini",
      en: "ChatGPT, Claude, Copilot and Gemini",
    },
    adapted: true,
    adaptation: {
      nl: "Wij volgen de stappen uit het boek: de tutor helpt de student stap voor stap een bron herkennen als peer-reviewed en die beoordelen, zonder het antwoord te geven. De opdracht en het vak komen uit het formulier, het niveau uit het contextprofiel, en het gesprek is in het Nederlands, met regels voor grenzen en een stabiel gesprek erbij.",
      en: "We follow the book's steps: the tutor helps the student step by step to identify a source as peer-reviewed and evaluate it, without giving the answer. The assignment and subject come from the form, the level from the context profile, and the conversation is in Dutch, with rules for boundaries and a stable conversation added.",
    },
  }),
  // The teacher's context profile seeds the learner's level (EQF); the bespoke
  // high-school/undergraduate/graduate input is retired onto that spine (P6.8).
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-5-5",
  defaultMaxTokens: 2048,
  defaultTemperature: 0.7,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "assignment",
      label: {
        nl: "Wat is je onderzoeksopdracht?",
        en: "What is your research assignment?",
      },
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: {
        nl: "bijv. Literatuuronderzoek naar klimaatverandering",
        en: "e.g. Literature review on climate change",
      },
      group: CONTEXT,
    },
    {
      name: "discipline",
      label: {
        nl: "Vakgebied",
        en: "Discipline",
      },
      kind: "text",
      required: true,
      placeholder: {
        nl: "bijv. Milieuwetenschap",
        en: "e.g. Environmental Science",
      },
      group: CONTEXT,
    },
  ],
  stages: [
    {
      id: "tutoring",
      name: { nl: "Peer Tutoring", en: "Peer Tutoring" },
      description: {
        nl: "Stap-voor-stap bronnevaluatie met een gelijkwaardige peer.",
        en: "Step-by-step source evaluation with an equal peer.",
      },
      systemPromptId: PEER_TUTORING_PROMPT.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Begeleiding in kritische evaluatie van onderzoeksbronnen.",
          en: "Guidance in critical evaluation of research sources.",
        },
      },
    },
  ],
  chat: {
    greeting: {
      nl: "Hallo! Ik ben je peer tutor voor bronnevaluatie. Ik zal je helpen kritisch na te denken over de kwaliteit en relevantie van je bronnen. Laten we beginnen met je opdrachtomschrijving.",
      en: "Hi! I'm your peer tutor for source evaluation. I'll help you think critically about the quality and relevance of your sources. Let's start with your assignment instructions.",
    },
    starters: [
      {
        nl: "Ik wil controleren of een bron peer-reviewed is",
        en: "I want to check if a source is peer-reviewed",
      },
      {
        nl: "Ik wil een bron evalueren met CRAAP",
        en: "I want to evaluate a source with CRAAP",
      },
      {
        nl: "Ik ben niet zeker of een bron relevant is",
        en: "I'm not sure if a source is relevant",
      },
    ],
    allowStop: true,
    allowRegenerate: true,
  },
};
