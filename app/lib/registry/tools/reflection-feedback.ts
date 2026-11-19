import type { Tool } from "../types";
import { FEEDFORWARD_PROMPT_V2 } from "~/lib/prompts/feedforward@v2.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";
import { DEFAULT_MODEL } from "~/lib/ai/models";

const PIECE = { nl: "Het stuk", en: "The piece" };
const MODEL = { nl: "Beoordelingsmodel", en: "Assessment model" };

/**
 * Feedback op reflectie of POP — brief P39, 39.3. Feedforward on an anonymised reflection report
 * or personal development plan against an assessment model: what is already strong and the next
 * step, never a grade or level. A line with one is dropped in code (`output.guard`). There is no
 * scale field, so a model's scale never reaches the prompt. Nothing is kept
 * (`storesConversation: false`).
 */
export const reflectionFeedback: Tool = {
  id: "reflection-feedback",
  slug: "reflection-feedback",
  name: {
    nl: "Feedback op reflectie of POP",
    en: "Feedback on a reflection or PDP",
  },
  subtitle: {
    nl: "Feedforward voor SLB, zonder cijfer, niet bewaard",
    en: "Feedforward for study coaching, no grade, not kept",
  },
  tagline: {
    nl: "Leg een reflectieverslag of POP naast een beoordelingsmodel en krijg per criterium wat al sterk is en wat de volgende stap is. Geen cijfer of niveau; namen gaan er eerst uit en LimeOnIt bewaart de feedback niet.",
    en: "Lay a reflection report or development plan next to an assessment model and get, per criterion, what is already strong and what the next step is. No grade or level; names go first and LimeOnIt does not keep the feedback.",
  },
  icon: "file-pen-line",
  userType: "instructor",
  mode: "one-shot",
  // A student's reflection: never in a shared view, and never kept.
  handlesStudentWork: true,
  storesConversation: false,
  theory: {
    name: { nl: "Feedforward en reflecteren", en: "Feedforward and reflection" },
    summary: {
      nl: "Feedback helpt het meest als die zegt wat de volgende stap is (Hattie & Timperley, 2007). Bij een reflectie gaat het om de hele cirkel: wat er gebeurde, terugblikken, de kern zien, alternatieven bedenken en uitproberen (Korthagen & Kessels, 1999). Formatief: geen oordeel, de docent bespreekt het met de student.",
      en: "Feedback helps most when it says what the next step is (Hattie & Timperley, 2007). In a reflection the whole cycle counts: what happened, looking back, seeing the core, creating alternatives and trying them out (Korthagen & Kessels, 1999). Formative: no verdict, the teacher discusses it with the student.",
    },
    keyCitations: ["Hattie & Timperley (2007)", "Korthagen & Kessels (1999)"],
  },
  attribution: originalAttribution({
    source: {
      nl: "Origineel LimeOnIt-instrument (brief P39.3), naar de feedforward van het stagetraject (P38.3). Startmodel: de reflectiecirkel (ALACT) van Korthagen.",
      en: "Original LimeOnIt instrument (brief P39.3), after the feedforward of the internship track (P38.3). Starter model: Korthagen's reflection cycle (ALACT).",
    },
  }),
  usesContextProfile: true,
  // The criteria come from an assessment model, chosen by the kind of piece.
  assessmentModels: { byField: "documentType" },
  defaultOutputLanguage: "nl",
  defaultModel: DEFAULT_MODEL,
  defaultMaxTokens: 4096,
  defaultTemperature: 0.3,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "documentType",
      label: { nl: "Soort stuk", en: "Kind of piece" },
      kind: "select",
      required: true,
      defaultValue: "reflection",
      options: [
        { value: "reflection", label: { nl: "Reflectieverslag", en: "Reflection report" } },
        {
          value: "development-plan",
          label: { nl: "POP (persoonlijk ontwikkelplan)", en: "Personal development plan" },
        },
      ],
      group: PIECE,
    },
    {
      name: "document",
      redact: true,
      label: { nl: "Reflectie of POP van de student", en: "The student's reflection or plan" },
      kind: "document",
      required: true,
      rows: 12,
      placeholder: {
        nl: "Upload de PDF of Word, of plak hier de tekst.",
        en: "Upload the PDF or Word file, or paste the text here.",
      },
      help: {
        nl: "Geen namen of persoonlijke gegevens: je controleert in je browser welke namen er nog in staan voordat er iets weggaat. De feedback wordt niet bewaard; kopieer hem of download hem als Word.",
        en: "No names or personal details: you check in your browser which names are still in it before anything leaves. The feedback is not kept; copy it or download it as Word.",
      },
      group: PIECE,
    },
    {
      name: "assessmentFramework",
      label: { nl: "Criteria (beoordelingsmodel)", en: "Criteria (assessment model)" },
      kind: "textarea",
      required: true,
      rows: 10,
      prefillFromAssessmentModel: { source: "framework" },
      placeholder: {
        nl: "Kies hierboven een beoordelingsmodel, of plak hier de criteria van je opleiding.",
        en: "Pick an assessment model above, or paste your programme's criteria here.",
      },
      help: {
        nl: "De feedback volgt deze criteria. Een eventuele schaal of cijferregel wordt niet gebruikt: dit hulpje geeft nooit een cijfer of niveau.",
        en: "The feedback follows these criteria. Any scale or grading rule is not used: this tool never gives a grade or level.",
      },
      group: MODEL,
    },
  ],
  stages: [
    {
      id: "feedforward",
      name: { nl: "Feedforward", en: "Feedforward" },
      systemPromptId: FEEDFORWARD_PROMPT_V2.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Per criterium: wat al sterk is, met een citaat, en de volgende stap. Geen cijfer of niveau.",
          en: "Per criterion: what is already strong, with a quote, and the next step. No grade or level.",
        },
        guard: "no-judgement",
      },
    },
  ],
};
