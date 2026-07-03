import type { Tool } from "../types";
import { FORUM_AUTOGRADER_PROMPT } from "~/lib/prompts/forum-autograder.prompt";
import { attribution } from "~/lib/prompts/attribution";

const CONTEXT = { nl: "Context", en: "Context" };

export const forumAutograder: Tool = {
  id: "forum-autograder",
  slug: "forum-autograder",
  name: {
    nl: "Forum Autograder — Community of Inquiry",
    en: "Forum Autograder — Community of Inquiry",
  },
  tagline: {
    nl: "Beoordeel asynchrone forumdiscussies met AI met de CoI-framework: sociale, cognitieve en onderwijsaanwezigheid.",
    en: "Grade asynchronous forum discussions with AI using the CoI framework: social, cognitive, and teaching presence.",
  },
  icon: "message-circle",
  userType: "instructor",
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
  defaultMaxTokens: 4096,
  defaultTemperature: 0.5,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "discussionThread",
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
