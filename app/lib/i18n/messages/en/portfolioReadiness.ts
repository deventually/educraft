export const portfolioReadiness = {
  allDone: "Everything is ready to hand in.",
  blocking: ", {n} of them blocking",
  counted: "Counted in your linked tests: {count}.",
  fix: "Fix it",
  intro:
    "Advice, not a gate: you can always export. Only what your institution's framework asks for is checked.",
  items: {
    "ai-disclosure-missing": {
      ok: "The AI disclosure is switched on in my export",
      problem: "The AI disclosure is switched on in my export",
    },
    "chapter-empty": {
      ok: "Every chapter has text.",
      problem: "The chapter has no text yet.",
    },
    "citation-not-in-references": {
      ok: "Every source you cite is in your reference list.",
      problem: "({detail}) is not in your reference list.",
    },
    "criterion-not-shown": {
      ok: "Every criterion is marked as shown.",
      problem: "Not marked as shown yet: {criterion}",
    },
    "criterion-unverified": {
      ok: "Every criterion comes word for word from the form.",
      problem: "Check that this criterion is in the form word for word: {criterion}",
    },
    "criterion-without-evidence": {
      ok: "Every criterion has evidence.",
      problem: "No evidence yet for: {criterion}",
    },
    "framework-unconfirmed": {
      ok: "Your framework is confirmed.",
      problem: "Your framework is not confirmed yet.",
    },
    "min-analysed-items": {
      ok: "I analysed at least {limit} test questions",
      problem: "I analysed at least {limit} test questions",
    },
    "min-constructed-items": {
      ok: "I wrote at least {limit} test questions myself",
      problem: "I wrote at least {limit} test questions myself",
    },
    "no-student-names": {
      ok: "There are no student names in your evidence",
      problem: "There are no student names in your evidence",
    },
    "over-word-limit": {
      ok: "You are within the word limit.",
      problem: "{count} words, the limit is {limit}.",
    },
    "reference-not-cited": {
      ok: "You cite every source in your list.",
      problem: "You do not cite this source anywhere: {detail}",
    },
    "required-evidence-missing": {
      ok: "All the evidence the form asks for is in.",
      problem: "The form asks for: {detail}",
    },
  },
  level: { block: "To do", ok: "Done", warn: "Check" },
  open: "{n} points still open",
  openOne: "1 point still open",
  ticked: "Ticked off yourself on {date}",
  title: "Ready to hand in?",
};
