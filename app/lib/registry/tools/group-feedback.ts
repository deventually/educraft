import type { Tool } from "../types";
import { GROUP_FEEDBACK_PROMPT } from "~/lib/prompts/group-feedback@v1.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";
import { DEFAULT_MODEL } from "~/lib/ai/models";

const GROUP = { nl: "De groep", en: "The group" };

/**
 * Groepsfeedback maken — brief P36, 36.2. An original LimeOnIt tool: one debrief for the whole
 * group after marking, from counts made in code (the rubric's "Hoe ging de groep", P36.1, or the
 * test analysis). The stage's guard drops any number in digits that is not in the input, so a
 * count never comes from the model. Example fragments are anonymised in the browser first.
 */
export const groupFeedback: Tool = {
  id: "group-feedback",
  slug: "group-feedback",
  name: { nl: "Groepsfeedback maken", en: "Make group feedback" },
  subtitle: {
    nl: "Eén nabespreking voor de hele groep na het nakijken",
    en: "One debrief for the whole group after marking",
  },
  tagline: {
    nl: "Maak uit de tellingen van je rubric of toetsanalyse een nabespreking: de drie tot vijf meest voorkomende problemen, hoe goed werk eruitziet, een oefening van tien minuten en een tekst voor de groep. De AI telt niets zelf.",
    en: "Turn the counts of your rubric or test analysis into a debrief: the three to five most common problems, what good work looks like, a ten-minute exercise and a text for the group. The AI counts nothing itself.",
  },
  icon: "users-round",
  userType: "instructor",
  // Example fragments are student work: never in a shared view (P28.4).
  handlesStudentWork: true,
  mode: "one-shot",
  theory: {
    name: { nl: "Feedforward", en: "Feedforward" },
    summary: {
      nl: "Feedback helpt het meest als die zegt waar de student naartoe werkt, hoe het werk er nu voor staat en wat de volgende stap is (Hattie & Timperley, 2007). Een nabespreking voor de hele groep richt zich op wat veel werken gemeen hadden en laat zien hoe goed werk eruitziet, in plaats van een oordeel over personen.",
      en: "Feedback helps most when it says where the student is going, how the work stands now and what the next step is (Hattie & Timperley, 2007). A debrief for the whole group focuses on what many pieces of work had in common and shows what good work looks like, rather than judging persons.",
    },
    keyCitations: ["Hattie & Timperley (2007)"],
  },
  attribution: originalAttribution({
    source: {
      nl: "Origineel LimeOnIt-instrument (brief P36), naar het feedbackmodel van Hattie en Timperley (2007).",
      en: "Original LimeOnIt instrument (brief P36), after the feedback model of Hattie and Timperley (2007).",
    },
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: DEFAULT_MODEL,
  defaultMaxTokens: 4096,
  defaultTemperature: 0.4,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "groupSummary",
      label: { nl: "Hoe ging de groep", en: "How the group did" },
      kind: "textarea",
      required: true,
      rows: 8,
      placeholder: {
        nl: "Ronde 2026-11, 12 werken, beoordeeld met de rubric.\n- Bronnen: 7 van 12 op het laagste niveau (58%). Niveaus: Onvoldoende 7, Voldoende 3, Goed 2.",
        en: "Round 2026-11, 12 pieces of work, marked with the rubric.\n- Sources: 7 of 12 on the lowest level (58%). Levels: Insufficient 7, Sufficient 3, Good 2.",
      },
      help: {
        nl: 'Klik op de rubricpagina onder "Hoe ging de groep" op "Groepsfeedback maken", of plak de uitkomsten van de toetsanalyse. Alleen tellingen, geen namen.',
        en: 'On the rubric page, click "Make group feedback" under "How the group did", or paste the results of the test analysis. Counts only, no names.',
      },
      group: GROUP,
    },
    {
      name: "examples",
      label: { nl: "Voorbeeldfouten (optioneel)", en: "Example mistakes (optional)" },
      kind: "textarea",
      rows: 4,
      redact: true,
      placeholder: {
        nl: "bijv. Bij de grafiek staat geen bron. / De conclusie herhaalt de inleiding.",
        en: "e.g. The chart has no source. / The conclusion repeats the introduction.",
      },
      help: {
        nl: "Korte fragmenten of je eigen omschrijving. Namen worden in je browser vervangen voordat er iets wordt verstuurd. De tool neemt ze nooit over als voorbeeld van goed werk.",
        en: "Short fragments or your own description. Names are replaced in your browser before anything is sent. The tool never uses them as an example of good work.",
      },
      group: GROUP,
    },
    {
      name: "assignment",
      label: { nl: "De opdracht of toets (optioneel)", en: "The assignment or test (optional)" },
      kind: "textarea",
      rows: 2,
      prefillFromCourse: { source: "itemTitle" },
      placeholder: {
        nl: "bijv. Onderzoeksverslag marktanalyse, jaar 2",
        en: "e.g. Market analysis research report, year 2",
      },
      group: GROUP,
    },
  ],
  stages: [
    {
      id: "debrief",
      name: { nl: "Nabespreking", en: "Debrief" },
      description: {
        nl: "De meest voorkomende problemen met aantallen, hoe goed werk eruitziet, een oefening en een tekst voor de groep.",
        en: "The most common problems with counts, what good work looks like, an exercise and a text for the group.",
      },
      systemPromptId: GROUP_FEEDBACK_PROMPT.id,
      output: {
        kind: "markdown",
        exportAs: "document",
        // A count is LimeOnIt's, never the model's (brief P36, principle 2).
        guard: "input-numbers",
        hint: {
          nl: "Een nabespreking over het werk van de groep, niet over een bepaalde student.",
          en: "A debrief about the work of the group, not about a particular student.",
        },
      },
    },
  ],
};
