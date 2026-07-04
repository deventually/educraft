import type { Tool } from "../types";
import { STAGE_ASSESSMENT_PROMPT } from "~/lib/prompts/stage-assessment@v1.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";
import hboiNakijkmodel from "./presets/hbo-i-stage-nakijkmodel.md?raw";

const DOC = { nl: "Document", en: "Document" };
const CONTEXT = { nl: "Context", en: "Context" };
const FRAMEWORK = { nl: "Beoordelingskader", en: "Assessment framework" };

const SCALE_DEFAULT = `Schaal: Onvoldoende (O) = 0 punten · Voldoende (V) = 6 punten · Goed (G) = 10 punten.
Slaagregel: zodra één onderdeel/succescriterium Onvoldoende is, is het eindresultaat Onvoldoende (geen middeling).
HBO-i stage: Analyseren wordt beoordeeld met O/V/G, Realiseren met een afgerond cijfer; beide wegen 50%. Voor een voldoende stage is het eindcijfer minimaal 6, is het stagedossier compleet en is geen enkel onderdeel Onvoldoende.
Vervang deze schaal door die van je eigen opleiding indien je een andere studie beoordeelt.`;

/**
 * Stage- & afstudeerbeoordeling — an original LimeOnIt instrument.
 *
 * Deep, locale-neutral engine; everything programme-specific lives in the
 * editable `assessmentFramework` + `assessmentScale` inputs (HBO-i nakijkmodel
 * ships as the default, replaceable for any study). No control-flow branching:
 * capability grows by swapping the framework data, not the engine.
 */
