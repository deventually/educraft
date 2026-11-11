import type { Tool } from "../types";
import { LESSON_PLAN_PROMPT } from "~/lib/prompts/lesson-plan@v1.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";
import { DEFAULT_MODEL } from "~/lib/ai/models";

const LESSON = { nl: "De les", en: "The lesson" };
const SETTING = { nl: "Groep en tijd", en: "Group and time" };

/**
 * Les voorbereiden — brief P24, 24.4. An original LimeOnIt tool: from the teacher's learning
 * goal and content a draft lesson plan whose phases follow Rosenshine's (2012) principles of
 * instruction, with a time plan that adds up to the lesson length and activities that fit
 * the group size and delivery mode. Too much content, missing prior knowledge and a goal
 * that is not observable are named first.
 */
export const lessonPlan: Tool = {
  id: "lesson-plan",
  slug: "lesson-plan",
  name: { nl: "Les voorbereiden", en: "Prepare a lesson" },
  subtitle: {
    nl: "Lesopzet met tijdsplan, naar Rosenshine",
    en: "Lesson plan with a time plan, after Rosenshine",
  },
  tagline: {
    nl: "Maak bij je leerdoel een concept-lesopzet: voorkennis ophalen, uitleg in kleine stappen, begeleid en zelfstandig oefenen en een check op begrip, met een tijdsplan dat klopt.",
    en: "Build a draft lesson plan for your learning goal: activating prior knowledge, explanation in small steps, guided and independent practice and a check for understanding, with a time plan that adds up.",
  },
  icon: "calendar-clock",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: {
      nl: "Principes van instructie (Rosenshine)",
      en: "Principles of instruction (Rosenshine)",
    },
    summary: {
      nl: "Tien principes uit onderzoek naar leren en naar succesvolle docenten: begin met een korte terugblik, bied nieuwe stof in kleine stappen aan met voorbeelden, stel veel vragen en check de antwoorden van alle studenten, begeleid het oefenen tot ongeveer 80% goed gaat, laat zelfstandig oefenen onder toezicht en kom wekelijks en maandelijks terug op de stof (Rosenshine, 2012).",
      en: "Ten principles from research on learning and on successful teachers: begin with a short review, present new material in small steps with worked examples, ask many questions and check the responses of all students, guide practice until about 80% is correct, require and monitor independent practice, and return to the material in weekly and monthly review (Rosenshine, 2012).",
    },
    keyCitations: ["Rosenshine (2012)"],
  },
  attribution: originalAttribution({
    source: {
      nl: "Origineel LimeOnIt-instrument, met de lesfasen naar Rosenshine (2012).",
      en: "Original LimeOnIt instrument, with the lesson phases after Rosenshine (2012).",
    },
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  next: ["differentiation", "clear-assignment", "engagement-check"],
  courseActions: ["activity"],
  defaultModel: DEFAULT_MODEL,
  defaultMaxTokens: 12288,
  defaultTemperature: 0.3,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "learningGoal",
      prefillFromCourse: { source: "lessonGoal" },
      label: { nl: "Leerdoel van deze les", en: "Learning goal of this lesson" },
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: {
        nl: "bijv. De student berekent met de formule van Gordon de intrinsieke waarde van een aandeel.",
        en: "e.g. The student calculates the intrinsic value of a share with the Gordon growth model.",
      },
      help: {
        nl: 'Gebruik een waarneembaar werkwoord, zoals berekent, legt uit of ontwerpt. Bij "begrijpt" of "kent" stelt de tool een scherpere formulering voor.',
        en: 'Use an observable verb, such as calculates, explains or designs. With "understands" or "knows" the tool proposes a sharper wording.',
      },
      group: LESSON,
    },
    {
      name: "content",
      prefillFromCourse: { source: "itemTitle" },
      label: { nl: "Inhoud van de les", en: "Content of the lesson" },
      kind: "textarea",
      required: true,
      rows: 3,
      placeholder: {
        nl: "Welke stof behandel je? bijv. Het dividendgroeimodel, met twee rekenvoorbeelden.",
        en: "What material do you cover? e.g. The dividend growth model, with two worked calculations.",
      },
      group: LESSON,
    },
    {
      name: "priorKnowledge",
      prefillFromCourse: { source: "earlierLessons" },
      label: {
        nl: "Wat de studenten al weten (optioneel)",
        en: "What the students already know (optional)",
      },
      kind: "textarea",
      rows: 2,
      placeholder: {
        nl: "bijv. Contante waarde is vorige week behandeld.",
        en: "e.g. Present value was covered last week.",
      },
      group: LESSON,
    },
    {
      name: "duration",
      prefillFromCourse: { source: "sessionMinutes" },
      label: { nl: "Lesduur (minuten)", en: "Lesson length (minutes)" },
      kind: "number",
      required: true,
      min: 15,
      max: 480,
      step: 5,
      defaultValue: 90,
      group: SETTING,
    },
    {
      name: "groupSize",
      prefillFromCourse: { source: "groupSize" },
      label: { nl: "Groepsgrootte", en: "Group size" },
      kind: "number",
      required: true,
      min: 1,
      max: 1000,
      defaultValue: 25,
      group: SETTING,
    },
    {
      name: "deliveryMode",
      prefillFromCourse: { source: "deliveryMode" },
      label: { nl: "Contactvorm", en: "Delivery mode" },
      kind: "select",
      required: true,
      defaultValue: "in-person",
      options: [
        { value: "in-person", label: { nl: "Op locatie", en: "In person" } },
        { value: "online", label: { nl: "Live online", en: "Live online" } },
        { value: "hybrid", label: { nl: "Hybride", en: "Hybrid" } },
      ],
      group: SETTING,
    },
    {
      name: "constraints",
      label: {
        nl: "Vaste onderdelen en bijzonderheden (optioneel)",
        en: "Fixed parts and particulars (optional)",
      },
      kind: "textarea",
      rows: 2,
      placeholder: {
        nl: "bijv. De eerste 5 minuten zijn mededelingen. Het lokaal heeft geen beamer.",
        en: "e.g. The first 5 minutes are announcements. The room has no projector.",
      },
      group: SETTING,
    },
  ],
  stages: [
    {
      id: "lesson",
      name: { nl: "Lesopzet", en: "Lesson plan" },
      systemPromptId: LESSON_PLAN_PROMPT.id,
      output: {
        kind: "structured-sections",
        exportAs: "slides",
        hint: {
          nl: "Leerdoel en succescriterium, een tijdsplan dat optelt tot de lesduur, het verloop per fase, terugkomen in volgende lessen en een check op de opzet.",
          en: "Learning goal and success criterion, a time plan that adds up to the lesson length, the outline per phase, coming back in later lessons and a check of the plan.",
        },
      },
    },
  ],
};
