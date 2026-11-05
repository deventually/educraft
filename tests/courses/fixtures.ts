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
  d.assessments[1].items = [
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
