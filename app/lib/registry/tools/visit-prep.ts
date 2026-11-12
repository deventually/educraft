import type { Tool } from "../types";
import { VISIT_PREP_PROMPT_V2 } from "~/lib/prompts/visit-prep@v2.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";
import { DEFAULT_MODEL } from "~/lib/ai/models";

const VISIT = { nl: "Het bezoek", en: "The visit" };

/**
 * Bezoek voorbereiden — brief P38.6. Questions for a workplace visit per criterion of the
 * track's assessment model, for the student and the workplace supervisor. Only the criteria go
 * in: nothing about the student. Opened from a track's Visits tab, or from the catalogue.
 */
export const visitPrep: Tool = {
  id: "visit-prep",
  slug: "visit-prep",
  name: { nl: "Bezoek voorbereiden", en: "Prepare a visit" },
  subtitle: {
    nl: "Vragen voor een stagebezoek of het eindgesprek, per criterium",
    en: "Questions for an internship visit or the final interview, per criterion",
  },
  tagline: {
    nl: "Vragen voor de student en de praktijkbegeleider, per criterium van je beoordelingsmodel, en de afspraken om te maken.",
    en: "Questions for the student and the workplace supervisor, per criterion of your assessment model, and the agreements to make.",
  },
  icon: "map-pin",
  userType: "instructor",
  // The student's presentation can go in (redacted) for the final interview.
  handlesStudentWork: true,
  mode: "one-shot",
  theory: {
    name: { nl: "Criteriumgericht begeleiden", en: "Criterion-referenced supervision" },
    summary: {
      nl: "Een bezoek levert meer op als de vragen aansluiten op de criteria waarop het werk straks beoordeeld wordt: dan zien student, praktijkbegeleider en docent hetzelfde doel.",
      en: "A visit yields more when the questions follow the criteria the work will be assessed on: student, workplace supervisor and teacher then see the same goal.",
    },
    keyCitations: [],
  },
  attribution: originalAttribution({
    source: {
      nl: "Origineel LimeOnIt-instrument (brief P38), op basis van het beoordelingsmodel van de docent.",
      en: "Original LimeOnIt instrument (brief P38), based on the teacher's assessment model.",
    },
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: DEFAULT_MODEL,
  defaultMaxTokens: 3072,
  defaultTemperature: 0.4,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "criteria",
      label: { nl: "Criteria", en: "Criteria" },
      kind: "textarea",
      required: true,
      rows: 8,
      prefillFromTrack: { source: "criteria" },
      placeholder: {
        nl: "Plak de criteria uit je beoordelingsmodel.",
        en: "Paste the criteria from your assessment model.",
      },
      help: {
        nl: "Vanuit een traject staan hier de criteria van het gekoppelde beoordelingsmodel. Alleen de criteria gaan naar de AI, en bij het eindgesprek eventueel de presentatie, zonder namen.",
        en: "From a track, the criteria of the linked assessment model are filled in here. Only the criteria go to the AI and, for the final interview, the presentation, without names.",
      },
      group: VISIT,
    },
    {
      name: "moment",
      label: { nl: "Moment van het bezoek", en: "Moment of the visit" },
      kind: "select",
      required: true,
      defaultValue: "midway",
      options: [
        { value: "start", label: { nl: "Kort na de start", en: "Shortly after the start" } },
        { value: "midway", label: { nl: "Halverwege", en: "Halfway" } },
        { value: "final", label: { nl: "Tegen het einde", en: "Near the end" } },
        {
          value: "final-interview",
          label: {
            nl: "Eindgesprek: assessment na de presentatie",
            en: "Final interview: assessment after the presentation",
          },
        },
      ],
      // Opened from the track's Final interview tab, the final interview is chosen.
      prefillFromTrack: { source: "milestone" },
      group: VISIT,
    },
    {
      name: "interviewSetup",
      label: {
        nl: "Opzet van het eindgesprek (optioneel)",
        en: "Setup of the final interview (optional)",
      },
      kind: "textarea",
      required: false,
      rows: 3,
      prefillFromTrack: { source: "interviewSetup" },
      placeholder: {
        nl: "bijv. Assessment op de stageplek na de presentatie, over de realisatie (de tweede helft van de stage). De presentatie levert de student vooraf in.",
        en: "e.g. Assessment at the workplace after the presentation, about the realisation (the second half of the internship). The student hands in the presentation beforehand.",
      },
      help: {
        nl: "Hoe het eindgesprek bij jouw opleiding gaat. Alleen bij het eindgesprek. Leg het één keer vast bij je beoordelingsmodel, dan staat het vanuit een traject al ingevuld.",
        en: "How the final interview goes in your programme. Only for the final interview. Keep it once with your assessment model, and a track fills it in.",
      },
      group: VISIT,
    },
    {
      name: "presentation",
      redact: true,
      label: {
        nl: "Presentatie van de student (optioneel)",
        en: "The student's presentation (optional)",
      },
      kind: "document",
      required: false,
      rows: 6,
      placeholder: {
        nl: "Upload de presentatie als PDF (in PowerPoint: Opslaan als PDF), of plak de tekst van de dia's.",
        en: "Upload the presentation as PDF (in PowerPoint: Save as PDF), or paste the text of the slides.",
      },
      help: {
        nl: "Alleen bij het eindgesprek. Het bestand wordt in je browser gelezen en je controleert of er nog namen in staan; het origineel gaat nooit mee.",
        en: "Only for the final interview. The file is read in your browser and you check whether names are still in it; the original never goes along.",
      },
      group: VISIT,
    },
  ],
  stages: [
    {
      id: "questions",
      name: { nl: "Vragen voor het bezoek", en: "Questions for the visit" },
      systemPromptId: VISIT_PREP_PROMPT_V2.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Per criterium vragen aan de student en de praktijkbegeleider, en de afspraken.",
          en: "Per criterion questions to the student and the workplace supervisor, and the agreements.",
        },
      },
    },
  ],
};
