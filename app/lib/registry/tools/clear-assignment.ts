import type { Tool } from "../types";
import { CLEAR_ASSIGNMENT_PROMPT } from "~/lib/prompts/clear-assignment@v1.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";

const TEXT = { nl: "Je opdracht", en: "Your assignment" };
const READER = { nl: "Voor de student", en: "For the student" };

/**
 * Opdracht helder schrijven — brief P24, 24.6. An original LimeOnIt tool: rewrites an
 * assignment brief or student guide at a chosen CEFR reading level (Council of Europe,
 * 2020), structured after the UDL Guidelines 3.0 (CAST, 2024), with open points and a
 * requirement check. Content and requirements stay the same: none disappears or is added.
 */
export const clearAssignment: Tool = {
  id: "clear-assignment",
  slug: "clear-assignment",
  name: { nl: "Opdracht helder schrijven", en: "Write a clear assignment" },
  subtitle: {
    nl: "Opdracht of handleiding op taalniveau B1, met open punten",
    en: "Assignment or guide at reading level B1, with open points",
  },
  tagline: {
    nl: "Herschrijf je opdrachtomschrijving of studentenhandleiding in heldere taal, met stappen, eisen en inleverinfo. De eisen blijven gelijk, en je ziet wat er nog ontbreekt.",
    en: "Rewrite your assignment brief or student guide in plain language, with steps, requirements and submission info. The requirements stay the same, and you see what is still missing.",
  },
  icon: "file-pen-line",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: {
      nl: "Taalniveaus (ERK) en Universal Design for Learning",
      en: "Reading levels (CEFR) and Universal Design for Learning",
    },
    summary: {
      nl: "Het Europees Referentiekader beschrijft per niveau (A1–C2) wat een lezer kan begrijpen; op B1 begrijpt een lezer eenvoudige, feitelijke teksten over onderwerpen uit het eigen vak- of interessegebied (Council of Europe, 2020). De UDL-richtlijnen 3.0 vragen onder meer om het doel van een opdracht te verhelderen, vaktaal uit te leggen en informatie te ordenen, zodat de opdracht voor zoveel mogelijk studenten toegankelijk is (CAST, 2024).",
      en: "The Common European Framework of Reference describes per level (A1–C2) what a reader can understand; at B1 a reader can read straightforward factual texts on subjects related to their field of interest (Council of Europe, 2020). The UDL Guidelines 3.0 ask, among other things, to clarify the purpose of a task, explain vocabulary and organize information, so the assignment is accessible to as many students as possible (CAST, 2024).",
    },
    keyCitations: ["Council of Europe (2020)", "CAST (2024)"],
  },
  attribution: originalAttribution({
    source: {
      nl: "Origineel LimeOnIt-instrument, met taalniveaus naar het ERK (Council of Europe, 2020) en de opbouw naar de UDL-richtlijnen 3.0 (CAST, 2024).",
      en: "Original LimeOnIt instrument, with reading levels after the CEFR (Council of Europe, 2020) and the structure after the UDL Guidelines 3.0 (CAST, 2024).",
    },
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-5-5",
  defaultMaxTokens: 12288,
  defaultTemperature: 0.3,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "assignment",
      label: {
        nl: "Opdrachtomschrijving of studentenhandleiding",
        en: "Assignment brief or student guide",
      },
      kind: "document",
      required: true,
      rows: 12,
      placeholder: {
        nl: "Upload de Word of PDF, of plak hier de volledige tekst van de opdracht, met eisen, criteria en inleverinfo.",
        en: "Upload the Word or PDF file, or paste the full text of the assignment here, with requirements, criteria and submission info.",
      },
      help: {
        nl: "Plak de hele tekst, ook de rubric en de inleverinfo: de tool controleert of elke eis in de nieuwe versie terugkomt.",
        en: "Paste the whole text, including the rubric and the submission info: the tool checks that every requirement returns in the new version.",
      },
      group: TEXT,
    },
    {
      name: "keepAsIs",
      label: {
        nl: "Wat letterlijk moet blijven (optioneel)",
        en: "What must stay word for word (optional)",
      },
      kind: "textarea",
      rows: 2,
      placeholder: {
        nl: "bijv. vaktermen die studenten moeten leren, zoals 'plan van aanpak' en 'deelvraag'.",
        en: "e.g. terms students must learn, such as 'project plan' and 'sub-question'.",
      },
      group: TEXT,
    },
    {
      name: "readingLevel",
      label: { nl: "Taalniveau (ERK)", en: "Reading level (CEFR)" },
      kind: "select",
      required: true,
      defaultValue: "B1",
      options: [
        { value: "A2", label: { nl: "A2 — heel eenvoudig", en: "A2 — very simple" } },
        { value: "B1", label: { nl: "B1 — eenvoudig (standaard)", en: "B1 — simple (default)" } },
        { value: "B2", label: { nl: "B2 — gemiddeld", en: "B2 — intermediate" } },
        { value: "C1", label: { nl: "C1 — gevorderd", en: "C1 — advanced" } },
      ],
      help: {
        nl: "B1 is eenvoudige, heldere taal. Kies B2 of C1 als de vaktaal zelf deel van het leren is.",
        en: "B1 is simple, plain language. Choose B2 or C1 when the subject language itself is part of the learning.",
      },
      group: READER,
    },
    {
      name: "audience",
      label: {
        nl: "Voor wie is de opdracht? (optioneel)",
        en: "Who is the assignment for? (optional)",
      },
      kind: "textarea",
      rows: 2,
      placeholder: {
        nl: "bijv. Eerstejaars, veel studenten met Nederlands als tweede taal.",
        en: "e.g. First-year students, many with English as an additional language.",
      },
      group: READER,
    },
  ],
  stages: [
    {
      id: "rewrite",
      name: { nl: "Herschreven opdracht", en: "Rewritten assignment" },
      systemPromptId: CLEAR_ASSIGNMENT_PROMPT.id,
      output: {
        kind: "structured-sections",
        hint: {
          nl: "De herschreven opdracht met stappen, eisen en inleverinfo, de open punten, wat er is veranderd en een eisencheck.",
          en: "The rewritten assignment with steps, requirements and submission info, the open points, what was changed and a requirement check.",
        },
      },
    },
  ],
};
