import type { Tool } from "../types";
import { GUIDED_REFLECTION_PROMPT } from "~/lib/prompts/guided-reflection.prompt";
import { attribution } from "~/lib/prompts/attribution";

const NIVEAU = [
  {
    value: "foundation year (year 1)",
    label: { nl: "Propedeuse (jaar 1)", en: "Foundation year (year 1)" },
  },
  {
    value: "main phase (years 2-3)",
    label: { nl: "Hoofdfase (jaar 2–3)", en: "Main phase (years 2–3)" },
  },
  {
    value: "graduation phase (year 4)",
    label: { nl: "Afstudeerfase (jaar 4)", en: "Graduation phase (year 4)" },
  },
];

const MODALITEIT = [
  { value: "in-person", label: { nl: "Contactonderwijs", en: "In-person" } },
  { value: "online", label: { nl: "Online", en: "Online" } },
  { value: "hybrid", label: { nl: "Hybride", en: "Hybrid" } },
  { value: "flipped classroom", label: { nl: "Flipped classroom", en: "Flipped classroom" } },
];

const BASIS = { nl: "Basis", en: "Basics" };
const REFLECTIE = { nl: "Backward Design-reflectie", en: "Backward Design reflection" };
const MATERIALEN = { nl: "Materialen", en: "Materials" };

