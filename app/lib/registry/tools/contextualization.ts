import type { Tool } from "../types";
import { CONTEXTUALIZATION_PROMPT_V2 } from "~/lib/prompts/contextualization@v2.prompt";
import { attribution } from "~/lib/prompts/attribution";
import { DEFAULT_MODEL } from "~/lib/ai/models";

const CONTEXT = { nl: "Context", en: "Context" };

export const contextualization: Tool = {
  id: "contextualization",
  slug: "contextualization",
  name: { nl: "Cursus op samenhang controleren", en: "Check your course alignment" },
  /** Book/technique name shown small under the task-first name. */
  subtitle: {
    nl: "Contextualization (pedagogische intentie)",
    en: "Contextualization (pedagogical intent)",
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
    authors: "Alexis Guethler",
    sourcePages: "Appendix 1 (web edition, doi.org/10.59668/2340.26734)",
    adapted: true,
    adaptation: {
      nl: "Deze tool doet iets anders dan het boek. In het boek schrijft de AI per lesmateriaal (een tekst of video) een korte inleiding voor studenten, van 2 tot 5 zinnen, die laat zien waarom het materiaal ertoe doet. Wij nemen het doel van het hoofdstuk over, de pedagogische bedoeling zichtbaar maken, maar analyseren de samenhang van een hele cursusopzet: leerdoelen, werkvormen en toetsing. Het hoofdstuk ontbreekt in het boek-PDF; de prompt komt uit de webversie.",
      en: "This tool does something different from the book. In the book the AI writes a short student-facing introduction of 2 to 5 sentences for each reading or video, showing why it matters. We keep the chapter's aim, making pedagogical intent visible, but analyse the alignment of a whole course design: outcomes, activities and assessment. The chapter is missing from the book PDF; the prompt comes from the web edition.",
    },
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: DEFAULT_MODEL,
  defaultMaxTokens: 6144,
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
      prefillFromCourse: { source: "learningOutcomes" },
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
      // From the teaching context when one is selected; stays editable.
      prefillFromProfile: { source: "pedagogy" },
      label: {
        nl: "Jouw pedagogische benadering (optioneel)",
        en: "Your pedagogical approach (optional)",
      },
      kind: "textarea",
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
      systemPromptId: CONTEXTUALIZATION_PROMPT_V2.id,
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
