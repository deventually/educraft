import type { Tool } from "../types";
import { MATH_GRADING_PROMPT } from "~/lib/prompts/math-grading.prompt";
import { attribution } from "~/lib/prompts/attribution";

const CONTEXT = { nl: "Context", en: "Context" };

export const mathGrading: Tool = {
  id: "math-grading",
  slug: "math-grading",
  name: {
    nl: "Wiskunde Grading — Handgeschreven antwoorden",
    en: "Math Grading — Handwritten Responses",
  },
  tagline: {
    nl: "Beoordeel handgeschreven wiskundige antwoorden met AI; geef gestructureerde feedback op basis van je beoordelingscriteria.",
    en: "Grade handwritten math responses with AI; deliver structured feedback based on your grading rubric.",
  },
  icon: "square-root",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: {
      nl: "Constructieve Feedback in Wiskundeonderwijs",
      en: "Constructive Feedback in Mathematics Education",
    },
    summary: {
      nl: "Effectieve feedback op wiskundig werk helpt studenten hun redenering te begrijpen en van fouten te leren. AI kan docenten helpen dit schaalbaar te doen.",
      en: "Effective feedback on math work helps students understand their reasoning and learn from errors. AI helps instructors scale this feedback.",
    },
    keyCitations: ["Hattie & Timperley (2007)", "Shute (2008)"],
  },
  attribution: attribution({
    chapterTitle: "Grading Handwritten Math Responses with Generative AI",
    authors: "David Wiley, ed.",
    sourcePages: "The Pedagogical Promptbook",
    evaluatedWith: {
      nl: "Claude Sonnet 4.6",
      en: "Claude Sonnet 4.6",
    },
    adapted: true,
  }),
  usesContextProfile: true,
  assistiveGrading: true,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-4-6",
  defaultMaxTokens: 4096,
  defaultTemperature: 0.7,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "handwrittenResponse",
      label: {
        nl: "Handgeschreven antwoord",
        en: "Handwritten response",
      },
      kind: "image",
      required: true,
      accept: "image/png,image/jpeg",
      placeholder: {
        nl: "Upload een foto van het handgeschreven wiskundige antwoord van de student",
        en: "Upload a photo of the student's handwritten math response",
      },
      group: CONTEXT,
    },
    {
      name: "learningContext",
      label: {
        nl: "Leeruitkomsten / Leerdoelen",
        en: "Learning outcomes / objectives",
      },
      kind: "textarea",
      required: true,
      rows: 3,
      placeholder: {
        nl: "bijv. Studenten kunnen lineaire vergelijkingen oplossen; studenten kunnen hun stappen rechtvaardigen",
        en: "e.g. Students can solve linear equations; students can justify their steps",
      },
      group: CONTEXT,
    },
    {
      name: "rubric",
      label: {
        nl: "Beoordelingscriteria / Rubric",
        en: "Grading rubric / criteria",
      },
      kind: "textarea",
      required: true,
      rows: 4,
      placeholder: {
        nl: "bijv. Juist antwoord (5pt), duidelijke stappen (3pt), notatie (2pt)",
        en: "e.g. Correct answer (5pt), clear steps (3pt), notation (2pt)",
      },
      group: CONTEXT,
    },
  ],
  stages: [
    {
      id: "grading",
      name: { nl: "Beoordeling", en: "Grading" },
      systemPromptId: MATH_GRADING_PROMPT.id,
      output: {
        kind: "structured-sections",
        sections: ["score", "strengths", "improvements", "feedback", "next-steps"],
        hint: {
          nl: "Totaalscore, sterke punten, verbeterpunten, gedetailleerde feedback, volgende stappen",
          en: "Total score, strengths, areas for improvement, detailed feedback, next steps",
        },
      },
    },
  ],
};
