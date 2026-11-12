import type { Messages } from "../nl";

/** Improvements for the next run of a course, on the Check tab (P33.1). */
export const courseImprovements: Messages["courseImprovements"] = {
  add: "Add point",
  addHeading: "Add a point yourself",
  done: {
    added: "Improvement added.",
    finished: "Improvement finished.",
    removed: "Improvement removed.",
    reopened: "Improvement is open again.",
  },
  doneList: "Finished improvements",
  doneSummary: "Finished ({n})",
  earlier: "From the previous run",
  errors: {
    full: "This course already has 30 improvements. Remove a finished one first.",
    invalid:
      "This improvement does not work like this. Write a short sentence and choose a place in the course.",
    notFound: "This improvement no longer exists.",
  },
  finish: "Finished",
  fromEvaluation: "From the evaluation",
  heading: "Improvements",
  intro:
    "What do you want to do differently next time? Put it here, with the lesson, test or learning outcome it is about. Open points come along when you copy the course for a new run; finished ones do not.",
  none: "No open improvements yet.",
  openList: "Open improvements",
  place: "Where does it belong?",
  places: {
    activity: "Lesson or assignment",
    activityGroup: "Lessons and assignments",
    assessment: "Test",
    assessmentGroup: "Tests",
    course: "The whole course",
    outcome: "Learning outcome",
    outcomeGroup: "Learning outcomes",
  },
  remove: "Remove",
  reopen: "Open again",
  run: "From {run}",
  text: "New improvement",
  textHint: "One point, for example: Hand out the case a week earlier.",
};
