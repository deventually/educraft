import type { Tool } from "../types";
import { BLOOM_BY_DESIGN_PROMPT } from "~/lib/prompts/bloom-by-design.prompt";
import { attribution } from "~/lib/prompts/attribution";

const CONTEXT = { nl: "Context", en: "Context" };

export const bloomByDesign: Tool = {
  id: "bloom-by-design",
  slug: "bloom-by-design",
  name: {
    nl: "Bloom by Design — Onderwijstechnologie Alignment",
    en: "Bloom by Design — EdTech Alignment",
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
    authors: "Adam Palczewski, Laura Decuzzi, Dempsey Cruz",
    sourcePages: "pp. 189–209",
    evaluatedWith: { nl: "Claude", en: "Claude" },
    adapted: false,
  }),
  usesContextProfile: false,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-4-6",
  defaultTemperature: 0.7,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "learningOutcome",
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
