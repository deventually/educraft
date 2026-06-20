import type { Tool } from "../types";
import { AUTHENTIC_ASSESSMENT_PROMPT } from "~/lib/prompts/authentic-assessment.prompt";
import { attribution } from "~/lib/prompts/attribution";

const MODALITEIT = [
  { value: "in-person", label: { nl: "Contactonderwijs", en: "In-person" } },
  { value: "online", label: { nl: "Online", en: "Online" } },
  { value: "hybrid", label: { nl: "Hybride", en: "Hybrid" } },
];

const CURSUSCONTEXT = { nl: "Cursuscontext", en: "Course context" };
const BACKWARD_DESIGN = { nl: "Backward Design", en: "Backward Design" };

export const authenticAssessment: Tool = {
  id: "authentic-assessment-backward-design",
  slug: "authentieke-toetsing",
  name: {
    nl: "Authentieke toetsing (Backward Design)",
    en: "Authentic Assessment (Backward Design)",
  },
  tagline: {
    nl: "Ontwerp een realistische, praktijkgerichte toets met analytische rubric en bruikbare feedback.",
    en: "Design a realistic, practice-oriented assessment with an analytic rubric and usable feedback.",
  },
  icon: "clipboard-check",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: "Backward Design + Authentic Assessment + VALUE rubrics",
    summary: {
      nl: "Vertrek vanuit leeruitkomsten en aanvaardbaar bewijs naar een authentieke beroepstaak met afgestemde, schaalbare beoordeling.",
      en: "Move from learning outcomes and acceptable evidence to an authentic professional task with aligned, scalable assessment.",
    },
    keyCitations: ["Wiggins & McTighe (2005)", "AAC&U VALUE Rubrics"],
  },
  attribution: attribution({
    chapterTitle:
      "Backward Design: Using Structured Frameworks to Develop Authentic Assessment Opportunities",
    authors: "Rebecca McNulty, Wendy Howard & Roslyn Miller",
    sourcePages: "pp. 162–166",
    evaluatedWith: "Microsoft Copilot (Enterprise)",
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
      name: "discipline",
      label: { nl: "Vakgebied / discipline", en: "Subject area / discipline" },
      kind: "text",
      required: true,
      placeholder: { nl: "bijv. Software Engineering", en: "e.g. Software Engineering" },
      group: CURSUSCONTEXT,
    },
    {
      name: "niveau",
      label: { nl: "Niveau", en: "Level" },
      kind: "select",
      required: true,
      options: [
        { value: "introductory", label: { nl: "Introductie", en: "Introductory" } },
        { value: "advanced", label: { nl: "Gevorderd", en: "Advanced" } },
        { value: "graduation phase", label: { nl: "Afstudeerfase", en: "Graduation phase" } },
      ],
      defaultValue: "advanced",
      // Derived from the teaching context's study year when one is selected.
      prefillFromProfile: {
        source: "studyYear",
        map: { "1": "introductory", "2": "advanced", "3": "advanced", "4": "graduation phase" },
      },
      group: CURSUSCONTEXT,
    },
    {
      name: "modaliteit",
      label: { nl: "Modaliteit", en: "Modality" },
      kind: "select",
      options: MODALITEIT,
      defaultValue: "in-person",
      group: CURSUSCONTEXT,
    },
    {
      name: "groepsgrootte",
      label: { nl: "Groepsgrootte", en: "Class size" },
      kind: "number",
      min: 1,
      max: 1000,
      defaultValue: 30,
      group: CURSUSCONTEXT,
    },
    {
      name: "randvoorwaarden",
      label: { nl: "Randvoorwaarden", en: "Constraints" },
      kind: "textarea",
      rows: 2,
      placeholder: {
        nl: "Nakijkcapaciteit, accreditatie, verplichte tools, planning…",
        en: "Grading capacity, accreditation, required tools, timeline…",
      },
      group: CURSUSCONTEXT,
    },
    {
      name: "leeruitkomsten",
      label: { nl: "Gewenste leeruitkomst(en)", en: "Desired learning outcome(s)" },
      kind: "textarea",
      required: true,
      rows: 3,
      help: {
        nl: "Wat moeten studenten kunnen aantonen? Eén per regel.",
        en: "What must students be able to demonstrate? One per line.",
      },
      group: BACKWARD_DESIGN,
    },
    {
      name: "bewijs",
      label: { nl: "Aanvaardbaar bewijs van leren", en: "Acceptable evidence of learning" },
      kind: "textarea",
      rows: 2,
      help: {
        nl: "Wat geldt als overtuigend bewijs dat de leeruitkomst is behaald?",
        en: "What counts as convincing evidence that the outcome has been met?",
      },
      group: BACKWARD_DESIGN,
    },
    {
      name: "authentiekeContext",
      label: {
        nl: "Authentieke (beroeps)context, rol & doelgroep",
        en: "Authentic (professional) context, role & audience",
      },
      kind: "textarea",
      required: true,
      rows: 3,
      placeholder: {
        nl: "bijv. student levert als junior developer een technisch adviesrapport op voor een opdrachtgever",
        en: "e.g. as a junior developer, the student delivers a technical advisory report to a client",
      },
      group: BACKWARD_DESIGN,
    },
    {
      name: "rubricFramework",
      label: { nl: "Rubricraamwerk", en: "Rubric framework" },
      kind: "text",
      defaultValue: "AAC&U VALUE rubrics",
      help: {
        nl: "Te gebruiken rubric-/competentieraamwerk (aanpasbaar).",
        en: "Rubric/competency framework to use (adjustable).",
      },
      group: BACKWARD_DESIGN,
    },
    {
      name: "iteratie",
      label: { nl: "Realistisch niveau van iteratie", en: "Realistic level of iteration" },
      kind: "select",
      options: [
        {
          value: "limited (single submission)",
          label: { nl: "Beperkt (één inlevermoment)", en: "Limited (single submission)" },
        },
        {
          value: "moderate (draft + feedback)",
          label: { nl: "Gemiddeld (draft + feedback)", en: "Moderate (draft + feedback)" },
        },
        {
          value: "extensive (multiple checkpoints)",
          label: {
            nl: "Uitgebreid (meerdere checkpoints)",
            en: "Extensive (multiple checkpoints)",
          },
        },
      ],
      defaultValue: "moderate (draft + feedback)",
      group: BACKWARD_DESIGN,
    },
  ],
  stages: [
    {
      id: "blueprint",
      name: { nl: "Assessment Blueprint", en: "Assessment Blueprint" },
      systemPromptId: AUTHENTIC_ASSESSMENT_PROMPT.id,
      output: {
        kind: "structured-sections",
        hint: {
          nl: "Volledige Assessment Blueprint: taak, analytische rubric, studentgerichte rubric, feedback, UDL & integriteit.",
          en: "Full Assessment Blueprint: task, analytic rubric, student-facing rubric, feedback, UDL & integrity.",
        },
      },
    },
  ],
};
