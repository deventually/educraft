import type { Messages } from "../nl";

/** Processing a course evaluation on the Check tab (P33.2, P33.3). */
export const courseEvaluation: Messages["courseEvaluation"] = {
  accept: "Agree",
  answers: "Students' answers",
  answersHint: "Paste the open answers, one student per line or all in one go.",
  basis: {
    data: "From the test analysis",
    question: "A question for you",
    students: "According to students",
  },
  better: "What can be better",
  betterIntro: "For each point say Agree (it joins your improvements) or Disagree (it goes).",
  check: "Check names",
  checked: "Name check done. The AI gets the answers with codes instead of names.",
  count: "{n} of {total}",
  csv: "Or choose a CSV file",
  csvHint:
    "The file is read in your browser. The number of respondents comes from the number of rows.",
  done: "Evaluation processed. Read the result below.",
  edit: "Change the answers",
  errors: {
    failed: "Processing did not work. Please try again.",
    invalid: "Paste the answers and fill in the number of respondents.",
    model: "You cannot choose this model.",
    quota:
      "AI limit reached: your allowance for this month is used up, or you used a lot of AI today (then it works again tomorrow). The Usage page shows your month.",
  },
  field: "the answers",
  heading: "Process course evaluation",
  intro:
    "Paste the student survey of the previous run. After the name check in your browser you see what students said, where it went wrong and what can be better. The survey is not kept.",
  model: "Model",
  negative: "What can improve",
  none: "Nothing found.",
  pending: "Processing the evaluation…",
  positive: "What went well",
  process: "Process",
  reject: "Disagree",
  respondents: "Number of respondents",
  respondentsHint: "How many students filled in the survey.",
  said: "What students said",
  small: "Fewer than 10 respondents: read the result with care.",
  wrong: "Where it went wrong",
};
