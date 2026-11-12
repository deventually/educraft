import type { Tool } from "../types";
import { VISIT_REPORT_PROMPT } from "~/lib/prompts/visit-report@v1.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";
import { DEFAULT_MODEL } from "~/lib/ai/models";

const VISIT = { nl: "Het bezoek", en: "The visit" };

/**
 * Verslag uit steekwoorden — brief P38.6. A visit report from the teacher's notes, after the
 * name check in the browser. Nothing is kept (`storesConversation: false`): the report leaves
 * through Word or the clipboard; the track keeps only the date. Opened from a track or the catalogue.
 */
export const visitReport: Tool = {
  id: "visit-report",
  slug: "visit-report",
  name: { nl: "Verslag uit steekwoorden", en: "Report from notes" },
  subtitle: {
    nl: "Een bezoekverslag, niet bewaard",
    en: "A visit report, not kept",
  },
  tagline: {
    nl: "Maak van je steekwoorden een kort bezoekverslag om in OnStage of een e-mail te plakken. Namen gaan er eerst uit; LimeOnIt bewaart het verslag niet.",
    en: "Turn your notes into a short visit report to paste into OnStage or an e-mail. Names go first; LimeOnIt does not keep the report.",
  },
  icon: "notebook-pen",
  userType: "instructor",
  mode: "one-shot",
  // Notes about a student: never in a shared view, and never kept.
  handlesStudentWork: true,
  storesConversation: false,
  theory: {
    name: { nl: "Verslaglegging", en: "Reporting" },
    summary: {
      nl: "Een kort verslag kort na het bezoek, met afspraken (wie, wat, wanneer), maakt het volgende gesprek makkelijker. Het verslag geeft weer wat er besproken is, geen oordeel.",
      en: "A short report soon after the visit, with agreements (who, what, when), makes the next conversation easier. The report records what was discussed, not a judgement.",
    },
    keyCitations: [],
  },
  attribution: originalAttribution({
    source: {
      nl: "Origineel LimeOnIt-instrument (brief P38).",
      en: "Original LimeOnIt instrument (brief P38).",
    },
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: DEFAULT_MODEL,
  defaultMaxTokens: 2048,
  defaultTemperature: 0.2,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "notes",
      redact: true,
      label: { nl: "Je steekwoorden", en: "Your notes" },
      kind: "textarea",
      required: true,
      rows: 10,
      placeholder: {
        nl: "bijv. - plan loopt, week 6 eerste versie product\n- begeleider tevreden over overleg\n- zorg: planning testfase\n- afspraak: [STUDENT] stuurt planning vóór vrijdag",
        en: "e.g. - plan on track, week 6 first version of the product\n- supervisor happy with meetings\n- concern: test phase planning\n- agreement: [STUDENT] sends planning before Friday",
      },
      help: {
        nl: "Je controleert hierna in je browser of er nog namen in staan. Het verslag wordt niet bewaard: kopieer het of download het als Word.",
        en: "You check in your browser afterwards whether names are still in there. The report is not kept: copy it or download it as Word.",
      },
      group: VISIT,
    },
    {
      name: "criteria",
      label: { nl: "Criteria (optioneel)", en: "Criteria (optional)" },
      kind: "textarea",
      required: false,
      rows: 5,
      prefillFromTrack: { source: "criteria" },
      help: {
        nl: "Vanuit een traject staan hier de criteria van het gekoppelde beoordelingsmodel; het verslag zet ze bij wat er goed gaat en wat aandacht vraagt.",
        en: "From a track, the criteria of the linked assessment model are filled in here; the report puts them with what goes well and what needs attention.",
      },
      group: VISIT,
    },
  ],
  stages: [
    {
      id: "report",
      name: { nl: "Bezoekverslag", en: "Visit report" },
      systemPromptId: VISIT_REPORT_PROMPT.id,
      output: {
        kind: "markdown",
        hint: {
          nl: "Verloop, wat goed gaat, aandachtspunten en afspraken; alleen uit je steekwoorden.",
          en: "Course, what goes well, points of attention and agreements; only from your notes.",
        },
      },
    },
  ],
};