export const guidedReflection: Tool = {
  id: "guided-reflection-backward-design",
  slug: "guided-reflection",
  name: { nl: "Begeleide reflectie & Backward Design", en: "Guided Reflection & Backward Design" },
  tagline: {
    nl: "Ontwerp een les of cursus vanuit de gewenste leeruitkomsten, volgens Backward Design.",
    en: "Design a lesson or course backward from the desired learning outcomes, using Backward Design.",
  },
  icon: "compass",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: "Backward Design (Understanding by Design)",
    summary: {
      nl: "Begin bij de gewenste resultaten, bepaal aanvaardbaar bewijs en plan dan pas de leeractiviteiten.",
      en: "Start from the desired results, determine acceptable evidence, and only then plan the learning activities.",
    },
    keyCitations: ["Wiggins & McTighe (2005, 2012)", "Biggs (1996)"],
  },
  attribution: attribution({
    chapterTitle: "Guided Reflection and Backward Design with Generative AI",
    authors: "Aileen Benedict & Matt Thayer",
    sourcePages: "pp. 79–80",
    evaluatedWith: "ChatGPT-5",
    adapted: true,
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-4-6",
  defaultMaxTokens: 6144,
  defaultTemperature: 0.4,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "onderwerp",
      label: { nl: "Onderwerp van de les/cursus", en: "Lesson/course topic" },
      kind: "text",
      required: true,
      placeholder: { nl: "bijv. RESTful API-ontwerp", en: "e.g. RESTful API design" },
      group: BASIS,
    },
    {
      name: "niveau",
      label: { nl: "Niveau", en: "Level" },
      kind: "select",
      required: true,
      options: NIVEAU,
      defaultValue: "main phase (years 2-3)",
      // Derived from the teaching context's study year when one is selected.
      prefillFromProfile: {
        source: "studyYear",
        map: {
          "1": "foundation year (year 1)",
          "2": "main phase (years 2-3)",
          "3": "main phase (years 2-3)",
          "4": "graduation phase (year 4)",
        },
      },
      group: BASIS,
    },
    {
      name: "scope",
      label: { nl: "Reikwijdte", en: "Scope" },
      kind: "select",
      required: true,
      options: [
        { value: "single lesson", label: { nl: "Eén les", en: "A single lesson" } },
        { value: "lesson series", label: { nl: "Lessenreeks", en: "A series of lessons" } },
        { value: "full course", label: { nl: "Volledige cursus", en: "A full course" } },
      ],
      defaultValue: "single lesson",
      group: BASIS,
    },
    {
      name: "duur",
      label: { nl: "Duur (minuten)", en: "Duration (minutes)" },
      kind: "number",
      min: 30,
      max: 480,
      step: 15,
      defaultValue: 90,
      group: BASIS,
    },
    {
      name: "modaliteit",
      label: { nl: "Werkvorm / modaliteit", en: "Format / modality" },
      kind: "select",
      options: MODALITEIT,
      defaultValue: "in-person",
      group: BASIS,
    },
    {
      name: "voorkennis",
      label: { nl: "Voorkennis van studenten", en: "Students' prior knowledge" },
      kind: "textarea",
      rows: 2,
      placeholder: {
        nl: "Wat hebben studenten al gedaan/geleerd vóór deze les?",
        en: "What have students already done/learned before this lesson?",
      },
      group: BASIS,
    },
    {
      name: "bigIdea",
      label: { nl: "1. Big idea / kernbegrip", en: "1. Big idea / core concept" },
      kind: "textarea",
      required: true,
      rows: 2,
      help: {
        nl: "Welk centraal inzicht moeten studenten echt begrijpen?",
        en: "Which central insight should students truly understand?",
      },
      group: REFLECTIE,
    },
    {
      name: "essentieleVraag",
      label: { nl: "2. Essentiële vraag/vragen", en: "2. Essential question(s)" },
      kind: "textarea",
      rows: 2,
      help: {
        nl: "Welke vraag stuurt het onderzoek/de les?",
        en: "Which question drives the inquiry/lesson?",
      },
      group: REFLECTIE,
    },
    {
      name: "leeruitkomsten",
      label: {
        nl: "3. Specifieke, meetbare leeruitkomsten",
        en: "3. Specific, measurable learning outcomes",
      },
      kind: "textarea",
      required: true,
      rows: 4,
      help: {
        nl: "Bloom-aligned. Eén leeruitkomst per regel.",
        en: "Bloom-aligned. One outcome per line.",
      },
      group: REFLECTIE,
    },
    {
      name: "bewijs",
      label: { nl: "4. Bewijs van leren", en: "4. Evidence of learning" },
      kind: "textarea",
      rows: 3,
      help: {
        nl: "Hoe toon je aan dat studenten het beheersen? (formatief/summatief)",
        en: "How do you show students have mastered it? (formative/summative)",
      },
      group: REFLECTIE,
    },
    {
      name: "relevantie",
      label: {
        nl: "5. Relevantie / toepassing in de praktijk",
        en: "5. Real-world relevance / application",
      },
      kind: "textarea",
      rows: 2,
      help: {
        nl: "Waarom doet dit ertoe in het werkveld?",
        en: "Why does this matter in professional practice?",
      },
      group: REFLECTIE,
    },
    {
      name: "artefacten",
      label: { nl: "Te produceren materialen", en: "Materials to produce" },
      kind: "multiselect",
      required: true,
      options: [
        { value: "a lecture outline", label: { nl: "College-outline", en: "Lecture outline" } },
        { value: "slides", label: { nl: "Slides", en: "Slides" } },
        { value: "an activity", label: { nl: "Werkvorm / activiteit", en: "Activity" } },
        { value: "a rubric", label: { nl: "Rubric", en: "Rubric" } },
        { value: "a quiz/test", label: { nl: "Quiz / toets", en: "Quiz / test" } },
      ],
      defaultValue: ["a lecture outline", "an activity"],
      group: MATERIALEN,
    },
  ],
  stages: [
    {
      id: "design",
      name: { nl: "Ontwerp", en: "Design" },
      systemPromptId: GUIDED_REFLECTION_PROMPT.id,
      output: {
        kind: "structured-sections",
        hint: {
          nl: "Levert een Alignment Summary, de gevraagde materialen en een modelleersuggestie op.",
          en: "Produces an Alignment Summary, the requested materials, and a modelling suggestion.",
        },
        sections: ["Alignment Summary", "Materialen", "Modelleersuggestie"],
      },
    },
  ],
};
