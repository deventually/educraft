/**
 * The wording of Jev's questions for "Bewijs in één keer" (`sortJev.ts`), per language: the
 * state's facts, the questions, the yes/no criteria and what each kind covers and excludes.
 */
import type { EvidenceKind } from "./types";

export type Locale = "nl" | "en";

export const JEV_TEXT = {
  nl: {
    dossier:
      "Een BDB/BKE-dossier van een docent in het hoger onderwijs: per leeruitkomst verzamelt de docent eigen werk als bewijs.",
    aboutText:
      "`file.text` is het begin van het bestand; namen van studenten zijn vervangen door codes zoals [STUDENT-1].",
    noText:
      "Er is geen tekst uit dit bestand gelezen: `file.text` is leeg, alleen `file.name` is bekend.",
    evidence: "Laat `file` werk zien van de docent zelf, als bewijs voor het dossier?",
    evidenceYes:
      "Het laat werk van de docent zien, zoals een lesplan, toets, verslag van een eigen les of gesprek, feedback op de docent, een analyse, reflectie of ontwikkelplan.",
    evidenceNo:
      "Een leeg sjabloon of format, algemene informatie, notulen of organisatie, of iets zonder verband met het werk van de docent.",
    outcome:
      "Bij welke leeruitkomst van het dossier hoort `file` als bewijs? `file.folder` is een aanwijzing; de inhoud van `file.text` weegt zwaarder.",
    kind: "Wat voor soort stuk is `file`?",
    outcomeLabel: "leeruitkomst",
    criteriaLabel: "criteria",
    criterion: (c: string) => `Laat \`file.text\` zien dat de docent dit doet: ${c}`,
    criterionYes: "Het bestand laat concreet zien dat de docent dit zelf doet of deed.",
    criterionNo:
      "Het bestand gaat over iets anders, of noemt dit alleen zonder dat de docent het laat zien.",
    required: (r: string) => `Is \`file\` dit stuk verplicht bewijs: ${r}`,
    requiredYes: "Het bestand is dit stuk, of een versie ervan.",
    requiredNo: "Het bestand is een ander soort stuk.",
    kinds: {
      "lesson-plan": {
        omvat: "Een lesvoorbereiding of lesplan van de docent.",
        niet: "Een leeg werkblad of format.",
      },
      "observation-notes": {
        omvat:
          "Een opname, transcript, observatie of verslag van een eigen les of begeleidingsgesprek.",
        niet: "Notulen van een vergadering.",
      },
      feedback: {
        omvat:
          "Feedback van een ander op de docent: een werkplekbegeleider, collega, leidinggevende of studenten.",
        niet: "Een eigen reflectie van de docent, of de uitvoer van een AI-tool.",
      },
      "test-material": {
        omvat: "Een toets, toetsmatrijs, antwoordmodel of rubric.",
        niet: "Een analyse van toetsresultaten.",
      },
      analysis: {
        omvat: "Een analyse, zoals een toetsanalyse of een evaluatie met conclusies.",
        niet: "Een eigen reflectie op een les.",
      },
      other: {
        omvat:
          "Iets anders: een eigen reflectie, een ontwikkelplan, uitvoer van een AI-tool, notulen of een leeg sjabloon.",
      },
    },
  },
  en: {
    dossier:
      "A teaching-qualification dossier of a teacher in higher education: per learning outcome the teacher collects their own work as evidence.",
    aboutText:
      "`file.text` is the start of the file; student names are replaced by codes such as [STUDENT-1].",
    noText: "No text was read from this file: `file.text` is empty, only `file.name` is known.",
    evidence: "Does `file` show the teacher's own work, as evidence for the dossier?",
    evidenceYes:
      "It shows the teacher's work, such as a lesson plan, test, report of their own lesson or conversation, feedback on the teacher, an analysis, reflection or development plan.",
    evidenceNo:
      "An empty template or format, general information, meeting minutes or logistics, or something unrelated to the teacher's work.",
    outcome:
      "Which learning outcome of the dossier does `file` belong to as evidence? `file.folder` is a hint; the content of `file.text` weighs more.",
    kind: "What kind of document is `file`?",
    outcomeLabel: "learning_outcome",
    criteriaLabel: "criteria",
    criterion: (c: string) => `Does \`file.text\` show the teacher doing this: ${c}`,
    criterionYes: "The file concretely shows the teacher doing or having done this themselves.",
    criterionNo:
      "The file is about something else, or only mentions this without showing the teacher doing it.",
    required: (r: string) => `Is \`file\` this piece of required evidence: ${r}`,
    requiredYes: "The file is this piece, or a version of it.",
    requiredNo: "The file is another kind of document.",
    kinds: {
      "lesson-plan": {
        covers: "A lesson preparation or lesson plan by the teacher.",
        excludes: "An empty worksheet or format.",
      },
      "observation-notes": {
        covers:
          "A recording, transcript, observation or report of the teacher's own lesson or coaching conversation.",
        excludes: "Minutes of a meeting.",
      },
      feedback: {
        covers:
          "Feedback from someone else on the teacher: a workplace supervisor, colleague, manager or students.",
        excludes: "The teacher's own reflection, or the output of an AI tool.",
      },
      "test-material": {
        covers: "A test, test blueprint, answer key or rubric.",
        excludes: "An analysis of test results.",
      },
      analysis: {
        covers: "An analysis, such as a test analysis or an evaluation with conclusions.",
        excludes: "The teacher's own reflection on a lesson.",
      },
      other: {
        covers:
          "Something else: the teacher's own reflection, a development plan, AI tool output, meeting minutes or an empty template.",
      },
    },
  },
} satisfies Record<
  Locale,
  { kinds: Record<EvidenceKind, Record<string, string>> } & Record<string, unknown>
>;
