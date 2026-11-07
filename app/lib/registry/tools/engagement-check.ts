import type { Tool } from "../types";
import { ENGAGEMENT_CHECK_PROMPT } from "~/lib/prompts/engagement-check@v1.prompt";
import { attribution } from "~/lib/prompts/attribution";

/**
 * De leercheck — brief P31.3. Rates an assignment, lesson or activity on the six principles
 * of the book's Appendix G rubric (Van Schaack & Sarlo, pp. 355–356). The AI picks a level
 * and a reason per principle; the score out of 18 is computed in code
 * (`output.computed`), never by the AI.
 */
export const engagementCheck: Tool = {
  id: "engagement-check",
  slug: "engagement-check",
  name: { nl: "Hoe actief leren je studenten?", en: "How actively do your students learn?" },
  subtitle: {
    nl: "Leercheck met zes leerprincipes",
    en: "Engagement check with six learning principles",
  },
  tagline: {
    nl: "Plak je opdracht of lesopzet en zie per leerprincipe hoe actief studenten leren, met een reden, een score en twee à drie verbeteringen voor deze opdracht.",
    en: "Paste your assignment or lesson plan and see per learning principle how actively students learn, with a reason, a score and two or three improvements for this assignment.",
  },
  icon: "gauge",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: {
      nl: "Science of Learning: Cognitive Engagement Rubric",
      en: "Science of Learning: Cognitive Engagement Rubric",
    },
    summary: {
      nl: "De rubric uit bijlage G van Van Schaack & Sarlo beschrijft zes leerprincipes (ophalen uit het geheugen, gespreid oefenen, afwisselen, woord en beeld, concrete voorbeelden, uitleggen en verbinden), elk met vier niveaus van Afwezig (0) tot Hoog (3). Samen geven ze aan hoeveel actief denkwerk een activiteit van studenten vraagt.",
      en: "The rubric in Appendix G of Van Schaack & Sarlo describes six learning principles (retrieval practice, spaced practice, interleaving, dual coding, concrete examples, elaboration), each with four levels from Absent (0) to High (3). Together they show how much active cognitive work an activity asks of students.",
    },
    keyCitations: ["Van Schaack & Sarlo (2026)"],
  },
  attribution: attribution({
    chapterTitle:
      "From Oracle to Socratic Partner: Redesigning Instruction with AI Through the Science of Learning",
    authors: "Andy Van Schaack & Roman Sarlo",
    sourcePages: "Appendix G, pp. 355–356",
    evaluatedWith: {
      nl: "Model-agnostisch (Claude, GPT-4, of gelijkwaardig)",
      en: "Model-agnostic (Claude, GPT-4, or equivalent)",
    },
    adapted: true,
    adaptation: {
      nl: "Het boek geeft een rubric, geen prompt. Wij maken er een losse check van: de AI kiest per principe een niveau uit de rubric met een reden uit de opdracht, en geeft twee à drie verbeteringen. Het totaal en het percentage rekent LimeOnIt zelf uit, niet de AI. De definities blijven letterlijk het Engels van het boek.",
      en: "The book gives a rubric, not a prompt. We turn it into a stand-alone check: the AI picks a level from the rubric per principle with a reason from the assignment, and gives two or three improvements. LimeOnIt computes the total and the percentage itself, not the AI. The definitions stay the book's English, word for word.",
    },
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  next: ["cognitive-architect", "differentiation"],
  courseActions: ["activity"],
  defaultModel: "claude-sonnet-5-5",
  defaultMaxTokens: 4096,
  defaultTemperature: 0.2,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "activity",
      label: { nl: "Je opdracht, les of activiteit", en: "Your assignment, lesson or activity" },
      kind: "document",
      required: true,
      rows: 10,
      placeholder: {
        nl: "Upload de Word of PDF, of plak hier de opdracht of lesopzet zoals studenten die krijgen.",
        en: "Upload the Word or PDF file, or paste the assignment or lesson plan here as students get it.",
      },
      help: {
        nl: "Alleen wat in de tekst staat telt mee. Wat je in de les nog doet, schrijf je er even bij.",
        en: "Only what is in the text counts. Add briefly what you also do in class.",
      },
    },
    {
      name: "learningObjective",
      prefillFromCourse: { source: "learningOutcomes" },
      label: { nl: "Leerdoel (optioneel)", en: "Learning objective (optional)" },
      kind: "textarea",
      rows: 2,
      placeholder: {
        nl: "bijv. De student legt de keuzes in de proefopzet uit en verdedigt de conclusie.",
        en: "e.g. The student explains the choices in the experimental design and defends the conclusion.",
      },
    },
  ],
  stages: [
    {
      id: "check",
      name: { nl: "Leercheck", en: "Engagement check" },
      systemPromptId: ENGAGEMENT_CHECK_PROMPT.id,
      output: {
        kind: "markdown",
        exportAs: "table",
        computed: "engagement-index",
        hint: {
          nl: "Per leerprincipe een niveau met een reden, de score (berekend door LimeOnIt) en twee à drie verbeteringen.",
          en: "A level with a reason per learning principle, the score (computed by LimeOnIt) and two or three improvements.",
        },
      },
    },
  ],
};