export const stageAssessment: Tool = {
  id: "stage-assessment",
  slug: "stage-assessment",
  name: {
    nl: "Beoordelingsassistent — stage & afstuderen",
    en: "Assessment assistant — internship & thesis",
  },
  tagline: {
    nl: "Concept-beoordeling en feedback op stage- en afstudeerdocumenten tegen jouw nakijkmodel; de docent beslist.",
    en: "Draft assessment and feedback on internship/thesis documents against your rubric; the teacher decides.",
  },
  icon: "clipboard-check",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: {
      nl: "Criteriumgericht beoordelen & effectieve feedback",
      en: "Criterion-referenced assessment & effective feedback",
    },
    summary: {
      nl: "Beoordeling tegen expliciete succescriteria (Single Point Rubric) gecombineerd met constructieve, op verbetering gerichte feedback. De AI levert een onderbouwd concept; de examinator beslist.",
      en: "Assessment against explicit success criteria (Single Point Rubric) combined with constructive, improvement-focused feedback. The AI drafts evidence-based advice; the examiner decides.",
    },
    keyCitations: [
      "Hattie & Timperley (2007)",
      "Sadler (1989)",
      "Jonsson & Svingby (2007)",
      "HBO-i domeinbeschrijving (niveau 2)",
    ],
  },
  attribution: originalAttribution({
    source: {
      nl: "Origineel LimeOnIt-instrument; standaardkader gebaseerd op het stage-nakijkmodel van de opleiding Informatica (HBO-i).",
      en: "Original LimeOnIt instrument; default framework based on the Informatica internship rubric (HBO-i).",
    },
    evaluatedWith: { nl: "Claude Sonnet 4.6", en: "Claude Sonnet 4.6" },
  }),
  usesContextProfile: true,
  assistiveGrading: true,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-4-6",
  defaultMaxTokens: 8192,
  defaultTemperature: 0.3,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "document",
      label: { nl: "Te beoordelen document", en: "Document to assess" },
      kind: "document",
      required: true,
      rows: 12,
      placeholder: {
        nl: "Upload de PDF of Word, of plak hier de volledige tekst van het stageverslag, onderzoeksverslag of portfolio.",
        en: "Upload the PDF or Word file, or paste the full text of the internship report, research report or portfolio here.",
      },
      help: {
        nl: "Upload het bestand (PDF of Word) — de tekst verschijnt hieronder en je kunt hem nog bijwerken. Of plak de tekst zelf. Je kunt meerdere bestanden tegelijk selecteren (bijv. onderzoeksverslag + beroepsproduct voor een geheel portfolio); de teksten worden samengevoegd. Tabellen en figuren gaan verloren; upload kernfiguren los hieronder.",
        en: "Upload the file (PDF or Word) — the text appears below for you to review and edit. Or paste it yourself. You can select multiple files at once (e.g. research report + work product for a whole portfolio); their texts are merged. Tables and figures are lost; upload key figures separately below.",
      },
      group: DOC,
    },
    {
      name: "figures",
      label: { nl: "Kernfiguren (optioneel)", en: "Key figures (optional)" },
      kind: "image",
      required: false,
      accept: "image/png,image/jpeg",
      placeholder: {
        nl: "Upload eventueel belangrijke figuren (organogram, ontwerp, diagram) als afbeelding.",
        en: "Optionally upload important figures (org chart, design, diagram) as images.",
      },
      help: {
        nl: "Tekst-only beoordeling mist figuren. Upload hier de figuren die het oordeel raken (max. 10).",
        en: "A text-only assessment misses figures. Upload the figures that affect the judgement here (max. 10).",
      },
      group: DOC,
    },
    {
      name: "documentType",
      label: { nl: "Type document", en: "Document type" },
      kind: "select",
      required: true,
      defaultValue: "stageverslag",
      options: [
        { value: "stageverslag", label: { nl: "Stageverslag", en: "Internship report" } },
        { value: "onderzoeksverslag", label: { nl: "Onderzoeksverslag", en: "Research report" } },
        { value: "stageplan", label: { nl: "Stageplan", en: "Internship plan" } },
        {
          value: "portfolio",
          label: { nl: "Onderzoeksportfolio (geheel)", en: "Research portfolio (whole)" },
        },
        { value: "afstudeerscriptie", label: { nl: "Afstudeerscriptie", en: "Thesis" } },
        { value: "overig", label: { nl: "Overig", en: "Other" } },
      ],
      help: {
        nl: "Kies 'Onderzoeksportfolio (geheel)' om zowel het onderzoeksverslag (Analyseren) als het beroepsproduct/de realisatie (Realiseren) samen te beoordelen — upload of plak dan beide documenten. De overige typen beoordelen één onderdeel.",
        en: "Choose 'Research portfolio (whole)' to assess both the research report (Analyseren) and the work product/realisation (Realiseren) together — then upload or paste both documents. The other types assess a single component.",
      },
      group: CONTEXT,
    },
    {
      name: "track",
      label: { nl: "Richting / specialisatie", en: "Track / specialisation" },
      kind: "text",
      required: false,
      placeholder: { nl: "bijv. Software, UX of Data", en: "e.g. Software, UX or Data" },
      help: {
        nl: "Bepaalt welke richtingvariant van de succescriteria geldt (laat leeg indien niet van toepassing).",
        en: "Determines which track variant of the success criteria applies (leave empty if not applicable).",
      },
      group: CONTEXT,
    },
    {
      name: "studyYear",
      label: { nl: "Studiejaar", en: "Study year" },
      kind: "number",
      required: true,
      min: 1,
      max: 6,
      defaultValue: 3,
      // Copied straight from the teaching context's study year when one is selected.
      prefillFromProfile: { source: "studyYear" },
      group: CONTEXT,
    },
    {
      name: "durationWeeks",
      label: { nl: "Duur van de stage (weken)", en: "Internship duration (weeks)" },
      kind: "number",
      required: true,
      min: 1,
      max: 52,
      defaultValue: 20,
      group: CONTEXT,
    },
    {
      name: "submissionNotes",
      label: {
        nl: "Toelichting bij deze inzending (optioneel)",
        en: "Notes about this submission (optional)",
      },
      kind: "textarea",
      required: false,
      rows: 4,
      placeholder: {
        nl: "Bijv.: alleen het onderzoeksverslag en stageverslag worden nu beoordeeld; deze worden in de eerste helft van de stage ingeleverd. Het beroepsproduct (de realisatie) volgt daarna en wordt apart via de eindpresentatie beoordeeld — beoordeel dat onderdeel nu dus niet.",
        en: "E.g.: only the research report and internship report are assessed now; these are handed in during the first half. The work product (realisation) follows afterwards and is graded separately via the final presentation — so do not assess that part now.",
      },
      help: {
        nl: "Jouw aanwijzingen als docent over deze specifieke beoordeling: wat wél/niet meetelt, welke onderdelen later of apart worden beoordeeld, en bijzonderheden van de inzending. De assistent volgt deze toelichting (in tegenstelling tot het studentdocument).",
        en: "Your instructions as the teacher about this specific assessment: what does/doesn't count, which parts are assessed later or separately, and any particulars of the submission. The assistant follows these notes (unlike the student document).",
      },
      group: CONTEXT,
    },
    {
      name: "assessmentFramework",
      label: {
        nl: "Beoordelingskader / succescriteria (nakijkmodel)",
        en: "Assessment framework / success criteria (rubric)",
      },
      kind: "textarea",
      required: true,
      rows: 12,
      defaultValue: hboiNakijkmodel,
      help: {
        nl: "Standaard het HBO-i stage-nakijkmodel. Pas aan of vervang volledig voor een andere opleiding — dit kader is leidend voor het oordeel.",
        en: "Defaults to the HBO-i internship rubric. Edit or fully replace it for another programme — this framework drives the judgement.",
      },
      group: FRAMEWORK,
    },
    {
      name: "assessmentScale",
      label: { nl: "Beoordelingsschaal en slaagregels", en: "Grading scale and pass rules" },
      kind: "textarea",
      required: true,
      rows: 5,
      defaultValue: SCALE_DEFAULT,
      help: {
        nl: "Inclusief eventuele knock-outregel (bijv. 'één onvoldoende = geheel onvoldoende'). Pas aan voor je eigen opleiding.",
        en: "Including any knock-out rule (e.g. 'one fail = overall fail'). Adjust for your own programme.",
      },
      group: FRAMEWORK,
    },
    {
      name: "companyEvaluation",
      label: {
        nl: "Evaluatie bedrijfsbegeleider (optioneel)",
        en: "Company mentor evaluation (optional)",
      },
      kind: "textarea",
      required: false,
      rows: 6,
      placeholder: {
        nl: "Plak hier de (tussentijdse/eind)evaluatie van de bedrijfsbegeleider. Wordt gebruikt als ondersteunend bewijs en op volledigheid gecontroleerd.",
        en: "Paste the company mentor's (interim/final) evaluation. Used as supporting evidence and checked for completeness.",
      },
      group: FRAMEWORK,
    },
  ],
  stages: [
    {
      id: "assessment",
      name: { nl: "Concept-beoordeling", en: "Draft assessment" },
      systemPromptId: STAGE_ASSESSMENT_PROMPT.id,
      output: {
        kind: "structured-sections",
        hint: {
          nl: "Samenvattend oordeel, per succescriterium (indicatie + citaten + verbeterpunten), concept-feedback, volledigheid bedrijfsevaluatie, aandachtspunten",
          en: "Summary verdict, per success criterion (indication + quotes + improvements), draft feedback, evaluation completeness, caveats",
        },
      },
    },
  ],
};
