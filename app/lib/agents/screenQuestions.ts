/**
 * All wording of the quick check before the review team, in one place (TypeSafe's skill): per
 * reviewer, the facts code checks and the yes/no questions Jev answers. Written once from each
 * reviewer's prompt ("Waar je op let"), before any measurement, and not tuned on eval cases
 * (`evals/review-screen/README.md`). `screen.ts` builds the request and decides.
 */
import type { LocalizedText } from "~/lib/i18n/localized";

/** Facts code computes from the course (`screenFacts`): counting and weeks stay out of Jev. */
export const SCREEN_FACTS = [
  "summativeSameWeek",
  "summativeWithoutWeek",
  "noWeeks",
  "feedbackNotBefore",
  "gradeOnOneTest",
  "emptyWeeks",
  "loadPeak",
  "noGapBeforeSummative",
  "outcomeLittleTime",
] as const;
export type ScreenFact = (typeof SCREEN_FACTS)[number];

/** What a question is about: the whole course, or each item of a kind (one question per item). */
export type ScreenScope = "course" | "outcome" | "activity" | "assignment" | "summative";

/** Code's condition for asking an item question at all (the item has what the question reads). */
export type ScreenWhen =
  | "hasBloom"
  | "applyOrHigher"
  | "hasPack"
  | "levelThree"
  | "hasHours"
  | "coversCreateOrEvaluate"
  | "notSupervised"
  | "supervised";

export interface ScreenQuestion {
  id: string;
  scope: ScreenScope;
  when?: ScreenWhen;
  /**
   * `yes`: true means a problem, so it counts unless it is a clear no. `notYes`: phrased the
   * good way round, so it counts unless it is a clear yes.
   */
  problem: "yes" | "notYes";
  /** Counts only when this question about the same item is not a clear no (asked alongside). */
  onlyIf?: string;
  /** Asked only when this fact holds. */
  onlyIfFact?: ScreenFact;
  /** `{item}` becomes the item's path, e.g. `course.outcomes.L1`. */
  ask: LocalizedText;
  yes: LocalizedText;
  no: LocalizedText;
}

export interface ScreenRules {
  facts: ScreenFact[];
  questions: ScreenQuestion[];
}

const q = (
  id: string,
  scope: ScreenScope,
  problem: ScreenQuestion["problem"],
  ask: LocalizedText,
  yes: LocalizedText,
  no: LocalizedText,
  extra: Partial<Pick<ScreenQuestion, "when" | "onlyIf" | "onlyIfFact">> = {},
): ScreenQuestion => ({ id, scope, problem, ask, yes, no, ...extra });

