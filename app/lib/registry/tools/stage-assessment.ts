import type { Tool } from "../types";
import { STAGE_ASSESSMENT_PROMPT_V4 } from "~/lib/prompts/stage-assessment@v4.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";
import { DEFAULT_MODEL } from "~/lib/ai/models";

const DOC = { nl: "Document", en: "Document" };
const CONTEXT = { nl: "Context", en: "Context" };
const FRAMEWORK = { nl: "Beoordelingskader", en: "Assessment framework" };
const INTERNSHIP = { nl: "Stage en afstuderen", en: "Internship and graduation" };

/**
 * Stage- & afstudeerbeoordeling — an original LimeOnIt instrument.
 *
 * Deep, locale-neutral engine; everything programme-specific lives in the
 * editable `assessmentFramework` + `assessmentScale` inputs, which start empty and are
 * filled from an assessment model (the teacher's own per document type, or a starter such
 * as the HBO-i internship model). No control-flow branching: capability grows by
 * swapping the framework data, not the engine.
 */
export const stageAssessment: Tool = {
  id: "stage-assessment",
  slug: "stage-assessment",
  name: {
    nl: "Studentwerk beoordelen en feedback geven",
    en: "Assess student work and give feedback",
  },
  /** Book/technique name shown small under the task-first name. */
  subtitle: {
    nl: "Beoordelingsassistent: essay, rapport, beroepsproduct, stage & afstuderen",
    en: "Assessment assistant: essay, report, work product, internship & thesis",
  },
  tagline: {
    nl: "Concept-beoordeling en feedback op geschreven studentwerk tegen jouw rubric of nakijkmodel, met feed up, feed back en feed forward; de docent beslist.",
    en: "Draft assessment and feedback on written student work against your rubric, with feed up, feed back and feed forward; the teacher decides.",
  },
  icon: "clipboard-check",
  userType: "instructor",
  // Processes student work: never in a shared view (P28.4).
  handlesStudentWork: true,
  mode: "one-shot",
  theory: {
    name: {
      nl: "Criteriumgericht beoordelen & effectieve feedback",
      en: "Criterion-referenced assessment & effective feedback",
    },
    summary: {
      nl: "Beoordeling tegen expliciete succescriteria, met feedback langs de drie vragen van Hattie & Timperley: waar werk je naartoe (feed up), waar sta je nu (feed back) en wat is de volgende stap (feed forward). De AI levert een onderbouwd concept; de examinator beslist.",
      en: "Assessment against explicit success criteria, with feedback along Hattie & Timperley's three questions: where are you going (feed up), how are you going (feed back) and where to next (feed forward). The AI drafts evidence-based advice; the examiner decides.",
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
      nl: "Origineel LimeOnIt-instrument; startmodellen, waaronder het stage-nakijkmodel van de opleiding Informatica (HBO-i).",
      en: "Original LimeOnIt instrument; starter models, including the Informatica internship rubric (HBO-i).",
    },
    evaluatedWith: { nl: "Claude Sonnet 5.5", en: "Claude Sonnet 5.5" },
  }),
  usesContextProfile: true,
  // The framework and scale come from an assessment model, chosen by the document type.
  assessmentModels: { byField: "documentType" },
  assistiveGrading: true,
  defaultOutputLanguage: "nl",
  defaultModel: DEFAULT_MODEL,
  // Feedback on a whole portfolio can be long. 8192 is the Phase 0 cap; verify it
  // does not truncate on a LARGE-document case (§3.6) and raise to 12288 if it does
  // (note the added cost). Confirm the ceiling with an eval on a big submission.
  defaultMaxTokens: 8192,
  defaultTemperature: 0.3, // Grading tool: grading-mode default — deterministic, reproducible scoring.
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "document",
      redact: true,
      label: { nl: "Te beoordelen document", en: "Document to assess" },
      kind: "document",
      required: true,
      rows: 12,
      placeholder: {
        nl: "Upload de PDF of Word, of plak hier de volledige tekst van het essay, rapport, beroepsproduct, portfolio of stageverslag.",
        en: "Upload the PDF or Word file, or paste the full text of the essay, report, work product, portfolio or internship report here.",
      },
      help: {
        nl: "Upload het bestand (PDF of Word) — de tekst verschijnt hieronder en je kunt hem nog bijwerken. Of plak de tekst zelf. Je kunt meerdere bestanden tegelijk selecteren (bijv. onderzoeksverslag + beroepsproduct voor een geheel portfolio); de teksten worden samengevoegd. De figuren uit het bestand kun je hieronder bij Figuren voor de beoordeling aanvinken.",
        en: "Upload the file (PDF or Word) — the text appears below for you to review and edit. Or paste it yourself. You can select multiple files at once (e.g. research report + work product for a whole portfolio); their texts are merged. You can tick the figures from the file below under Figures for the assessment.",
      },
      group: DOC,
    },
    {
      name: "figures",
      label: {
        nl: "Figuren voor de beoordeling (optioneel)",
        en: "Figures for the assessment (optional)",
      },
      kind: "image",
      required: false,
      accept: "image/png,image/jpeg",
      imagesFrom: "document",
      placeholder: {
        nl: "Upload eventueel zelf een figuur die niet uit het document komt (Visio-tekening, los ontwerp, foto van een schets).",
        en: "Optionally upload a figure that does not come out of the document yourself (Visio drawing, separate design, photo of a sketch).",
      },
      help: {
        nl: "Figuren voor de beoordeling: na het uploaden van het document kun je hier de figuren eruit vergroten (klik erop) en aanvinken wat het oordeel raakt. Ontbreekt er een figuur, upload hem dan zelf (max. 10). Afbeeldingen worden niet geanonimiseerd.",
        en: "Figures for the assessment: after uploading the document its figures appear here; click to enlarge and tick what affects the judgement. Missing a figure? Upload it yourself (max. 10). Images are not anonymised.",
      },
      group: DOC,
    },
    {
      name: "documentType",
      label: { nl: "Type document", en: "Document type" },
      kind: "select",
      required: true,
      defaultValue: "stageverslag",
      // Old values stay first and unchanged so earlier generations reload as they were.
      options: [
        { value: "stageverslag", label: { nl: "Stageverslag", en: "Internship report" } },
        { value: "onderzoeksverslag", label: { nl: "Onderzoeksverslag", en: "Research report" } },
        { value: "stageplan", label: { nl: "Stageplan", en: "Internship plan" } },
        {
          value: "portfolio",
          label: { nl: "Onderzoeksportfolio (geheel)", en: "Research portfolio (whole)" },
        },
        { value: "afstudeerscriptie", label: { nl: "Afstudeerscriptie", en: "Thesis" } },
        { value: "essay", label: { nl: "Essay", en: "Essay" } },
        { value: "adviesrapport", label: { nl: "Adviesrapport", en: "Advisory report" } },
        { value: "verslag", label: { nl: "Verslag of rapport", en: "Report" } },
        {
          value: "beroepsproduct",
          label: { nl: "Beroepsproduct", en: "Professional work product" },
        },
        { value: "overig", label: { nl: "Overig", en: "Other" } },
      ],
      help: {
        nl: "Het type bepaalt welke criteria uit het kader gelden. Kies 'Onderzoeksportfolio (geheel)' om zowel het onderzoeksverslag (Analyseren) als het beroepsproduct/de realisatie (Realiseren) samen te beoordelen — upload of plak dan beide documenten. De overige typen beoordelen één onderdeel.",
        en: "The type decides which criteria in the framework apply. Choose 'Research portfolio (whole)' to assess both the research report (Analyseren) and the work product/realisation (Realiseren) together — then upload or paste both documents. The other types assess a single component.",
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
      prefillFromAssessmentModel: { source: "framework" },
      placeholder: {
        nl: "Kies hierboven een beoordelingsmodel, of plak hier je eigen rubric of succescriteria.",
        en: "Pick an assessment model above, or paste your own rubric or success criteria here.",
      },
      help: {
        nl: "Dit kader is leidend voor het oordeel. Een paar heldere succescriteria volstaan. Je eigen modellen per documenttype beheer je onder Beoordelingsmodellen.",
        en: "This framework drives the judgement. A few clear success criteria are enough. Manage your own models per document type under Assessment models.",
      },
      group: FRAMEWORK,
    },
    {
      name: "assessmentScale",
      label: {
        nl: "Beoordelingsschaal en slaagregels (optioneel)",
        en: "Grading scale and pass rules (optional)",
      },
      kind: "textarea",
      required: false,
      rows: 5,
      prefillFromAssessmentModel: { source: "scale" },
      placeholder: {
        nl: "Bijv. Onvoldoende / Voldoende / Goed per criterium; één onvoldoende = geheel onvoldoende.",
        en: "E.g. Insufficient / Sufficient / Good per criterion; one fail = overall fail.",
      },
      help: {
        nl: "Inclusief eventuele knock-outregel. Laat je dit leeg, dan geeft de tool alleen feedback en geen oordeel.",
        en: "Including any knock-out rule. Leave it empty for feedback only, without a judgement.",
      },
      group: FRAMEWORK,
    },
    {
      name: "durationWeeks",
      label: {
        nl: "Duur van de stage in weken (optioneel)",
        en: "Internship duration in weeks (optional)",
      },
      // Text, not number: an optional number field would start at its minimum and
      // tell the model an essay came with a one-week internship.
      kind: "text",
      required: false,
      placeholder: { nl: "bijv. 20", en: "e.g. 20" },
      help: {
        nl: "Alleen bij een stage of afstudeeropdracht. Laat leeg bij ander studentwerk.",
        en: "Only for an internship or graduation project. Leave empty for other student work.",
      },
      group: INTERNSHIP,
    },
    {
      name: "companyEvaluation",
      redact: true,
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
      group: INTERNSHIP,
    },
    {
      name: "feedbackHistory",
      label: {
        nl: "Eerdere feedback aan de student (optioneel)",
        en: "Earlier feedback to the student (optional)",
      },
      kind: "textarea",
      required: false,
      rows: 6,
      // P38.4: opened from a track, its earlier feedback is filled in here.
      prefillFromTrack: { source: "feedbackHistory" },
      placeholder: {
        nl: "Open je deze tool vanuit een traject, dan staat hier de eerdere feedback. Of plak zelf de feedback van een vorige ronde.",
        en: "Opened from a track, the earlier feedback is filled in here. Or paste the feedback of a previous round yourself.",
      },
      help: {
        nl: "De beoordeling zegt per criterium of de eerder gevraagde verbetering is opgepakt. Laat leeg bij een eerste beoordeling.",
        en: "Per criterion, the assessment says whether the improvement asked for earlier was taken up. Leave empty for a first assessment.",
      },
      group: INTERNSHIP,
    },
  ],
  stages: [
    {
      id: "assessment",
      name: { nl: "Concept-beoordeling", en: "Draft assessment" },
      systemPromptId: STAGE_ASSESSMENT_PROMPT_V4.id,
      output: {
        kind: "structured-sections",
        exportAs: "table",
        hint: {
          nl: "Samenvattend oordeel, per succescriterium (indicatie + citaten + verbeterpunten), concept-feedback, volledigheid bedrijfsevaluatie, aandachtspunten",
          en: "Summary verdict, per success criterion (indication + quotes + improvements), draft feedback, evaluation completeness, caveats",
        },
      },
    },
  ],
};
