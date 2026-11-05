import type { Tool } from "../types";
import { FORUM_AUTOGRADER_PROMPT } from "~/lib/prompts/forum-autograder.prompt";
import { attribution } from "~/lib/prompts/attribution";

const CONTEXT = { nl: "Context", en: "Context" };

export const forumAutograder: Tool = {
  id: "forum-autograder",
  slug: "forum-autograder",
  name: { nl: "Forumbijdragen beoordelen", en: "Assess forum posts" },
  /** Book/technique name shown small under the task-first name. */
  subtitle: {
    nl: "Forum Autograder (Community of Inquiry)",
    en: "Forum Autograder (Community of Inquiry)",
  },
  tagline: {
    nl: "Beoordeel asynchrone forumdiscussies met AI met de CoI-framework: sociale, cognitieve en onderwijsaanwezigheid.",
    en: "Grade asynchronous forum discussions with AI using the CoI framework: social, cognitive, and teaching presence.",
  },
  icon: "message-circle",
  userType: "instructor",
  // Processes student work: never in a shared view (P28.4).
  handlesStudentWork: true,
  mode: "one-shot",
  theory: {
    name: {
      nl: "Community of Inquiry (CoI)",
      en: "Community of Inquiry (CoI)",
    },
    summary: {
      nl: "Een model voor online leren dat drie vormen van aanwezigheid meet: sociale aanwezigheid (gemeenschap), cognitieve aanwezigheid (diep denken) en onderwijsaanwezigheid (facilitatie).",
      en: "A model for online learning that measures three forms of presence: social presence (community), cognitive presence (deep thinking), and teaching presence (facilitation).",
    },
    keyCitations: ["Garrison, Anderson & Archer (2000, 2010)"],
  },
  attribution: attribution({
    chapterTitle: "AI-Supported Forum Autograder: A Community of Inquiry Approach",
    authors: "Lina Kadi",
    sourcePages: "pp. 122–124",
    evaluatedWith: { nl: "Claude Haiku 4.5", en: "Claude Haiku 4.5" },
    adapted: true,
    adaptation: {
      nl: "In het boek is het een Python-script dat een heel forum in stukken beoordeelt: per student een score op een vaste rubric, als JSONL, met één annotatie. Wij analyseren één forumdraad in één keer op de drie vormen van aanwezigheid uit Community of Inquiry, met de rubric en leerdoelen van de docent, en geven advies voor de begeleiding. Het is een concept voor de docent, in het Nederlands, en geen cijfer per student.",
      en: "In the book it is a Python script that grades a whole forum in chunks: a score per student on a fixed rubric, as JSONL, with one annotation. We analyse one forum thread in one go on the three Community of Inquiry presences, with the teacher's rubric and outcomes, and give facilitation advice. It is a draft for the teacher, in Dutch, not a grade per student.",
    },
  }),
  usesContextProfile: true,
  assistiveGrading: true,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-5-5",
  defaultMaxTokens: 8192, // nulmeting 2026-11-04: 4096 cut off the alignment advice.
  // Grading tool: use the grading-mode default (0.3) for consistent scores. The
  // facilitation advice it also produces is secondary to scoring stability.
  // (Phase 3 §3.6: was 0.5; aligned to the grading default. Confirm against evals.)
  defaultTemperature: 0.3,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "discussionThread",
      redact: true,
      label: {
        nl: "Forumthread / discussie",
        en: "Forum thread / discussion",
      },
      kind: "textarea",
      required: true,
      rows: 8,
      placeholder: {
        nl: "Plak hier de volledige forumthread (al de berichten met auteurs en timestamps).",
        en: "Paste the complete forum thread here (all messages with authors and timestamps).",
      },
      group: CONTEXT,
    },
    {
      name: "learningObjectives",
      prefillFromCourse: { source: "learningOutcomes" },
      label: {
        nl: "Leeruitkomsten voor deze discussie",
        en: "Learning objectives for this discussion",
      },
      kind: "textarea",
      required: true,
      rows: 3,
      placeholder: {
        nl: "bijv. Studenten kritisch analyseren bronnen; studenten respectvol met meningsverschillen omgaan",
        en: "e.g. Students critically analyze sources; students respectfully handle disagreement",
      },
      group: CONTEXT,
    },
    {
      name: "rubric",
      label: {
        nl: "Beoordelingscriteria",
        en: "Grading rubric / criteria",
      },
      kind: "textarea",
      rows: 3,
      placeholder: {
        nl: "bijv. Kwaliteit van redeneringen, gebruik van bewijs, participatiefrequentie",
        en: "e.g. Quality of reasoning, use of evidence, participation frequency",
      },
      group: CONTEXT,
    },
  ],
  stages: [
    {
      id: "assessment",
      name: { nl: "Beoordeling", en: "Assessment" },
      systemPromptId: FORUM_AUTOGRADER_PROMPT.id,
      output: {
        kind: "structured-sections",
        hint: {
          nl: "CoI-diagnose (sociale/cognitieve/onderwijsaanwezigheid), sterktes, verbeterpunten, aanbevelingen",
          en: "CoI diagnosis (social/cognitive/teaching presence), strengths, improvements, recommendations",
        },
      },
    },
  ],
};
