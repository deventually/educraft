/** Quick-check rules of the reviewers on practice, students and inclusion (see `screenQuestions.ts`). */
import { q, type ScreenRules } from "./screenTypes";

export const STUDENT_RULES: Record<string, ScreenRules> = {
  "professional-practice": {
    facts: [],
    questions: [
      q(
        "professional-activity",
        "outcome",
        "yes",
        {
          nl: "Vraagt de leeruitkomst `{item}.text` om een beroepsactiviteit, zoals analyseren, adviseren, ontwerpen of realiseren?",
          en: "Does the learning outcome `{item}.text` ask for a professional activity, such as analysing, advising, designing or realising?",
        },
        {
          nl: "Ja: de student doet iets wat een professional in het werk doet.",
          en: "Yes: the student does something a professional does at work.",
        },
        {
          nl: "Nee: de leeruitkomst gaat over kennis, zoals begrippen kennen of uitleggen.",
          en: "No: the outcome is about knowledge, such as knowing or explaining concepts.",
        },
      ),
      q(
        "practice-situation",
        "outcome",
        "notYes",
        {
          nl: "Oefenen studenten in `{item}.taught_by` aan een casus, opdrachtgever, praktijkvraag of product zoals in het beroep?",
          en: "Do students practise in `{item}.taught_by` on a case, client, practice question or product as in the profession?",
        },
        {
          nl: "Ja: er is een activiteit met een casus, opdrachtgever, praktijkvraag of product.",
          en: "Yes: there is an activity with a case, client, practice question or product.",
        },
        {
          nl: "Nee: er zijn alleen hoorcolleges of lessen over de stof.",
          en: "No: there are only lectures or lessons about the subject.",
        },
        { onlyIf: "professional-activity" },
      ),
      q(
        "test-like-work",
        "outcome",
        "notYes",
        {
          nl: "Doet of maakt de student in een toets in `{item}.assessed_by` iets wat een professional ook doet?",
          en: "In a test in `{item}.assessed_by`, does the student do or make something a professional also does?",
        },
        {
          nl: "Ja: bijvoorbeeld een advies, ontwerp, product of rapport voor een opdrachtgever.",
          en: "Yes: for example advice, a design, a product or a report for a client.",
        },
        {
          nl: "Nee: de toets vraagt alleen kennis, bijvoorbeeld een kennistoets of tentamen.",
          en: "No: the test only asks for knowledge, for example a knowledge test or exam.",
        },
        { onlyIf: "professional-activity" },
      ),
      q(
        "step-by-step",
        "outcome",
        "yes",
        {
          nl: "Is een opdracht of toets in `{item}.taught_by` of `{item}.assessed_by` een stap-voor-stap-opdracht?",
          en: "Is an assignment or test in `{item}.taught_by` or `{item}.assessed_by` a step-by-step assignment?",
        },
        {
          nl: "Ja: de student volgt vaste stappen of een handleiding.",
          en: "Yes: the student follows fixed steps or a manual.",
        },
        {
          nl: "Nee: de student werkt zelfstandig aan een open, complexe situatie.",
          en: "No: the student works independently on an open, complex situation.",
        },
        { when: "levelThree" },
      ),
    ],
  },
  student: {
    facts: [
      "summativeSameWeek",
      "summativeWithoutWeek",
      "noWeeks",
      "feedbackNotBefore",
      "emptyWeeks",
    ],
    questions: [
      q(
        "clear-title",
        "summative",
        "notYes",
        {
          nl: "Laat de titel van de toets `{item}.title` zien wat de student moet doen of inleveren?",
          en: "Does the title of the test `{item}.title` show what the student must do or hand in?",
        },
        {
          nl: "Ja: bijvoorbeeld Verslag over het onderzoek of Tentamen statistiek.",
          en: "Yes: for example Report on the study or Statistics exam.",
        },
        {
          nl: "Nee: de titel zegt niet wat er moet, bijvoorbeeld alleen Opdracht 2 of Toets B.",
          en: "No: the title does not say what is asked, for example only Assignment 2 or Test B.",
        },
      ),
      q(
        "clear-assignment",
        "assignment",
        "notYes",
        {
          nl: "Laat de titel van de opdracht `{item}.title` zien wat de student moet doen of inleveren?",
          en: "Does the title of the assignment `{item}.title` show what the student must do or hand in?",
        },
        {
          nl: "Ja: bijvoorbeeld Opdracht: datamodel voor de casus bibliotheek.",
          en: "Yes: for example Assignment: data model for the library case.",
        },
        {
          nl: "Nee: de titel zegt niet wat er moet, bijvoorbeeld alleen Opdracht 2.",
          en: "No: the title does not say what is asked, for example only Assignment 2.",
        },
      ),
    ],
  },
  inclusion: {
    facts: ["gradeOnOneTest"],
    questions: [
      q(
        "one-test-form",
        "course",
        "yes",
        {
          nl: "Laten alle summatieve toetsen in `course.assessments` de student op dezelfde manier zien wat hij kan?",
          en: "Do all summative tests in `course.assessments` let the student show what they can do in the same way?",
        },
        {
          nl: "Ja: bijvoorbeeld alleen schriftelijke tentamens, of alleen geschreven verslagen.",
          en: "Yes: for example only written exams, or only written reports.",
        },
        {
          nl: "Nee: de vormen verschillen, zoals een tentamen en een presentatie of product.",
          en: "No: the forms differ, such as an exam and a presentation or product.",
        },
      ),
      q(
        "one-way-of-learning",
        "course",
        "yes",
        {
          nl: "Leren studenten in `course.activities` op maar één manier?",
          en: "Do students learn in only one way in `course.activities`?",
        },
        {
          nl: "Ja: bijvoorbeeld alleen hoorcolleges en zelfstudie.",
          en: "Yes: for example only lectures and self-study.",
        },
        {
          nl: "Nee: er is afwisseling, zoals samenwerken, oefenen, iets maken of bespreken.",
          en: "No: there is variety, such as working together, practising, making something or discussing.",
        },
      ),
    ],
  },
};
