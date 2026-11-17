import type { Messages } from "../nl";

export const adminPrivacy: Messages["adminPrivacy"] = {
  colTeachers: "Teachers",
  colWord: "Word",
  errors: {
    invalid: "That is not a word that can go on the list.",
    name: "That is a user's name; it stays replaced.",
  },
  heading: "Words that stay",
  health: {
    callsSummary:
      "Anonymiser gate, last 7 days: {calls} calls, {stopped} times put to the teacher first",
    caption: "Found per kind",
    colKind: "Kind",
    colPrevious: "7 days before",
    colRecent: "Last 7 days",
    countsOnly: "Counts only, never which words.",
    kinds: {
      colleague: "Colleagues",
      email: "Email addresses",
      iban: "IBANs",
      number: "Student numbers",
      phone: "Phone numbers",
      postcode: "Postcodes",
      teacher: "The teacher themselves",
    },
    spike:
      "{kind}: {recent} times this week, {previous} times the week before. Check whether something changed, such as a new tool or a new kind of text.",
  },
  intro:
    "The anonymiser gate replaces names and personal data before anything goes to an AI. Teachers put words that are not a name on their never-list, such as a researcher who happens to share a colleague's name. Adopt a word for the whole institution and it stays for everyone.",
  menuDescription: "Which words are never replaced.",
  nav: "Anonymising",
  remove: "Remove {word}",
  removed: "{word} is replaced as usual again.",
  removeLabel: "Remove",
  share: "Keep {word} for everyone",
  shared: "{word} now stays for everyone.",
  sharedEmpty: "No words for the whole institution yet.",
  sharedHeading: "For the whole institution",
  sharedIntro:
    "The gate replaces these words for nobody, like the fixed list of researchers and models (Bloom, Vygotsky, Hattie …). A user's full name cannot go on it.",
  shareLabel: "Keep for everyone",
  suggestionsCaption: "Words on teachers' never-lists",
  suggestionsEmpty: "No words from teachers yet.",
  suggestionsHeading: "Suggestions from teachers",
  suggestionsIntro:
    "You see how many teachers chose a word, never who. Users' full names and words already on a list are left out.",
};
