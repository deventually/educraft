import type { Tool } from "../types";
import { GUIDED_REFLECTION_PROMPT } from "~/lib/prompts/guided-reflection.prompt";
import { attribution } from "~/lib/prompts/attribution";

const NIVEAU = [
  { value: "propedeuse", label: "Propedeuse (jaar 1)" },
  { value: "hoofdfase", label: "Hoofdfase (jaar 2–3)" },
  { value: "afstudeerfase", label: "Afstudeerfase (jaar 4)" },
];

const MODALITEIT = [
  { value: "contactonderwijs", label: "Contactonderwijs" },
  { value: "online", label: "Online" },
  { value: "hybride", label: "Hybride" },
  { value: "flipped", label: "Flipped classroom" },
];

export const guidedReflection: Tool = {
  id: "guided-reflection-backward-design",
  slug: "begeleide-reflectie",
  nameNl: "Begeleide reflectie & Backward Design",
  taglineNl:
    "Ontwerp een les of cursus vanuit de gewenste leeruitkomsten, volgens Backward Design.",
  icon: "compass",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: "Backward Design (Understanding by Design)",
    summaryNl:
      "Begin bij de gewenste resultaten, bepaal aanvaardbaar bewijs en plan dan pas de leeractiviteiten.",
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
  defaultTemperature: 0.4,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "onderwerp",
      label: "Onderwerp van de les/cursus",
      kind: "text",
      required: true,
      placeholder: "bijv. RESTful API-ontwerp",
      group: "Basis",
    },
    {
      name: "niveau",
      label: "Niveau",
      kind: "select",
      required: true,
      options: NIVEAU,
      defaultValue: "hoofdfase",
      group: "Basis",
    },
    {
      name: "scope",
      label: "Reikwijdte",
      kind: "select",
      required: true,
      options: [
        { value: "één les", label: "Eén les" },
        { value: "lessenreeks", label: "Lessenreeks" },
        { value: "volledige cursus", label: "Volledige cursus" },
      ],
      defaultValue: "één les",
      group: "Basis",
    },
    {
      name: "duur",
      label: "Duur (minuten)",
      kind: "number",
      min: 30,
      max: 480,
      step: 15,
      defaultValue: 90,
      group: "Basis",
    },
    {
      name: "modaliteit",
      label: "Werkvorm / modaliteit",
      kind: "select",
      options: MODALITEIT,
      defaultValue: "contactonderwijs",
      group: "Basis",
    },
    {
      name: "voorkennis",
      label: "Voorkennis van studenten",
      kind: "textarea",
      rows: 2,
      placeholder: "Wat hebben studenten al gedaan/geleerd vóór deze les?",
      group: "Basis",
    },
    {
      name: "bigIdea",
      label: "1. Big idea / kernbegrip",
      kind: "textarea",
      required: true,
      rows: 2,
      help: "Welk centraal inzicht moeten studenten echt begrijpen?",
      group: "Backward Design-reflectie",
    },
    {
      name: "essentieleVraag",
      label: "2. Essentiële vraag/vragen",
      kind: "textarea",
      rows: 2,
      help: "Welke vraag stuurt het onderzoek/de les?",
      group: "Backward Design-reflectie",
    },
    {
      name: "leeruitkomsten",
      label: "3. Specifieke, meetbare leeruitkomsten",
      kind: "textarea",
      required: true,
      rows: 4,
      help: "Bloom-aligned. Eén leeruitkomst per regel.",
      group: "Backward Design-reflectie",
    },
    {
      name: "bewijs",
      label: "4. Bewijs van leren",
      kind: "textarea",
      rows: 3,
      help: "Hoe toon je aan dat studenten het beheersen? (formatief/summatief)",
      group: "Backward Design-reflectie",
    },
    {
      name: "relevantie",
      label: "5. Relevantie / toepassing in de praktijk",
      kind: "textarea",
      rows: 2,
      help: "Waarom doet dit ertoe in het werkveld?",
      group: "Backward Design-reflectie",
    },
    {
      name: "artefacten",
      label: "Te produceren materialen",
      kind: "multiselect",
      required: true,
      options: [
        { value: "een college-outline", label: "College-outline" },
        { value: "slides", label: "Slides" },
        { value: "een werkvorm/activiteit", label: "Werkvorm / activiteit" },
        { value: "een rubric", label: "Rubric" },
        { value: "een quiz/toets", label: "Quiz / toets" },
      ],
      defaultValue: ["een college-outline", "een werkvorm/activiteit"],
      group: "Materialen",
    },
  ],
  stages: [
    {
      id: "design",
      name: "Ontwerp",
      systemPromptId: GUIDED_REFLECTION_PROMPT.id,
      output: {
        kind: "structured-sections",
        hint: "Levert een Alignment Summary, de gevraagde materialen en een modelleersuggestie op.",
        sections: ["Alignment Summary", "Materialen", "Modelleersuggestie"],
      },
    },
  ],
};
