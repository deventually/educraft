import type { Tool } from "../types";
import {
  COGNITIVE_ARCHITECT_ANALYST,
  COGNITIVE_ARCHITECT_GENERATOR,
  COGNITIVE_ARCHITECT_VALIDATOR,
  COGNITIVE_ARCHITECT_ANALYST_GEN,
} from "~/lib/prompts/cognitive-architect.prompt";
import { attribution } from "~/lib/prompts/attribution";

export const cognitiveArchitect: Tool = {
  id: "cognitive-architect",
  slug: "cognitive-architect",
  nameNl: "Cognitive Architect — AI-leeractiviteit ontwerpen",
  taglineNl:
    "Ontwerp in vier fasen een AI-ondersteunde leeractiviteit op basis van de leerwetenschap (Gagné/Rosenshine).",
  icon: "layers",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: "Science of Learning (zes principes) + Gagné & Rosenshine",
    summaryNl:
      "Diagnosticeer een bestaande activiteit met de Cognitive Engagement Rubric en herontwerp deze tot een Socratische AI-dialoog die diep cognitief werk afdwingt.",
    keyCitations: [
      "Gagné (1965)",
      "Rosenshine (2012)",
      "Karpicke & Roediger (2008)",
      "Collins, Brown & Newman (1989)",
    ],
  },
  attribution: attribution({
    chapterTitle:
      "From Oracle to Socratic Partner: Redesigning Instruction with AI Through the Science of Learning",
    authors: "Andy Van Schaack & Roman Sarlo",
    sourcePages: "Appendices A–D, pp. 326–341",
    evaluatedWith: "Model-agnostisch (Claude, GPT-4, of gelijkwaardig)",
    adapted: true,
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-4-6",
  defaultTemperature: 0.4,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "gradeSubject",
      label: "Niveau & vak",
      kind: "text",
      required: true,
      placeholder: "bijv. hbo jaar 2, Databases",
      group: "Instructional Coordinates",
    },
    {
      name: "learningObjective",
      label: "Leerdoel",
      kind: "textarea",
      required: true,
      rows: 2,
      help: "Met actiewerkwoorden: wat moeten studenten kunnen?",
      group: "Instructional Coordinates",
    },
    {
      name: "legacyActivity",
      label: "Huidige activiteit (te vervangen)",
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: "bijv. Lees hoofdstuk 4 en beantwoord de vragen",
      group: "Instructional Coordinates",
    },
    {
      name: "instructionalPhase",
      label: "Instructiefase",
      kind: "select",
      required: true,
      options: [
        { value: "Introduction", label: "Introductie (eerste kennismaking)" },
        { value: "Guided Practice", label: "Begeleide oefening" },
        { value: "Independent Practice", label: "Zelfstandige oefening" },
        { value: "Review", label: "Herhaling / review" },
      ],
      defaultValue: "Guided Practice",
      group: "Instructional Coordinates",
    },
    {
      name: "sourceMaterials",
      label: "Bronmateriaal",
      kind: "textarea",
      required: true,
      rows: 3,
      help: "Beschrijf of plak de teksten, datasets, casussen of opgaven waarmee studenten werken.",
      group: "Instructional Coordinates",
    },
    {
      name: "preferredApproach",
      label: "Gewenste aanpak (optioneel)",
      kind: "text",
      placeholder: "bijv. studenten interviewen de auteur; Socratische dialoog",
      group: "Instructional Coordinates",
    },
  ],
  stages: [
    {
      id: "analyst",
      name: "1. Instructional Analyst",
      description:
        "Verzamelt de coördinaten en levert het Instructional Coordinates Document met CER-diagnose.",
      systemPromptId: COGNITIVE_ARCHITECT_ANALYST.id,
      output: {
        kind: "structured-sections",
        hint: "Instructional Coordinates Document (secties 1–7) met CER-diagnose en Priority Principles.",
      },
    },
    {
      id: "generator",
      name: "2. Student Prompt Generator",
      description: "Zet het Coordinates Document om in een inzetbare Student System Prompt.",
      systemPromptId: COGNITIVE_ARCHITECT_GENERATOR.id,
      consumes: [{ placeholder: "coordinatesDocument", fromStageId: "analyst" }],
      output: {
        kind: "markdown",
        hint: "Een kant-en-klare Student System Prompt (800–1500 woorden) + Instructor Notes.",
      },
    },
    {
      id: "validator",
      name: "3. Quality Validator (optioneel)",
      description: "Toetst de Student System Prompt aan de Cognitive Engagement Rubric.",
      systemPromptId: COGNITIVE_ARCHITECT_VALIDATOR.id,
      optional: true,
      consumes: [
        { placeholder: "coordinatesDocument", fromStageId: "analyst" },
        { placeholder: "studentPrompt", fromStageId: "generator" },
      ],
      output: {
        kind: "structured-sections",
        hint: "Quality Validation Report met principle-ratings, CEI% en status.",
      },
    },
    {
      id: "transcript-analyst",
      name: "4. Transcript Analyst (optioneel)",
      description:
        "Genereert een prompt om studenttranscripten te beoordelen op beheersing en leerattitudes.",
      systemPromptId: COGNITIVE_ARCHITECT_ANALYST_GEN.id,
      optional: true,
      consumes: [
        { placeholder: "coordinatesDocument", fromStageId: "analyst" },
        { placeholder: "studentPrompt", fromStageId: "generator" },
      ],
      output: {
        kind: "markdown",
        hint: "Een kant-en-klare Transcript Analyst Prompt.",
      },
    },
  ],
};
