import type { Tool } from "../types";
import { CONTEXTUALIZATION_PROMPT } from "~/lib/prompts/contextualization.prompt";
import { attribution } from "~/lib/prompts/attribution";

const CONTEXT = { nl: "Context", en: "Context" };

export const contextualization: Tool = {
  id: "contextualization",
  slug: "contextualization",
  name: {
    nl: "Contextualization — Pedagogische intentie zichtbaar maken",
    en: "Contextualization — Making Pedagogical Intent Visible",
  },
  tagline: {
    nl: "Maak de onderliggende onderwijsfilosofie en theorie in je cursus explicieter door alignment te analyseren en gaps op te sporen.",
    en: "Make the underlying teaching philosophy and theory in your course more explicit by analyzing alignment and spotting gaps.",
  },
  icon: "lightbulb",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: {
      nl: "Constructivisme & Curriculumulignment",
      en: "Constructivism & Curriculum Alignment",
    },
    summary: {
      nl: "Effectief onderwijs ontstaat wanneer leeruitkomsten, werkvormen en beoordeling goed op elkaar aansluiten en wanneer studenten begrijpen waarom activiteiten ontworpen zijn zoals zij zijn.",
      en: "Effective teaching emerges when learning outcomes, teaching activities, and assessment align well and when students understand why activities are designed the way they are.",
    },
    keyCitations: ["Biggs (1996, 2003)", "Wiggins & McTighe (2005)"],
  },
  attribution: attribution({
    chapterTitle:
      "Making Pedagogical Intent Visible: AI-Supported Contextualization in Higher Education Course Design",
    authors: "David Wiley, ed.",
    sourcePages: "The Pedagogical Promptbook",
    evaluatedWith: {
      nl: "Claude, ChatGPT, Gemini",
      en: "Claude, ChatGPT, Gemini",
    },
    adapted: true,
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-4-6",
  defaultTemperature: 0.5,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "courseOutline",
      label: {
        nl: "Cursusopzet / syllabus",
        en: "Course outline / syllabus",
      },
      kind: "textarea",
      required: true,
      rows: 5,
      placeholder: {
        nl: "Beschrijf de structuur, weken/modules, aandachtspunten in je cursus.",
        en: "Describe the structure, weeks/modules, and focus areas of your course.",
      },
      group: CONTEXT,
    },
    {
      name: "learningObjectives",
      label: {
        nl: "Beoogde leeruitkomsten",
        en: "Intended learning outcomes",
      },
      kind: "textarea",
      required: true,
      rows: 4,
      placeholder: {
        nl: "Wat kunnen studenten aan het einde kunnen/begrijpen/doen? (Eén per regel)",
        en: "What can students do/understand/know by the end? (One per line)",
      },
      group: CONTEXT,
    },
    {
      name: "pedagogicalApproach",
      label: {
        nl: "Jouw pedagogische benadering",
        en: "Your pedagogical approach",
      },
      kind: "textarea",
      required: true,
      rows: 4,
      placeholder: {
        nl: "Welke onderwijsfilosofie, leertheorieën en werkvormen (college, groepwerk, etc.) gebruik je en waarom?",
        en: "Which teaching philosophy, learning theories, and methods (lectures, group work, etc.) do you use and why?",
      },
      group: CONTEXT,
    },
  ],
  stages: [
    {
      id: "analyze",
      name: { nl: "Analyse", en: "Analysis" },
      systemPromptId: CONTEXTUALIZATION_PROMPT.id,
      output: {
        kind: "structured-sections",
        hint: {
          nl: "Impliciet filosofie, alignment-check, studentenperspectief, aanbevelingen",
          en: "Implicit philosophy, alignment check, student perspective, recommendations",
        },
      },
    },
  ],
};
