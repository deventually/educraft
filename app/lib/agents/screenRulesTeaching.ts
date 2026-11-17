/** Quick-check rules of the reviewers on outcomes, design and tests (see `screenQuestions.ts`). */
import { q, type ScreenRules } from "./screenTypes";

export const TEACHING_RULES: Record<string, ScreenRules> = {
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
};
