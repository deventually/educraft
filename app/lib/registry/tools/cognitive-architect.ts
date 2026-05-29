import type { Tool } from "../types";
import {
  COGNITIVE_ARCHITECT_ANALYST,
  COGNITIVE_ARCHITECT_GENERATOR,
  COGNITIVE_ARCHITECT_VALIDATOR,
  COGNITIVE_ARCHITECT_ANALYST_GEN,
} from "~/lib/prompts/cognitive-architect.prompt";
import { attribution } from "~/lib/prompts/attribution";

const COORDS = { nl: "Instructional Coordinates", en: "Instructional Coordinates" };

export const cognitiveArchitect: Tool = {
  id: "cognitive-architect",
  slug: "cognitive-architect",
  name: {
    nl: "Cognitive Architect — AI-leeractiviteit ontwerpen",
    en: "Cognitive Architect — design an AI learning activity",
  },
  tagline: {
    nl: "Ontwerp in vier fasen een AI-ondersteunde leeractiviteit op basis van de leerwetenschap (Gagné/Rosenshine).",
    en: "Design an AI-supported learning activity in four stages, grounded in the science of learning (Gagné/Rosenshine).",
  },
  icon: "layers",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: {
      nl: "Science of Learning (zes principes) + Gagné & Rosenshine",
      en: "Science of Learning (six principles) + Gagné & Rosenshine",
    },
    summary: {
      nl: "Diagnosticeer een bestaande activiteit met de Cognitive Engagement Rubric en herontwerp deze tot een Socratische AI-dialoog die diep cognitief werk afdwingt.",
      en: "Diagnose an existing activity with the Cognitive Engagement Rubric and redesign it into a Socratic AI dialogue that forces deep cognitive work.",
    },
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
    evaluatedWith: {
      nl: "Model-agnostisch (Claude, GPT-4, of gelijkwaardig)",
      en: "Model-agnostic (Claude, GPT-4, or equivalent)",
    },
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
      label: { nl: "Niveau & vak", en: "Level & subject" },
      kind: "text",
      required: true,
      placeholder: { nl: "bijv. hbo jaar 2, Databases", en: "e.g. hbo year 2, Databases" },
      group: COORDS,
    },
    {
      name: "learningObjective",
      label: { nl: "Leerdoel", en: "Learning objective" },
      kind: "textarea",
      required: true,
      rows: 2,
      help: {
        nl: "Met actiewerkwoorden: wat moeten studenten kunnen?",
        en: "With action verbs: what should students be able to do?",
      },
      group: COORDS,
    },
    {
      name: "legacyActivity",
      label: { nl: "Huidige activiteit (te vervangen)", en: "Current activity (to replace)" },
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: {
        nl: "bijv. Lees hoofdstuk 4 en beantwoord de vragen",
        en: "e.g. Read chapter 4 and answer the questions",
      },
      group: COORDS,
    },
    {
      name: "instructionalPhase",
      label: { nl: "Instructiefase", en: "Instructional phase" },
      kind: "select",
      required: true,
      options: [
        {
          value: "Introduction",
          label: { nl: "Introductie (eerste kennismaking)", en: "Introduction (first encounter)" },
        },
        { value: "Guided Practice", label: { nl: "Begeleide oefening", en: "Guided practice" } },
        { value: "Independent Practice", label: { nl: "Zelfstandige oefening", en: "Independent practice" } },
        { value: "Review", label: { nl: "Herhaling / review", en: "Review" } },
      ],
      defaultValue: "Guided Practice",
      group: COORDS,
    },
    {
      name: "sourceMaterials",
      label: { nl: "Bronmateriaal", en: "Source materials" },
      kind: "textarea",
      required: true,
      rows: 3,
      help: {
        nl: "Beschrijf of plak de teksten, datasets, casussen of opgaven waarmee studenten werken.",
        en: "Describe or paste the texts, datasets, cases or exercises students work with.",
      },
      group: COORDS,
    },
    {
      name: "preferredApproach",
      label: { nl: "Gewenste aanpak (optioneel)", en: "Preferred approach (optional)" },
      kind: "text",
      placeholder: {
        nl: "bijv. studenten interviewen de auteur; Socratische dialoog",
        en: "e.g. students interview the author; Socratic dialogue",
      },
      group: COORDS,
    },
  ],
  stages: [
    {
      id: "analyst",
      name: { nl: "1. Instructional Analyst", en: "1. Instructional Analyst" },
      description: {
        nl: "Verzamelt de coördinaten en levert het Instructional Coordinates Document met CER-diagnose.",
        en: "Collects the coordinates and delivers the Instructional Coordinates Document with a CER diagnosis.",
      },
      systemPromptId: COGNITIVE_ARCHITECT_ANALYST.id,
      output: {
        kind: "structured-sections",
        hint: {
          nl: "Instructional Coordinates Document (secties 1–7) met CER-diagnose en Priority Principles.",
          en: "Instructional Coordinates Document (sections 1–7) with CER diagnosis and Priority Principles.",
        },
      },
    },
    {
      id: "generator",
      name: { nl: "2. Student Prompt Generator", en: "2. Student Prompt Generator" },
      description: {
        nl: "Zet het Coordinates Document om in een inzetbare Student System Prompt.",
        en: "Turns the Coordinates Document into a deployable Student System Prompt.",
      },
      systemPromptId: COGNITIVE_ARCHITECT_GENERATOR.id,
      consumes: [{ placeholder: "coordinatesDocument", fromStageId: "analyst" }],
      output: {
        kind: "markdown",
        hint: {
          nl: "Een kant-en-klare Student System Prompt (800–1500 woorden) + Instructor Notes.",
          en: "A ready-to-use Student System Prompt (800–1500 words) + Instructor Notes.",
        },
      },
    },
    {
      id: "validator",
      name: { nl: "3. Quality Validator (optioneel)", en: "3. Quality Validator (optional)" },
      description: {
        nl: "Toetst de Student System Prompt aan de Cognitive Engagement Rubric.",
        en: "Checks the Student System Prompt against the Cognitive Engagement Rubric.",
      },
      systemPromptId: COGNITIVE_ARCHITECT_VALIDATOR.id,
      optional: true,
      consumes: [
        { placeholder: "coordinatesDocument", fromStageId: "analyst" },
        { placeholder: "studentPrompt", fromStageId: "generator" },
      ],
      output: {
        kind: "structured-sections",
        hint: {
          nl: "Quality Validation Report met principle-ratings, CEI% en status.",
          en: "Quality Validation Report with principle ratings, CEI% and status.",
        },
      },
    },
    {
      id: "transcript-analyst",
      name: { nl: "4. Transcript Analyst (optioneel)", en: "4. Transcript Analyst (optional)" },
      description: {
        nl: "Genereert een prompt om studenttranscripten te beoordelen op beheersing en leerattitudes.",
        en: "Generates a prompt to assess student transcripts for mastery and learning attitudes.",
      },
      systemPromptId: COGNITIVE_ARCHITECT_ANALYST_GEN.id,
      optional: true,
      consumes: [
        { placeholder: "coordinatesDocument", fromStageId: "analyst" },
        { placeholder: "studentPrompt", fromStageId: "generator" },
      ],
      output: {
        kind: "markdown",
        hint: {
          nl: "Een kant-en-klare Transcript Analyst Prompt.",
          en: "A ready-to-use Transcript Analyst Prompt.",
        },
      },
    },
  ],
};
