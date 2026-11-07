import type { Tool } from "../types";
import { DIALOGIC_ENCOUNTERS_PROMPT_V2 } from "~/lib/prompts/dialogic-encounters@v2.prompt";
import { attribution } from "~/lib/prompts/attribution";
import { DEFAULT_MODEL } from "~/lib/ai/models";

const CONTEXT = { nl: "Context", en: "Context" };

export const dialogicEncounters: Tool = {
  id: "dialogic-encounters",
  slug: "dialogic-encounters",
  name: { nl: "Gesprek met een theoreticus", en: "Talk with a learning theorist" },
  /** Book/technique name shown small under the task-first name. */
  subtitle: { nl: "Dialogische ontmoetingen (Dialogic Encounters)", en: "Dialogic Encounters" },
  tagline: {
    nl: "Interview een leertheoreticus en ontdek wat diens theorie betekent voor je les.",
    en: "Interview a learning theorist and find out what their theory means for your lesson.",
  },
  icon: "users-round",
  userType: "student",
  mode: "chat",
  theory: {
    name: {
      nl: "Dialogisch leren en rollenspel",
      en: "Dialogic learning and role-play",
    },
    summary: {
      nl: "Een leertheorie wordt een ontwerpkeuze als je ziet welke aannames over leren erachter zitten. In een gesprek met de theoreticus vraag je door, vergelijk je en pas je toe op je eigen klas. Omdat de AI vloeiend en overtuigend klinkt, controleer je daarna twee antwoorden met de CRAAP-test.",
      en: "A learning theory becomes a design choice once you see the assumptions about learning behind it. In a conversation with the theorist you ask follow-up questions, compare and apply it to your own class. Because the AI sounds fluent and convincing, you then check two answers with the CRAAP test.",
    },
    keyCitations: [
      "Ertmer & Newby (2013)",
      "Mercer & Howe (2012)",
      "Gee (2007)",
      "Reber & Schwarz (1999)",
    ],
  },
  attribution: attribution({
    chapterTitle:
      "Dialogic Encounters with Learning Theorists: Using AI Role-Play to Teach Pre-Service Teachers",
    authors: "Clark-Stallkamp, Berry, Cole & Lin",
    sourcePages: "pp. 100–102",
    evaluatedWith: { nl: "Claude", en: "Claude" },
    adapted: true,
    adaptation: {
      nl: 'Gebaseerd op het interview uit het boek ("Tech Talk with a Theorist"). In het boek plakt de student zelf een sjabloon in ChatGPT; hier zit dat sjabloon in de tool en kies je de theoreticus. We schrijven de lessen uit het hoofdstuk in de prompt: de theoreticus spreekt in zijn eigen begrippen en tijd, corrigeert een verkeerde aanname in je vraag (ook een subtiele, op de grens tussen theorieën), zegt het als hij over latere technologie doorredeneert, verzint geen bronnen, en doet een eerlijke CRAAP-test als je het interview stopt. Vertaald naar het Nederlands.',
      en: "Based on the book's interview (\"Tech Talk with a Theorist\"). In the book the student pastes a template into ChatGPT; here the template is built into the tool and you choose the theorist. We write the chapter's lessons into the prompt: the theorist speaks in their own concepts and era, corrects a wrong assumption in your question (also a subtle one, on the boundary between theories), says so when extrapolating to later technology, invents no sources, and runs an honest CRAAP test when you stop the interview.",
    },
    improvedAfter: {
      date: "2026-11-04",
      report: "evals/reports/2026-11-04i.md",
      summary: {
        nl: "de theoreticus wijst een verkeerde aanname in je vraag nu steeds stevig af, praat in lopende tekst zonder lijstjes en stelt meestal hooguit één vraag terug (gemiddeld 3,0 → 4,1 op vier interviews, elk drie keer).",
        en: "the theorist now firmly rejects a wrong assumption in your question every time, speaks in running prose without lists and mostly asks at most one question back (average 3.0 → 4.1 over four interviews, each run three times).",
      },
    },
  }),
  usesContextProfile: false,
  defaultOutputLanguage: "nl",
  defaultModel: DEFAULT_MODEL,
  defaultMaxTokens: 2048,
  defaultTemperature: 0.7,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "theorist",
      label: {
        nl: "Welke theoreticus wil je ontmoeten?",
        en: "Which theorist would you like to meet?",
      },
      kind: "select",
      required: true,
      options: [
        {
          value: "Jean Piaget",
          label: { nl: "Jean Piaget (Constructivisme)", en: "Jean Piaget (Constructivism)" },
        },
        {
          value: "Jerome Bruner",
          label: { nl: "Jerome Bruner (Constructivisme)", en: "Jerome Bruner (Constructivism)" },
        },
        {
          value: "Lev Vygotsky",
          label: { nl: "Lev Vygotsky (Constructivisme)", en: "Lev Vygotsky (Constructivism)" },
        },
        {
          value: "John Dewey",
          label: { nl: "John Dewey (Constructivisme)", en: "John Dewey (Constructivism)" },
        },
        {
          value: "Seymour Papert",
          label: {
            nl: "Seymour Papert (Constructionisme)",
            en: "Seymour Papert (Constructionism)",
          },
        },
        {
          value: "Albert Bandura",
          label: { nl: "Albert Bandura (Sociaal leren)", en: "Albert Bandura (Social Learning)" },
        },
        {
          value: "B.F. Skinner",
          label: { nl: "B.F. Skinner (Behaviorisme)", en: "B.F. Skinner (Behaviorism)" },
        },
        {
          value: "Ivan Pavlov",
          label: { nl: "Ivan Pavlov (Behaviorisme)", en: "Ivan Pavlov (Behaviorism)" },
        },
        {
          value: "Robert Gagné",
          label: { nl: "Robert Gagné (Cognitivisme)", en: "Robert Gagné (Cognitivism)" },
        },
        {
          value: "David Ausubel",
          label: { nl: "David Ausubel (Cognitivisme)", en: "David Ausubel (Cognitivism)" },
        },
        {
          value: "John Sweller",
          label: {
            nl: "John Sweller (Cognitieve belasting)",
            en: "John Sweller (Cognitive Load)",
          },
        },
        {
          value: "Jeroen van Merriënboer",
          label: {
            nl: "Jeroen van Merriënboer (4C/ID)",
            en: "Jeroen van Merriënboer (4C/ID)",
          },
        },
        {
          value: "Paul A. Kirschner",
          label: {
            nl: "Paul A. Kirschner (Directe instructie)",
            en: "Paul A. Kirschner (Direct Instruction)",
          },
        },
        {
          value: "David Kolb",
          label: { nl: "David Kolb (Ervaringsleren)", en: "David Kolb (Experiential Learning)" },
        },
        {
          value: "Carl Rogers",
          label: { nl: "Carl Rogers (Humanisme)", en: "Carl Rogers (Humanism)" },
        },
        {
          value: "Malcolm Knowles",
          label: { nl: "Malcolm Knowles (Andragogiek)", en: "Malcolm Knowles (Andragogy)" },
        },
      ],
      group: CONTEXT,
    },
  ],
  stages: [
    {
      id: "encounter",
      name: { nl: "Dialogische Ontmoeting", en: "Dialogic Encounter" },
      description: {
        nl: "Een interview met een leertheoreticus, gespeeld door de AI.",
        en: "An interview with a learning theorist, played by the AI.",
      },
      systemPromptId: DIALOGIC_ENCOUNTERS_PROMPT_V2.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Een interview waarin je de leertheorie verkent.",
          en: "An interview in which you explore the learning theory.",
        },
      },
    },
  ],
  chat: {
    greeting: {
      nl: "Je gaat een grote leertheoreticus interviewen. Stel één vraag per keer en vraag door op de antwoorden. Het is een simulatie: trek na afloop twee antwoorden na in een betrouwbare bron.",
      en: "You are about to interview a great learning theorist. Ask one question at a time and follow up on the answers. It is a simulation: afterwards, check two answers in a reliable source.",
    },
    starters: [
      {
        nl: "Wat is het kernidee van uw theorie?",
        en: "What is the core idea behind your learning theory?",
      },
      {
        nl: "Hoe leren leerlingen volgens uw theorie het best?",
        en: "How do students best learn according to your theory?",
      },
      {
        nl: "Welke activiteiten of technologie passen bij uw theorie?",
        en: "What kind of classroom activities or technologies would support your theory?",
      },
    ],
    allowStop: true,
    allowRegenerate: true,
  },
};
