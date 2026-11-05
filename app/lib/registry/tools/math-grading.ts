import type { Tool } from "../types";
import { MATH_GRADING_PROMPT } from "~/lib/prompts/math-grading.prompt";
import { attribution } from "~/lib/prompts/attribution";

const CONTEXT = { nl: "Context", en: "Context" };

export const mathGrading: Tool = {
  id: "math-grading",
  slug: "math-grading",
  name: { nl: "Wiskundeantwoorden nakijken", en: "Grade handwritten math answers" },
  /** Book/technique name shown small under the task-first name. */
  subtitle: {
    nl: "Wiskunde Grading (handgeschreven antwoorden)",
    en: "Math Grading (handwritten responses)",
  },
  tagline: {
    nl: "Beoordeel handgeschreven wiskundige antwoorden met AI; geef gestructureerde feedback op basis van je beoordelingscriteria.",
    en: "Grade handwritten math responses with AI; deliver structured feedback based on your grading rubric.",
  },
  icon: "square-root",
  userType: "instructor",
  // Processes student work: never in a shared view (P28.4).
  handlesStudentWork: true,
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
    chapterTitle:
      "Leveraging LLMs for Grading and Feedback on Handwritten Math Assessment Responses",
    authors: "Alberto Gandolfi, Jonas Saman, & Eleni Tesfaye",
    sourcePages: "pp. 143–145",
    evaluatedWith: {
      nl: "GPT-5.1 Pro, GPT-5.2 en Gemini 3 Pro",
      en: "GPT-5.1 Pro, GPT-5.2 and Gemini 3 Pro",
    },
    adapted: true,
    adaptation: {
      nl: "In het boek vraagt de assistent eerst om de rubric, de syllabus en de gescande toetsen, en beoordeelt hij daarna een hele toets per vraag, als eerste ronde voor de docent of assistent. Wij beoordelen één antwoord op een foto in één keer, met de rubric en de leercontext van de docent, als concept met feedback, in het Nederlands.",
      en: "In the book the assistant first asks for the rubric, the syllabus and the scanned tests, then grades a whole test question by question, as a first pass for the teacher or TA. We assess one answer from a photo in one go, with the teacher's rubric and learning context, as a draft with feedback, in Dutch.",
    },
  }),
  usesContextProfile: true,
  assistiveGrading: true,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-5-5",
  defaultMaxTokens: 4096, // Scored feedback fits comfortably; verify no truncation via evals.
  // Grading tool: use the grading-mode default (0.3) for consistent, reproducible
  // scores — a grader at 0.7 introduces avoidable variance in the very numbers a
  // teacher relies on. (Phase 3 §3.6: was 0.7; aligned to the grading default,
  // matching stage-assessment. Confirm against evals.)
  defaultTemperature: 0.3,
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
