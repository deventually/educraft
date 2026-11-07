import type { Tool } from "../types";
import { DEFEND_YOUR_WORK_PROMPT_V3 } from "~/lib/prompts/defend-your-work@v3.prompt";
import { attribution } from "~/lib/prompts/attribution";

const WORK = { nl: "Het werk", en: "The work" };

/** The kinds of own work, shared with the review of the defense (P31.2). Stable English slugs. */
export const WORK_TYPE_OPTIONS = [
  { value: "report", label: { nl: "Verslag", en: "Report" } },
  { value: "internship", label: { nl: "Stage", en: "Internship" } },
  { value: "project", label: { nl: "Project", en: "Project" } },
  { value: "professional-product", label: { nl: "Beroepsproduct", en: "Professional product" } },
  { value: "lab", label: { nl: "Practicum of experiment", en: "Lab or experiment" } },
  { value: "other", label: { nl: "Iets anders", en: "Something else" } },
];
const DEFENSE = { nl: "De verdediging", en: "The defense" };

/**
 * Je eigen werk mondeling verdedigen — brief P31, 31.1. A chat tutor after Appendix F.3 of
 * "From Oracle to Socratic Partner": a critical but friendly expert from the field has the
 * student defend their own work, one question at a time, and never accepts a vague answer.
 * Teachers practise and demonstrate it here (students are not in the app, BESLUIT-2026-11-03-3);
 * as in the book, they copy the text for students to paste into their own AI.
 */
