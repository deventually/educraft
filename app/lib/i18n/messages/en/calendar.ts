import type { Messages } from "../nl";

/** The school calendar and dates of the teacher's week (P22). */
export const calendar: Messages["calendar"] = {
  breakWeeksHint:
    "One date per line, as YYYY-MM-DD. Each date counts for its whole week (Monday to Sunday). Empty = no breaks.",
  breakWeeksLabel: "Break weeks",
  heading: "School calendar",
  intro:
    "The break weeks apply to every course on this instance. A course skips them when it counts its weeks.",
  invalid: "Every line must be a date, such as 2026-10-19.",
  none: "No break weeks yet.",
  saved: "Saved break weeks",
  tooMany: "You can save at most 52 break weeks.",
  week: "Week {n}",
};
