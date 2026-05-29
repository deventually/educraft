import type { Tool } from "../types";
import { MENTORAI_PROMPT } from "~/lib/prompts/mentorai.prompt";
import { attribution } from "~/lib/prompts/attribution";

const CONTEXT = { nl: "Context", en: "Context" };

export const mentorai: Tool = {
  id: "mentorai",
  slug: "mentorai",
  name: { nl: "MentorAI — Cognitieve Leermeesterschap", en: "MentorAI — Cognitive Apprenticeship" },
  tagline: {
    nl: "Een persoonlijke leermeester die je helpt door vragen te stellen en je denken te geleiden.",
    en: "A personal mentor who helps you by asking questions and guiding your thinking.",
  },
  icon: "brain",
  userType: "student",
  mode: "chat",
  theory: {
    name: { nl: "Cognitief Leermeesterschap", en: "Cognitive Apprenticeship" },
    summary: {
      nl: "Leer door modeling, coaching en scaffolding: een expert denkt hardop en geleidt voorzichtig je denken.",
      en: "Learn through modeling, coaching, and scaffolding: an expert thinks aloud and gently guides your thinking.",
    },
    keyCitations: ["Collins, Brown & Newman (1989)"],
  },
  attribution: attribution({
    chapterTitle: "From Model to Mentor: Cognitive Apprenticeship",
    authors: "Author Name",
    sourcePages: "pp. 1–20",
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
      name: "discipline",
      label: { nl: "Vakgebied / Discipline", en: "Subject / Discipline" },
      kind: "text",
      required: true,
      placeholder: { nl: "bijv. Programmeertalen", en: "e.g. Programming languages" },
      group: CONTEXT,
    },
    {
      name: "level",
      label: { nl: "Niveau", en: "Level" },
      kind: "select",
      required: true,
      options: [
        { value: "foundation", label: { nl: "Fundamenteel", en: "Foundation" } },
        { value: "intermediate", label: { nl: "Intermediate", en: "Intermediate" } },
        { value: "advanced", label: { nl: "Gevorderd", en: "Advanced" } },
      ],
      defaultValue: "foundation",
      group: CONTEXT,
    },
    {
      name: "studentContext",
      label: { nl: "Jouw achtergrond / niveau", en: "Your background / level" },
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: {
        nl: "bijv. Beginnende programmeur, eerstejaars student",
        en: "e.g. Beginner programmer, first-year student",
      },
      group: CONTEXT,
    },
    {
      name: "learningGoal",
      label: { nl: "Wat wil je vandaag leren?", en: "What do you want to learn today?" },
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: {
        nl: "bijv. Hoe werkt Object-Oriented Programming?",
        en: "e.g. How does Object-Oriented Programming work?",
      },
      group: CONTEXT,
    },
  ],
  stages: [
    {
      id: "mentor",
      name: { nl: "MentorAI", en: "MentorAI" },
      description: {
        nl: "Een one-on-one leermeestersessie",
        en: "A one-on-one mentoring session",
      },
      systemPromptId: MENTORAI_PROMPT.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Een gepersonaliseerde mentoringrespons gebaseerd op jouw leergebied en doel.",
          en: "A personalized mentoring response based on your discipline and learning goal.",
        },
      },
    },
  ],
  chat: {
    greeting: {
      nl: "Welkom! Ik ben je leermeester. Ik zal je helpen door vragen te stellen die je denken prikkelen. Wat is je eerste stap?",
      en: "Welcome! I'm your mentor. I'll help you by asking questions that spark your thinking. What's your first step?",
    },
    starters: [
      {
        nl: "Ik wil beginnen met de basisconcepten",
        en: "I want to start with the basics",
      },
      {
        nl: "Ik zit vast bij iets specifieks",
        en: "I'm stuck on something specific",
      },
      {
        nl: "Ik wil dieper ingaan op een onderwerp",
        en: "I want to dive deeper into a topic",
      },
    ],
    allowStop: true,
    allowRegenerate: true,
  },
};
