import type { CourseData } from "~/lib/courses/types";

export const LO1 = "lo-1";
export const LO2 = "lo-2";
export const ACT1 = "act-1";
export const ACT2 = "act-2";
export const TEST1 = "test-1";
export const QUIZ = "quiz-1";

/** A fully aligned course: every check passes. */
export function alignedCourse(): CourseData {
  return {
    outcomes: [
      { id: LO1, text: "Je ontwerpt een datamodel.", bloom: "create" },
      { id: LO2, text: "Je legt normaliseren uit.", bloom: "understand" },
    ],
    activities: [
      { id: ACT1, title: "Les normaliseren", week: 1, kind: "lesson", outcomeIds: [LO2] },
      { id: ACT2, title: "Opdracht datamodel", week: 2, kind: "assignment", outcomeIds: [LO1] },
    ],
    assessments: [
      {
        id: QUIZ,
        title: "Oefentoets",
        week: 2,
        kind: "formative",
        coverage: [{ outcomeId: LO2, bloom: "understand" }],
      },
      {
        id: TEST1,
        title: "Eindopdracht",
        week: 4,
        kind: "summative",
        weight: 100,
        coverage: [
          { outcomeId: LO1, bloom: "create" },
          { outcomeId: LO2, bloom: "analyze" },
        ],
      },
    ],
  };
}

/** The aligned course whose final test carries a question-level matrix (P26.1). Still aligned. */
export function itemizedCourse(): CourseData {
  const d = alignedCourse();
  d.assessments[1]!.items = [
    { id: "q-1", label: "1", outcomeId: LO1, bloom: "create", format: "open", points: 10 },
    { id: "q-2", label: "2", outcomeId: LO1, bloom: "create", format: "open", points: 10 },
    {
      id: "q-3",
      label: "3",
      outcomeId: LO2,
      bloom: "analyze",
      format: "multiple-choice",
      points: 2,
    },
    { id: "q-4", label: "4", outcomeId: LO2, bloom: "understand", format: "other", points: 3 },
  ];
  return d;
}

/** The aligned course with what the blueprint and the marking model need: details and parts. */
export function documentedCourse(): CourseData {
  const d = alignedCourse();
  d.code = "DB1";
  d.studyYear = "2026-2027";
  d.outcomes[0]!.criteria = [
    { code: "S-An 1.1", text: "De student registreert requirements." },
    { text: "Het model is genormaliseerd." },
  ];
  d.outcomes[0]!.packTags = { beheersingsniveau: 2 };
  Object.assign(d.assessments[1]!, {
    form: "Andere wijze",
    owner: "Docent A",
    grading: "pass-fail",
    passMark: 75,
    supervised: false,
    conditions: ["Alle opdrachten ingeleverd.", "Deelgenomen aan het gesprek."],
    resit: "In week 10, met een vervangende opdracht.",
    conduct: "Thuis gemaakt, AI mag met bronvermelding.",
    parts: [
      {
        id: "p-1",
        title: "Datamodel",
        outcomeIds: [LO1],
        weight: 60,
        knockOut: true,
        pass: "Het model werkt.\nDe keuzes zijn onderbouwd.",
      },
      {
        id: "p-2",
        title: "Toelichting",
        outcomeIds: [LO1, LO2],
        weight: 40,
        pass: "Legt normaliseren uit.",
        fail: "Legt normaliseren niet of onjuist uit.",
      },
    ],
  });
  return d;
}
