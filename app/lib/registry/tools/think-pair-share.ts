import type { Tool } from "../types";
import { THINK_PAIR_SHARE_PROMPT } from "~/lib/prompts/think-pair-share.prompt";
import { attribution } from "~/lib/prompts/attribution";

const CONTEXT = { nl: "Context", en: "Context" };

export const thinkPairShare: Tool = {
  id: "think-pair-share",
  slug: "think-pair-share",
  name: {
    nl: "Think-Pair-Share — Peer Denken",
    en: "Think-Pair-Share — Collaborative Peer Thinking",
  },
  tagline: {
    nl: "Werk samen met een gelijkwaardige peer om dieper na te denken over je leerstof.",
    en: "Collaborate with an equal peer to think more deeply about your subject matter.",
  },
  icon: "users",
  userType: "student",
  mode: "chat",
  theory: {
    name: { nl: "Samenwerken Leren", en: "Collaborative Learning" },
    summary: {
      nl: "Leer door gelijke deelname aan dialoog: eerst individueel nadenken, dan dialogische uitwisseling met een peer, tenslotte openbare synthese.",
      en: "Learn through equal participation in dialogue: individual thinking, peer discussion, and public synthesis—a structured path to deeper understanding.",
    },
    keyCitations: ["Johnson & Johnson (2002)", "Kuhn (2015)", "Mercer & Howe (2012)"],
  },
  attribution: attribution({
    chapterTitle:
      "Rethinking Think-Pair-Share: Generative AI as a Collaborative Peer in Technology Education",
    authors: "Amara Atif",
    sourcePages: "pp. 51–66",
    evaluatedWith: { nl: "Claude", en: "Claude" },
    adapted: false,
  }),
  usesContextProfile: false,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-4-6",
  defaultTemperature: 0.7,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "discipline",
      label: { nl: "Vakgebied / Discipline", en: "Subject / Discipline" },
      kind: "text",
      required: true,
      placeholder: {
        nl: "bijv. Natuurkunde, geschiedenis, bedrijfskunde",
        en: "e.g. Physics, history, business management",
      },
      group: CONTEXT,
    },
    {
      name: "topic",
      label: {
        nl: "Onderwerp / Leidende vraag",
        en: "Topic / Guiding Question",
      },
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: {
        nl: "bijv. Hoe zorgt het behoud van energie voor duurzaamheid?",
        en: "e.g. How does energy conservation support sustainability?",
      },
      group: CONTEXT,
    },
  ],
  stages: [
    {
      id: "tps",
      name: { nl: "Think-Pair-Share", en: "Think-Pair-Share" },
      description: {
        nl: "Een gelijkwaardige peer die je helpt dieper na te denken.",
        en: "An equal peer who helps you think more deeply.",
      },
      systemPromptId: THINK_PAIR_SHARE_PROMPT.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Een dialogische uitwisseling met een medestudent peer.",
          en: "A dialogic exchange with a student peer.",
        },
      },
    },
  ],
  chat: {
    greeting: {
      nl: "Hallo! Ik ben je gelijkwaardige peer in deze denksessie. Ik zal je helpen je ideeën uit te werken door vragen te stellen en alternatieve perspectieven te verkennen. Waar begin je?",
      en: "Hi! I'm your equal peer in this thinking session. I'll help you develop your ideas by asking questions and exploring different perspectives. Where shall we start?",
    },
    starters: [
      {
        nl: "Ik wil beginnen met mijn initiële gedachte delen",
        en: "I want to start by sharing my initial thought",
      },
      {
        nl: "Ik ben klaar voor verdere vragen en uitdaging",
        en: "I'm ready for follow-up questions and challenges",
      },
      {
        nl: "Laten we mijn antwoord verder uitwerken",
        en: "Let's develop my answer further",
      },
    ],
    allowStop: true,
    allowRegenerate: true,
  },
};
