import type { Tool } from "../types";
import { DEFENSE_REVIEW_PROMPT } from "~/lib/prompts/defense-review@v1.prompt";
import { attribution } from "~/lib/prompts/attribution";
import { WORK_TYPE_OPTIONS } from "./defend-your-work";
import { DEFAULT_MODEL } from "~/lib/ai/models";

const CONVERSATION = { nl: "Het gesprek", en: "The conversation" };
const WORK = { nl: "Het werk", en: "The work" };

/**
 * Een mondelinge verdediging nakijken — brief P31, 31.2. After Appendix F.4 of "From Oracle to
 * Socratic Partner": the teacher pastes the transcript of a student's oral defense (31.1) and gets
 * a draft analysis. Student work: anonymising the transcript is mandatory (`redact`,
 * BESLUIT-2026-11-07-2), the teacher decides (`assistiveGrading`) and it is never shared.
 */
export const defenseReview: Tool = {
  id: "defense-review",
  slug: "defense-review",
  name: { nl: "Een mondelinge verdediging nakijken", en: "Review an oral defense" },
  subtitle: {
    nl: "Transcriptanalyse (Lab Oral Defense)",
    en: "Transcript analysis (Lab Oral Defense)",
  },
  tagline: {
    nl: "Plak het gesprek van een mondelinge verdediging en krijg een concept: het niveau van begrip, opvallende leerhoudingen, feedback voor de student en notities voor jou. Eerst anonimiseren; jij beslist.",
    en: "Paste the conversation of an oral defense and get a draft: the level of understanding, notable learner attributes, feedback for the student and notes for you. Anonymised first; you decide.",
  },
  icon: "clipboard-check",
  userType: "instructor",
  // Processes student work: never in a shared view (P28.4).
  handlesStudentWork: true,
  mode: "one-shot",
  theory: {
    name: {
      nl: "Begrip toetsen in gesprek en leerhoudingen",
      en: "Assessing understanding in conversation, and learner attributes",
    },
    summary: {
      nl: "In een verdediging laat een student zien of het begrip er is: kan de student de eigen keuzes uitleggen, de eigen gegevens duiden en de conclusie verdedigen? De analyse kijkt alleen naar wat de student zelf zei, kiest een van vier niveaus en noemt leerhoudingen alleen bij duidelijk bewijs. Het is een concept; de docent beslist.",
      en: "In a defense a student shows whether the understanding is there: can they explain their own choices, interpret their own data and defend the conclusion? The analysis looks only at what the student said, chooses one of four levels and names learner attributes only with clear evidence. It is a draft; the teacher decides.",
    },
    keyCitations: ["Karpicke & Roediger (2008)", "Hattie & Timperley (2007)"],
  },
  attribution: attribution({
    chapterTitle:
      "From Oracle to Socratic Partner: Redesigning Instruction with AI Through the Science of Learning",
    authors: "Andy Van Schaack & Roman Sarlo",
    sourcePages: "Appendix F.4, pp. 352–353",
    evaluatedWith: {
      nl: "Model-agnostisch (Claude, GPT-4, of gelijkwaardig)",
      en: "Model-agnostic (Claude, GPT-4, or equivalent)",
    },
    adapted: true,
    adaptation: {
      nl: "In het boek analyseert de prompt de verdediging van een titratiepracticum scheikunde, met criteria voor dat practicum. Wij maken de vier niveaus algemeen voor eigen werk (verslag, stage, project, beroepsproduct, practicum), of de docent geeft eigen criteria. Het transcript wordt eerst in de browser geanonimiseerd: namen, het studentnummer, het bedrijf en begeleiders worden codes die de docent controleert. Wat de AI in het gesprek zei, telt niet als begrip van de student. De opbouw van de uitvoer en de zes leerhoudingen blijven; het is een concept zonder cijfer, de docent beslist. In het Nederlands.",
      en: "In the book the prompt analyses the defense of a chemistry titration lab, with criteria for that lab. We make the four levels general for own work (report, internship, project, professional product, lab), or the teacher gives their own criteria. The transcript is anonymised in the browser first: names, the student number, the company and supervisors become codes the teacher checks. What the AI said in the conversation does not count as the student's understanding. The output structure and the six learner attributes stay; it is a draft without a grade, and the teacher decides. In Dutch.",
    },
  }),
  usesContextProfile: true,
  assistiveGrading: true,
  defaultOutputLanguage: "nl",
  defaultModel: DEFAULT_MODEL,
  defaultMaxTokens: 4096,
  defaultTemperature: 0.3, // Grading tool: grading-mode default.
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "transcript",
      // BESLUIT-2026-11-07-2: anonymising is mandatory; the browser step runs before sending.
      redact: true,
      label: { nl: "Het gesprek (transcript)", en: "The conversation (transcript)" },
      kind: "textarea",
      required: true,
      rows: 14,
      placeholder: {
        nl: "[AI] Wat was het doel van je werk?\n[Student] …",
        en: "[AI] What was the purpose of your work?\n[Student] …",
      },
      help: {
        nl: "Plak het hele gesprek dat de student inleverde. Zet bij voorkeur [AI] voor de berichten van de deskundige en [Student] voor die van de student. Voor het versturen vervang je namen, het studentnummer, het bedrijf en begeleiders door codes; je controleert ze zelf.",
        en: "Paste the whole conversation the student handed in. Preferably put [AI] before the expert's messages and [Student] before the student's. Before sending, you replace names, the student number, the company and supervisors with codes; you check them yourself.",
      },
      group: CONVERSATION,
    },
    {
      name: "workType",
      label: { nl: "Soort werk", en: "Kind of work" },
      kind: "select",
      required: true,
      defaultValue: "report",
      options: WORK_TYPE_OPTIONS,
      group: WORK,
    },
    {
      name: "subject",
      // From the teaching context when one is selected; stays editable.
      prefillFromProfile: { source: ["courseName", "programme"] },
      label: { nl: "Vak of opleiding", en: "Subject or programme" },
      kind: "text",
      required: true,
      placeholder: { nl: "bijv. HBO-ICT, jaar 2", en: "e.g. Software engineering, year 2" },
      group: WORK,
    },
    {
      name: "learningObjective",
      prefillFromCourse: { source: "learningOutcomes" },
      label: { nl: "Leerdoel van de verdediging", en: "Learning objective of the defense" },
      kind: "textarea",
      required: true,
      rows: 3,
      placeholder: {
        nl: "bijv. De student legt de ontwerpkeuzes uit, interpreteert de eigen gegevens en verdedigt de conclusie met bewijs.",
        en: "e.g. The student explains the design choices, interprets their own data and defends the conclusion with evidence.",
      },
      group: WORK,
    },
    {
      name: "masteryCriteria",
      label: {
        nl: "Eigen criteria voor de vier niveaus (optioneel)",
        en: "Your own criteria for the four levels (optional)",
      },
      kind: "textarea",
      rows: 4,
      placeholder: {
        nl: "bijv. Op niveau: de student verklaart de keuze voor interviews met de onderzoeksvraag en noemt twee beperkingen.",
        en: "e.g. Proficient: the student explains the choice for interviews from the research question and names two limitations.",
      },
      help: {
        nl: "Leeg laten mag: dan gelden algemene criteria voor uitstekend, op niveau, in ontwikkeling en beginnend.",
        en: "You may leave it empty: general criteria for exemplary, proficient, developing and beginning then apply.",
      },
      group: WORK,
    },
  ],
  stages: [
    {
      id: "review",
      name: { nl: "Concept-analyse", en: "Draft analysis" },
      systemPromptId: DEFENSE_REVIEW_PROMPT.id,
      output: {
        kind: "structured-sections",
        hint: {
          nl: "Inhoudelijk begrip (niveau), leerhoudingen, feedback voor de student, notities voor de docent",
          en: "Content mastery (rating), learner attributes, feedback for the student, notes for the teacher",
        },
      },
    },
  ],
};
