import type { Tool } from "../types";
import { AUTHENTIC_ASSESSMENT_PROMPT } from "~/lib/prompts/authentic-assessment.prompt";
import { attribution } from "~/lib/prompts/attribution";

const MODALITEIT = [
  { value: "contactonderwijs", label: "Contactonderwijs" },
  { value: "online", label: "Online" },
  { value: "hybride", label: "Hybride" },
];

export const authenticAssessment: Tool = {
  id: "authentic-assessment-backward-design",
  slug: "authentieke-toetsing",
  nameNl: "Authentieke toetsing (Backward Design)",
  taglineNl:
    "Ontwerp een realistische, praktijkgerichte toets met analytische rubric en bruikbare feedback.",
  icon: "clipboard-check",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: "Backward Design + Authentic Assessment + VALUE rubrics",
    summaryNl:
      "Vertrek vanuit leeruitkomsten en aanvaardbaar bewijs naar een authentieke beroepstaak met afgestemde, schaalbare beoordeling.",
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
      label: "Vakgebied / discipline",
      kind: "text",
      required: true,
      placeholder: "bijv. Software Engineering",
      group: "Cursuscontext",
    },
    {
      name: "niveau",
      label: "Niveau",
      kind: "select",
      required: true,
      options: [
        { value: "introductie", label: "Introductie" },
        { value: "gevorderd", label: "Gevorderd" },
        { value: "afstudeerfase", label: "Afstudeerfase" },
      ],
      defaultValue: "gevorderd",
      group: "Cursuscontext",
    },
    {
      name: "modaliteit",
      label: "Modaliteit",
      kind: "select",
      options: MODALITEIT,
      defaultValue: "contactonderwijs",
      group: "Cursuscontext",
    },
    {
      name: "groepsgrootte",
      label: "Groepsgrootte",
      kind: "number",
      min: 1,
      max: 1000,
      defaultValue: 30,
      group: "Cursuscontext",
    },
    {
      name: "randvoorwaarden",
      label: "Randvoorwaarden",
      kind: "textarea",
      rows: 2,
      placeholder: "Nakijkcapaciteit, accreditatie, verplichte tools, planning…",
      group: "Cursuscontext",
    },
    {
      name: "leeruitkomsten",
      label: "Gewenste leeruitkomst(en)",
      kind: "textarea",
      required: true,
      rows: 3,
      help: "Wat moeten studenten kunnen aantonen? Eén per regel.",
      group: "Backward Design",
    },
    {
      name: "bewijs",
      label: "Aanvaardbaar bewijs van leren",
      kind: "textarea",
      rows: 2,
      help: "Wat geldt als overtuigend bewijs dat de leeruitkomst is behaald?",
      group: "Backward Design",
    },
    {
      name: "authentiekeContext",
      label: "Authentieke (beroeps)context, rol & doelgroep",
      kind: "textarea",
      required: true,
      rows: 3,
      placeholder:
        "bijv. student levert als junior developer een technisch adviesrapport op voor een opdrachtgever",
      group: "Backward Design",
    },
    {
      name: "rubricFramework",
      label: "Rubricraamwerk",
      kind: "text",
      defaultValue: "AAC&U VALUE rubrics",
      help: "Te gebruiken rubric-/competentieraamwerk (aanpasbaar).",
      group: "Backward Design",
    },
    {
      name: "iteratie",
      label: "Realistisch niveau van iteratie",
      kind: "select",
      options: [
        { value: "beperkt (één inlevermoment)", label: "Beperkt (één inlevermoment)" },
        { value: "gemiddeld (één draft + feedback)", label: "Gemiddeld (draft + feedback)" },
        { value: "uitgebreid (meerdere checkpoints)", label: "Uitgebreid (meerdere checkpoints)" },
      ],
      defaultValue: "gemiddeld (één draft + feedback)",
      group: "Backward Design",
    },
  ],
  stages: [
    {
      id: "blueprint",
      name: "Assessment Blueprint",
      systemPromptId: AUTHENTIC_ASSESSMENT_PROMPT.id,
      output: {
        kind: "structured-sections",
        hint: "Volledige Assessment Blueprint: taak, analytische rubric, studentgerichte rubric, feedback, UDL & integriteit.",
      },
    },
  ],
};
