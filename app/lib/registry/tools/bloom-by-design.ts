import type { Tool } from "../types";
import { BLOOM_BY_DESIGN_PROMPT } from "~/lib/prompts/bloom-by-design.prompt";
import { attribution } from "~/lib/prompts/attribution";

const CONTEXT = { nl: "Context", en: "Context" };

export const bloomByDesign: Tool = {
  id: "bloom-by-design",
  slug: "bloom-by-design",
  name: { nl: "Onderwijstechnologie kiezen", en: "Choose educational technology" },
  /** Book/technique name shown small under the task-first name. */
  subtitle: {
    nl: "Bloom by Design (Constructive Alignment)",
    en: "Bloom by Design (Constructive Alignment)",
  },
  tagline: {
    nl: "Selecteer onderwijstechnologie op basis van leerresultaten, niet op voorkeur.",
    en: "Select educational technology based on learning outcomes, not preference.",
  },
  icon: "target",
  userType: "instructor",
  mode: "chat",
  theory: {
    name: {
      nl: "Constructive Alignment",
      en: "Constructive Alignment",
    },
    summary: {
      nl: "Stem leerresultaten, onderwijsactiviteiten en evaluatie op elkaar af om coherente, effectieve onderwijs te creëren.",
      en: "Align learning outcomes, teaching activities, and assessment to create coherent, effective instruction.",
    },
    keyCitations: ["Biggs (1996)", "Wiggins & McTighe (1998)", "Bloom (1956)"],
  },
  attribution: attribution({
    chapterTitle:
      "Bloom by Design: Prompt Engineering an AI Chatbot for Constructive Alignment of Outcomes and EdTech",
    authors: "Adam Palczewski, Laura Decuzzi, & Dempsey Cruz",
    sourcePages: "pp. 206–207",
    evaluatedWith: { nl: "ChatGPT-4o", en: "ChatGPT-4o" },
    adapted: true,
    adaptation: {
      nl: "In het boek beveelt de chatbot alleen tools aan uit een kennisbron met goedgekeurde onderwijstechnologie van de eigen instelling, met links. LimeOnIt geeft zo'n kennisbron niet mee, dus de chat noemt tools uit algemene kennis: ga zelf na of een tool bij jouw instelling is toegestaan. De chat is in het Nederlands.",
      en: "In the book the chatbot only recommends tools from a knowledge source of the institution's approved educational technology, with links. LimeOnIt supplies no such knowledge source, so the chat names tools from general knowledge: check yourself whether a tool is allowed at your institution. The chat is in Dutch.",
    },
  }),
  usesContextProfile: false,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-5-5",
  defaultMaxTokens: 2048,
  defaultTemperature: 0.7,
  courseActions: ["outcome"],
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "learningOutcome",
      prefillFromCourse: { source: "learningOutcomes" },
      label: {
        nl: "Wat moeten studenten kunnen doen?",
        en: "What should students be able to do?",
      },
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: {
        nl: "bijv. Analyseer case studies in bedrijfsbeslissingen",
        en: "e.g. Analyze case studies in business decisions",
      },
      group: CONTEXT,
    },
    {
      name: "assessmentGoals",
      label: {
        nl: "Hoe zal je het succes meten?",
        en: "How will you measure success?",
      },
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: {
        nl: "bijv. Kritisch denken evalueren; niveau: Analyse (Bloom L4)",
        en: "e.g. Evaluate critical thinking; level: Analysis (Bloom L4)",
      },
      group: CONTEXT,
    },
    {
      name: "context",
      label: {
        nl: "Onderwijscontext",
        en: "Teaching context",
      },
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: {
        nl: "bijv. Bedrijfsadministratie, 30 studenten, hybride onderwijs",
        en: "e.g. Business administration, 30 students, hybrid delivery",
      },
      group: CONTEXT,
    },
  ],
  stages: [
    {
      id: "alignment",
      name: { nl: "Bloom by Design", en: "Bloom by Design" },
      description: {
        nl: "Gids voor het selecteren van onderwijstechnologie op basis van constructive alignment.",
        en: "Guide for selecting educational technology based on constructive alignment.",
      },
      systemPromptId: BLOOM_BY_DESIGN_PROMPT.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Aanbevelingen voor onderwijstechnologie afgestemd op je leerresultaten.",
          en: "Educational technology recommendations aligned to your learning outcomes.",
        },
      },
    },
  ],
  chat: {
    greeting: {
      nl: "Welkom bij Bloom by Design! Ik help je onderwijstechnologie te selecteren op basis van constructive alignment—het afstemmen van leerresultaten, activiteiten en evaluatie. Laten we beginnen met je leerresultaten.",
      en: "Welcome to Bloom by Design! I help you select educational technology based on constructive alignment—coordinating learning outcomes, activities, and assessment. Let's start with your learning outcomes.",
    },
    starters: [
      {
        nl: "Ik wil mijn leerresultaten verduidelijken",
        en: "I want to clarify my learning outcomes",
      },
      {
        nl: "Ik wil tools ontdekken die bij mijn doelen passen",
        en: "I want to discover tools that fit my goals",
      },
      {
        nl: "Hoe stem ik mijn evaluatie af op mijn leerresultaten?",
        en: "How do I align my assessment with outcomes?",
      },
    ],
    allowStop: true,
    allowRegenerate: true,
  },
};
