import type { Tool } from "../types";
import { DIALOGIC_ENCOUNTERS_PROMPT } from "~/lib/prompts/dialogic-encounters.prompt";
import { attribution } from "~/lib/prompts/attribution";

const CONTEXT = { nl: "Context", en: "Context" };

export const dialogicEncounters: Tool = {
  id: "dialogic-encounters",
  slug: "dialogic-encounters",
  name: {
    nl: "Dialogische Ontmoetingen — Rol-Spel met Theoretici",
    en: "Dialogic Encounters — Role-Play with Theorists",
  },
  tagline: {
    nl: "Interview een leertheoricus en verken hoe hun perspectief onderwijs vormt.",
    en: "Interview a learning theorist and explore how their perspective shapes teaching.",
  },
  icon: "users-round",
  userType: "student",
  mode: "chat",
  theory: {
    name: {
      nl: "Dialogische Leertheorie",
      en: "Dialogic Learning Theory",
    },
    summary: {
      nl: "Leer leertheorieën door role-play dialoog met de theoretici zelf. Ervaar hoe theoretische aannames onderwijsbeslissingen vormgeven.",
      en: "Learn theories through role-play dialogue with theorists. Experience how theoretical assumptions shape instructional decisions.",
    },
    keyCitations: ["Mercer & Howe (2012)", "Gee (2007)", "Kuhn (2010)"],
  },
  attribution: attribution({
    chapterTitle:
      "Dialogic Encounters with Learning Theorists: Using AI Role-Play to Teach Pre-Service Teachers",
    authors: "Rebecca Clark-Stallkamp, and others",
    sourcePages: "pp. 84–106",
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
      name: "theorist",
      label: {
        nl: "Welke theoreticus wil je ontmoeten?",
        en: "Which theorist would you like to meet?",
      },
      kind: "select",
      required: true,
      options: [
        {
          value: "Jean Piaget",
          label: { nl: "Jean Piaget (Constructivisme)", en: "Jean Piaget (Constructivism)" },
        },
        {
          value: "Jerome Bruner",
          label: { nl: "Jerome Bruner (Constructivisme)", en: "Jerome Bruner (Constructivism)" },
        },
        {
          value: "Lev Vygotsky",
          label: { nl: "Lev Vygotsky (Constructivisme)", en: "Lev Vygotsky (Constructivism)" },
        },
        {
          value: "John Dewey",
          label: { nl: "John Dewey (Constructivisme)", en: "John Dewey (Constructivism)" },
        },
        {
          value: "Seymour Papert",
          label: {
            nl: "Seymour Papert (Constructionisme)",
            en: "Seymour Papert (Constructionism)",
          },
        },
        {
          value: "Albert Bandura",
          label: { nl: "Albert Bandura (Sociaal leren)", en: "Albert Bandura (Social Learning)" },
        },
        {
          value: "B.F. Skinner",
          label: { nl: "B.F. Skinner (Behaviorisme)", en: "B.F. Skinner (Behaviorism)" },
        },
        {
          value: "Ivan Pavlov",
          label: { nl: "Ivan Pavlov (Behaviorisme)", en: "Ivan Pavlov (Behaviorism)" },
        },
        {
          value: "Robert Gagné",
          label: { nl: "Robert Gagné (Cognitivisme)", en: "Robert Gagné (Cognitivism)" },
        },
        {
          value: "David Ausubel",
          label: { nl: "David Ausubel (Cognitivisme)", en: "David Ausubel (Cognitivism)" },
        },
        {
          value: "John Sweller",
          label: {
            nl: "John Sweller (Cognitieve belasting)",
            en: "John Sweller (Cognitive Load)",
          },
        },
        {
          value: "Jeroen van Merriënboer",
          label: {
            nl: "Jeroen van Merriënboer (4C/ID)",
            en: "Jeroen van Merriënboer (4C/ID)",
          },
        },
        {
          value: "Paul A. Kirschner",
          label: {
            nl: "Paul A. Kirschner (Directe instructie)",
            en: "Paul A. Kirschner (Direct Instruction)",
          },
        },
        {
          value: "David Kolb",
          label: { nl: "David Kolb (Ervaringsleren)", en: "David Kolb (Experiential Learning)" },
        },
        {
          value: "Carl Rogers",
          label: { nl: "Carl Rogers (Humanisme)", en: "Carl Rogers (Humanism)" },
        },
        {
          value: "Malcolm Knowles",
          label: { nl: "Malcolm Knowles (Andragogiek)", en: "Malcolm Knowles (Andragogy)" },
        },
      ],
      group: CONTEXT,
    },
  ],
  stages: [
    {
      id: "encounter",
      name: { nl: "Dialogische Ontmoeting", en: "Dialogic Encounter" },
      description: {
        nl: "Rol-spel dialoog met een leertheoricus.",
        en: "Role-play dialogue with a learning theorist.",
      },
      systemPromptId: DIALOGIC_ENCOUNTERS_PROMPT.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Een dialoog waarin je de leertheorie verkendt.",
          en: "A dialogue in which you explore the learning theory.",
        },
      },
    },
  ],
  chat: {
    greeting: {
      nl: "Welkom bij Dialogische Ontmoetingen! Je bent op het punt om een van de grote leertheorici te ontmoeten. Stel jezelf voor en stel je eerste vraag.",
      en: "Welcome to Dialogic Encounters! You are about to meet one of the great learning theorists. Introduce yourself and ask your first question.",
    },
    starters: [
      {
        nl: "Wat is het kernidee van jouw theorie?",
        en: "What is the core idea of your theory?",
      },
      {
        nl: "Hoe zouden docenten jouw ideeën in het klaslokaal gebruiken?",
        en: "How would teachers use your ideas in the classroom?",
      },
      {
        nl: "Wat zijn de sterke punten van je theorie?",
        en: "What are the strengths of your theory?",
      },
    ],
    allowStop: true,
    allowRegenerate: true,
  },
};
