import type { Tool } from "../types";
import { VISIT_PREP_PROMPT } from "~/lib/prompts/visit-prep@v1.prompt";
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
    nl: "Vragen voor een stagebezoek, per criterium",
    en: "Questions for an internship visit, per criterion",
  },
  tagline: {
    nl: "Vragen voor de student en de praktijkbegeleider, per criterium van je beoordelingsmodel, en de afspraken om te maken.",
    en: "Questions for the student and the workplace supervisor, per criterion of your assessment model, and the agreements to make.",
  },
  icon: "map-pin",
  userType: "instructor",
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
        nl: "Vanuit een traject staan hier de criteria van het gekoppelde beoordelingsmodel. Alleen de criteria gaan naar de AI, niets over de student.",
        en: "From a track, the criteria of the linked assessment model are filled in here. Only the criteria go to the AI, nothing about the student.",
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
      ],
      group: VISIT,
    },
  ],
  stages: [
    {
      id: "questions",
      name: { nl: "Vragen voor het bezoek", en: "Questions for the visit" },
      systemPromptId: VISIT_PREP_PROMPT.id,
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
