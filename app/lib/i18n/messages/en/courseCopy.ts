import type { Messages } from "../nl";

/** Copying an own course for its next run. */
export const courseCopy: Messages["courseCopy"] = {
  copiedBody:
    "Learning outcomes, tests, lessons and schedule came along, and so did whatever did not go well last time. What has to change after last run's evaluation? See below what does not fit yet and adjust it.",
  copiedTitle: "This is your copy for the new run",
  error: "Copying did not work. Check the name and the start date.",
  heading: "Copy for a new run",
  intro:
    "Teaching this course again, next study year or in another semester? Make a copy. Learning outcomes, tests, lessons and schedule come along. Sharing, colleagues and linked work do not. This course stays as it is.",
  name: "Name of the copy",
  nameHint: "Add the study year, for example, so you can tell the two apart.",
  ownerOnly: "Only the owner can copy this course.",
  phase: "Semester or period",
  phaseHint: "For example Semester 1 or Period 3.",
  startDate: "New start date",
  startDateHint: "The Monday of week 1. You may leave it empty.",
  studyYear: "Study year",
  submit: "Make a copy",
};