/** Per reviewer id (`AGENTS`); a reviewer without an entry is never skipped. */
export const SCREEN_RULES: Record<string, ScreenRules> = {
  "assessment-expert": {
    facts: ["feedbackNotBefore"],
    questions: [
      q(
        "vague",
        "outcome",
        "yes",
        {
          nl: "Gebruikt de leeruitkomst `{item}.text` een werkwoord dat je niet kunt waarnemen?",
          en: "Does the learning outcome `{item}.text` use a verb you cannot observe?",
        },
        {
          nl: "Ja: het werkwoord is iets in het hoofd, zoals begrijpt, kent, weet, is bekend met of heeft inzicht in.",
          en: "Yes: the verb is something in the head, such as understands, knows, is familiar with or has insight into.",
        },
        {
          nl: "Nee: het werkwoord is een handeling die je kunt zien of beoordelen, zoals ontwerpt, analyseert, legt uit of berekent.",
          en: "No: the verb is an action you can see or assess, such as designs, analyses, explains or calculates.",
        },
      ),
      q(
        "several-actions",
        "outcome",
        "yes",
        {
          nl: "Vraagt de leeruitkomst `{item}.text` om twee of meer verschillende handelingen?",
          en: "Does the learning outcome `{item}.text` ask for two or more different actions?",
        },
        {
          nl: "Ja: er staan meer handelingen in, zoals analyseert en ontwerpt.",
          en: "Yes: it names more actions, such as analyses and designs.",
        },
        {
          nl: "Nee: de leeruitkomst vraagt één handeling.",
          en: "No: the outcome asks for one action.",
        },
      ),
      q(
        "bloom-mismatch",
        "outcome",
        "yes",
        {
          nl: "Vraagt het werkwoord in `{item}.text` om een ander Bloom-niveau dan `{item}.bloom`?",
          en: "Does the verb in `{item}.text` ask for a different Bloom level than `{item}.bloom`?",
        },
        {
          nl: "Ja: het werkwoord hoort bij een ander niveau, bijvoorbeeld noemt bij creëren.",
          en: "Yes: the verb belongs to another level, for example names at create.",
        },
        {
          nl: "Nee: het werkwoord past bij dat niveau, bijvoorbeeld ontwerpt bij creëren.",
          en: "No: the verb fits that level, for example designs at create.",
        },
        { when: "hasBloom" },
      ),
      q(
        "knowledge-test",
        "summative",
        "yes",
        {
          nl: "Is de toets `{item}` een kennistoets, zoals een meerkeuzetoets of een schriftelijk tentamen met vragen?",
          en: "Is the test `{item}` a knowledge test, such as a multiple-choice test or a written exam with questions?",
        },
        {
          nl: "Ja: de student beantwoordt vragen over de stof.",
          en: "Yes: the student answers questions about the subject.",
        },
        {
          nl: "Nee: de student maakt een product, doet een opdracht of laat het mondeling zien.",
          en: "No: the student makes a product, does an assignment or shows it in an oral.",
        },
        { when: "coversCreateOrEvaluate" },
      ),
      q(
        "outcomes-differ",
        "course",
        "yes",
        {
          nl: "Gaan de leeruitkomsten in `course.outcomes` over heel verschillende soorten kunnen?",
          en: "Are the learning outcomes in `course.outcomes` about very different kinds of ability?",
        },
        {
          nl: "Ja: bijvoorbeeld kennis van begrippen naast iets ontwerpen of samenwerken.",
          en: "Yes: for example knowing concepts next to designing something or working together.",
        },
        {
          nl: "Nee: de leeruitkomsten vragen hetzelfde soort kunnen.",
          en: "No: the outcomes ask for the same kind of ability.",
        },
        { onlyIfFact: "gradeOnOneTest" },
      ),
      q(
        "pack-fit",
        "outcome",
        "notYes",
        {
          nl: "Toetsen de toetsen in `{item}.assessed_by` de beroepsactiviteit en het niveau uit `{item}.pack`?",
          en: "Do the tests in `{item}.assessed_by` assess the professional activity and the level in `{item}.pack`?",
        },
        {
          nl: "Ja: wat de student in de toets doet, is die beroepsactiviteit op dat niveau.",
          en: "Yes: what the student does in the test is that professional activity at that level.",
        },
        {
          nl: "Nee: de toets vraagt iets anders, bijvoorbeeld alleen kennis bij een leeruitkomst over adviseren.",
          en: "No: the test asks something else, for example only knowledge for an outcome about advising.",
        },
        { when: "hasPack" },
      ),
    ],
  },
  designer: {
    facts: ["loadPeak", "noGapBeforeSummative", "outcomeLittleTime"],
    questions: [
      q(
        "only-lectures",
        "outcome",
        "yes",
        {
          nl: "Bestaan de activiteiten in `{item}.taught_by` alleen uit hoorcolleges of instructie, zonder opdracht, practicum of oefening?",
          en: "Do the activities in `{item}.taught_by` consist only of lectures or instruction, without an assignment, practical or exercise?",
        },
        {
          nl: "Ja: studenten luisteren alleen; ze oefenen het niet zelf.",
          en: "Yes: students only listen; they do not practise it themselves.",
        },
        {
          nl: "Nee: er is een opdracht, workshop, practicum of oefening waarin studenten het zelf doen.",
          en: "No: there is an assignment, workshop, practical or exercise in which students do it themselves.",
        },
        { when: "applyOrHigher" },
      ),
      q(
        "order",
        "course",
        "yes",
        {
          nl: "Staat er in `course.weeks` een opdracht of oefening vóór de instructie waar die op leunt?",
          en: "Does `course.weeks` have an assignment or exercise before the instruction it relies on?",
        },
        {
          nl: "Ja: studenten moeten iets doen wat pas later wordt uitgelegd.",
          en: "Yes: students must do something that is explained only later.",
        },
        {
          nl: "Nee: de instructie komt eerst, en de opdracht daarna.",
          en: "No: the instruction comes first, and the assignment after it.",
        },
      ),
      q(
        "hours-off",
        "activity",
        "yes",
        {
          nl: "Zijn de uren van `{item}` duidelijk te weinig of te veel voor wat de titel vraagt?",
          en: "Are the hours of `{item}` clearly too few or too many for what its title asks?",
        },
        {
          nl: "Ja: bijvoorbeeld 2 uur voor een groot project, of 40 uur voor één korte les.",
          en: "Yes: for example 2 hours for a big project, or 40 hours for one short lesson.",
        },
        {
          nl: "Nee: de uren passen bij wat er gevraagd wordt.",
          en: "No: the hours fit what is asked.",
        },
        { when: "hasHours" },
      ),
      q(
        "off-topic",
        "activity",
        "yes",
        {
          nl: "Gaat de activiteit `{item}.title` over iets anders dan de leeruitkomsten in `{item}.serves`?",
          en: "Is the activity `{item}.title` about something other than the outcomes in `{item}.serves`?",
        },
        {
          nl: "Ja: de inhoud van de activiteit hoort niet bij die leeruitkomsten.",
          en: "Yes: what the activity is about does not belong to those outcomes.",
        },
        {
          nl: "Nee: de activiteit werkt aan die leeruitkomsten.",
          en: "No: the activity works towards those outcomes.",
        },
      ),
    ],
  },
  "ai-resilience": {
    facts: [],
    questions: [
      q(
        "home-product",
        "summative",
        "yes",
        {
          nl: "Levert de student voor de toets `{item}` een tekst, code, ontwerp of analyse in die hij buiten toezicht maakt?",
          en: "For the test `{item}`, does the student hand in a text, code, design or analysis made without supervision?",
        },
        {
          nl: "Ja: bijvoorbeeld een verslag, essay, portfolio of opdracht die thuis gemaakt wordt.",
          en: "Yes: for example a report, essay, portfolio or assignment made at home.",
        },
        {
          nl: "Nee: de student laat het onder toezicht zien, zoals in een tentamen, een mondeling of een praktijkexamen.",
          en: "No: the student shows it under supervision, such as in an exam, an oral or a practical exam.",
        },
        { when: "notSupervised" },
      ),
      q(
        "home-work-presented",
        "summative",
        "yes",
        {
          nl: "Gaat de toets `{item}` over werk dat de student thuis heeft gemaakt?",
          en: "Is the test `{item}` about work the student made at home?",
        },
        {
          nl: "Ja: bijvoorbeeld een presentatie of verdediging van een eigen verslag.",
          en: "Yes: for example a presentation or defence of their own report.",
        },
        {
          nl: "Nee: de student maakt het werk ter plekke, zoals in een tentamen.",
          en: "No: the student does the work on the spot, as in an exam.",
        },
        { when: "supervised" },
      ),
    ],
  },
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
    facts: ["summativeSameWeek", "summativeWithoutWeek", "noWeeks", "feedbackNotBefore", "emptyWeeks"],
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
