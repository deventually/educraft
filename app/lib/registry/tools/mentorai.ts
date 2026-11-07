import type { Tool } from "../types";
import { MENTORAI_PROMPT_V2 } from "~/lib/prompts/mentorai@v2.prompt";
import { attribution } from "~/lib/prompts/attribution";
import { DEFAULT_MODEL } from "~/lib/ai/models";

const CONTEXT = { nl: "Context", en: "Context" };

export const mentorai: Tool = {
  id: "mentorai",
  slug: "mentorai",
  name: { nl: "Persoonlijke leermeester", en: "Personal learning mentor" },
  /** Book/technique name shown small under the task-first name. */
  subtitle: {
    nl: "MentorAI (Cognitief Leermeesterschap)",
    en: "MentorAI (Cognitive Apprenticeship)",
  },
  tagline: {
    nl: "Een persoonlijke leermeester die je helpt door vragen te stellen en je denken te geleiden.",
    en: "A personal mentor who helps you by asking questions and guiding your thinking.",
  },
  icon: "brain",
  userType: "student",
  mode: "chat",
  theory: {
    name: { nl: "Cognitief Leermeesterschap", en: "Cognitive Apprenticeship" },
    summary: {
      nl: "Een expert doet het eerst hardop denkend voor met een eigen voorbeeld. Daarna doe jij een volledige poging, voorspel je zelf waar het misgaat en controleer je je eigen werk. De hulp wordt steeds minder, tot je het zonder kunt.",
      en: "An expert first demonstrates, thinking aloud, on an example of its own. Then you make a full attempt, predict where it goes wrong and check your own work. The support fades until you can do it without.",
    },
    keyCitations: [
      "Collins, Brown & Newman (1989)",
      "Koedinger & Aleven (2007)",
      "Agarwal, Hadjiyiannis, Moagi & Koblic (2026)",
    ],
  },
  attribution: attribution({
    chapterTitle: "From Model to Mentor: Cognitive Apprenticeship",
    authors: "Agarwal, Hadjiyiannis, Moagi & Koblic",
    sourcePages: "pp. 36–44",
    evaluatedWith: { nl: "Claude", en: "Claude" },
    adapted: true,
    adaptation: {
      nl: "Gebaseerd op de prompt uit het boek. In het boek oefent de lerende één vaste taak: feedback geven met SBI. Wij vervangen die door jouw vak en leerdoel, en de leermeester leidt de succescriteria daaruit af. Eén regel uit het boek maken we strenger: de leermeester lost je eigen opgave nooit op, ook niet als je aandringt, en doet alleen voor met een eigen voorbeeld. Vertaald naar het Nederlands.",
      en: "Based on the book's prompt. In the book the learner practises one fixed task: giving feedback with SBI. We replace it with your subject and learning goal, and the mentor derives the success criteria from that goal. We make one rule from the book stricter: the mentor never solves your own task, even when you push, and only demonstrates on its own example.",
    },
    improvedAfter: {
      date: "2026-11-04",
      report: "evals/reports/2026-11-04f.md",
      summary: {
        nl: "de leermeester geeft onder druk het antwoord niet weg, gebruikt geen lijstjes meer en stelt meestal één vraag per beurt (gemiddeld 2,5 → 3,4 op drie oefengesprekken, elk drie keer).",
        en: "the mentor no longer gives the answer away under pressure, no longer uses lists and mostly asks one question per turn (average 2.5 → 3.4 over three practice conversations, each run three times).",
      },
    },
  }),
  // The teacher's context profile seeds the learner's level (EQF); the bespoke
  // foundation/intermediate/advanced input is retired onto that spine (P6.8).
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: DEFAULT_MODEL,
  defaultMaxTokens: 2048,
  defaultTemperature: 0.7,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "discipline",
      label: { nl: "Vakgebied / Discipline", en: "Subject / Discipline" },
      kind: "text",
      required: true,
      placeholder: { nl: "bijv. Programmeertalen", en: "e.g. Programming languages" },
      group: CONTEXT,
    },
    {
      name: "studentContext",
      label: { nl: "Jouw achtergrond / niveau", en: "Your background / level" },
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: {
        nl: "bijv. Beginnende programmeur, eerstejaars student",
        en: "e.g. Beginner programmer, first-year student",
      },
      group: CONTEXT,
    },
    {
      name: "learningGoal",
      label: { nl: "Wat wil je vandaag leren?", en: "What do you want to learn today?" },
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: {
        nl: "bijv. Hoe werkt Object-Oriented Programming?",
        en: "e.g. How does Object-Oriented Programming work?",
      },
      group: CONTEXT,
    },
  ],
  stages: [
    {
      id: "mentor",
      name: { nl: "MentorAI", en: "MentorAI" },
      description: {
        nl: "Een one-on-one leermeestersessie",
        en: "A one-on-one mentoring session",
      },
      systemPromptId: MENTORAI_PROMPT_V2.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Een gepersonaliseerde mentoringrespons gebaseerd op jouw leergebied en doel.",
          en: "A personalized mentoring response based on your discipline and learning goal.",
        },
      },
    },
  ],
  chat: {
    greeting: {
      nl: "Welkom! Ik ben je leermeester. Het antwoord geef ik je niet, wel steeds een stap verder. Waar werk je aan, of waar loop je op vast?",
      en: "Welcome! I'm your mentor. I won't give you the answer, but I'll always help you one step further. What are you working on, or where are you stuck?",
    },
    starters: [
      {
        nl: "Ik wil beginnen met de basisconcepten",
        en: "I want to start with the basics",
      },
      {
        nl: "Ik zit vast bij iets specifieks",
        en: "I'm stuck on something specific",
      },
      {
        nl: "Ik wil dieper ingaan op een onderwerp",
        en: "I want to dive deeper into a topic",
      },
    ],
    allowStop: true,
    allowRegenerate: true,
  },
};