export const defendYourWork: Tool = {
  id: "defend-your-work",
  slug: "defend-your-work",
  name: { nl: "Je eigen werk mondeling verdedigen", en: "Defend your own work out loud" },
  subtitle: {
    nl: "Mondelinge verdediging (Lab Oral Defense)",
    en: "Oral defense (Lab Oral Defense)",
  },
  tagline: {
    nl: "Een kritische deskundige laat de student een verslag, stage of project mondeling verdedigen: waarom deze aanpak, wat zeggen je gegevens, wat kun je wel en niet concluderen.",
    en: "A critical expert has the student defend a report, internship or project out loud: why this approach, what does your data say, what can and can't you conclude.",
  },
  icon: "message-circle",
  userType: "student",
  mode: "chat",
  theory: {
    name: {
      nl: "Ophalen en uitleggen (mondelinge verdediging)",
      en: "Retrieval and elaboration (oral defense)",
    },
    summary: {
      nl: "Een verslag kan een AI schrijven, een verdediging van je eigen keuzes niet. De student haalt uit het geheugen op wat hij of zij deed (ophalen), legt uit waarom (uitleggen en verbinden) en gebruikt de eigen gegevens als concreet voorbeeld. Vage antwoorden worden doorgevraagd, één vraag tegelijk.",
      en: "An AI can write a report, but not a defense of your own choices. The student recalls what they did (retrieval practice), explains why (elaboration) and uses their own data as the concrete example. Vague answers are probed, one question at a time.",
    },
    keyCitations: ["Karpicke & Roediger (2008)", "Weinstein et al. (2018)"],
  },
  attribution: attribution({
    chapterTitle:
      "From Oracle to Socratic Partner: Redesigning Instruction with AI Through the Science of Learning",
    authors: "Andy Van Schaack & Roman Sarlo",
    sourcePages: "Appendix F.3, pp. 350–352",
    evaluatedWith: {
      nl: "Model-agnostisch (Claude, GPT-4, of gelijkwaardig)",
      en: "Model-agnostic (Claude, GPT-4, or equivalent)",
    },
    adapted: true,
    adaptation: {
      nl: "In het boek verdedigt een leerling een titratiepracticum scheikunde tegenover 'Dr. McQuain'. Wij maken het algemeen voor eigen werk in mbo, hbo en wo: een verslag, stage, project, beroepsproduct of practicum. De indicator en het eindpunt worden de ontwerpkeuzes, de eigen gegevens, de foutenbronnen en de conclusie van dat werk. De persona is een deskundige uit het werkveld zonder naam van een bestaand persoon, de duur kiest de docent, en de afsluiting geeft nooit een cijfer. Opbouw, de zes regels, de drie stappen hulp en het weigeren om de verdediging over te slaan blijven. In het Nederlands.",
      en: "In the book a student defends a chemistry titration lab to 'Dr. McQuain'. We make it general for own work in vocational and higher education: a report, internship, project, professional product or lab. The indicator and endpoint become the design choices, own data, sources of error and conclusion of that work. The persona is an expert from the field with no name of a real person, the teacher chooses the length, and the closing never gives a grade. The structure, the six constraints, the three steps of help and the refusal to skip the defense stay. In Dutch.",
    },
  }),
  // Learner tutor: the teacher's context profile seeds the level with the learner register.
  usesContextProfile: true,
  copyableStudentPrompt: true,
  // The teacher reviews the conversation the student hands in (P31.2).
  next: ["defense-review"],
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-5-5",
  defaultMaxTokens: 2048,
  defaultTemperature: 0.7,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "workType",
      label: { nl: "Soort werk", en: "Kind of work" },
      kind: "select",
      required: true,
      defaultValue: "report",
      options: WORK_TYPE_OPTIONS,
      group: WORK,
    },
    {
      name: "subject",
      label: { nl: "Vak of opleiding", en: "Subject or programme" },
      kind: "text",
      required: true,
      placeholder: { nl: "bijv. HBO-ICT, jaar 2", en: "e.g. Software engineering, year 2" },
      group: WORK,
    },
    {
      name: "learningObjective",
      prefillFromCourse: { source: "learningOutcomes" },
      label: { nl: "Leerdoel van de verdediging", en: "Learning objective of the defense" },
      kind: "textarea",
      required: true,
      rows: 3,
      placeholder: {
        nl: "bijv. De student legt de ontwerpkeuzes uit, interpreteert de eigen gegevens en verdedigt de conclusie met bewijs.",
        en: "e.g. The student explains the design choices, interprets their own data and defends the conclusion with evidence.",
      },
      group: WORK,
    },
    {
      name: "focusAreas",
      label: {
        nl: "Welke keuzes moet de student kunnen verdedigen? (optioneel)",
        en: "Which choices must the student be able to defend? (optional)",
      },
      kind: "textarea",
      rows: 2,
      placeholder: {
        nl: "bijv. De keuze voor interviews in plaats van een enquête.",
        en: "e.g. The choice for interviews instead of a survey.",
      },
      group: DEFENSE,
    },
    {
      name: "durationMinutes",
      label: { nl: "Duur in minuten", en: "Length in minutes" },
      kind: "number",
      defaultValue: 15,
      min: 5,
      max: 45,
      step: 5,
      group: DEFENSE,
    },
    {
      // BESLUIT-2026-11-07-3: a few figures, never the report itself, to probe more sharply.
      name: "askKeyFigures",
      label: {
        nl: "Student plakt eerst de kerncijfers",
        en: "Student first pastes the key figures",
      },
      kind: "boolean",
      defaultValue: false,
      help: {
        nl: "De tutor vraagt na de opening om een paar cijfers of bevindingen uit het eigen werk, zonder namen, en vraagt daarop scherper door. Nooit het verslag zelf.",
        en: "After the opening the tutor asks for a few figures or findings from the student's own work, without names, and probes more sharply on them. Never the report itself.",
      },
      group: DEFENSE,
    },
  ],
  stages: [
    {
      id: "defense",
      name: { nl: "Mondelinge verdediging", en: "Oral defense" },
      description: {
        nl: "Een deskundige uit het werkveld vraagt door op je keuzes, je gegevens en je conclusie.",
        en: "An expert from the field probes your choices, your data and your conclusion.",
      },
      systemPromptId: DEFEND_YOUR_WORK_PROMPT_V3.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Een gesprek van één vraag tegelijk, zonder cijfer.",
          en: "A conversation of one question at a time, without a grade.",
        },
      },
    },
  ],
  chat: {
    greeting: {
      nl: "Goedendag. Ik ben een ervaren collega uit het werkveld en ik neem je mondelinge verdediging af. Dat is gewoon in het vak: je werk uitleggen aan een collega voordat het af is. Ik probeer je niet te betrappen, ik wil horen hoe je denkt. Vertel eerst in één of twee zinnen: wat was het doel van je werk?",
      en: "Hello. I'm an experienced colleague from the field and I'll be taking your oral defense. That's standard practice: explaining your work to a colleague before it's finished. I'm not trying to trick you, I want to hear how you think. First, in one or two sentences: what was the purpose of your work?",
    },
    starters: [
      {
        nl: "Het doel van mijn werk was…",
        en: "The purpose of my work was…",
      },
      {
        nl: "Ik vind dit spannend. Kunnen we rustig beginnen?",
        en: "I find this nerve-racking. Can we start slowly?",
      },
    ],
    allowStop: true,
    allowRegenerate: true,
    // Meting dyw3: in a long chat the tutor drifted to two questions and praised vague answers.
    turnReminder: {
      nl: "Herinnering voor deze beurt: hooguit twee korte zinnen reactie, dan één vraag. Precies één vraagteken in je beurt, aan het eind, en geen tweede vraag na “, en” of “, of”. Is het antwoord vaag, prijs het dan niet, maar vraag eerst om het concreet te maken. Leg niet uit wat de student zelf moet zeggen.",
      en: "Reminder for this turn: at most two short sentences of reaction, then one question. Exactly one question mark in your turn, at the end, and no second question after “, and” or “, or”. If the answer is vague, don't praise it, but first ask to make it specific. Don't explain what the student should say themselves.",
    },
  },
};
