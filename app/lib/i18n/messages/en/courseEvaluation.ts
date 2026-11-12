import type { Messages } from "../nl";

/** Processing a course evaluation on the Check tab (P33.2, P33.3). */
export const courseEvaluation: Messages["courseEvaluation"] = {
  done: "Evaluation processed. Read the result below.",
  errors: {
    failed: "Processing did not work. Please try again.",
    invalid: "Paste the answers and fill in the number of respondents.",
    model: "You cannot choose this model.",
    quota:
      "AI limit reached: your allowance for this month is used up, or you used a lot of AI today (then it works again tomorrow). The Usage page shows your month.",
  },
  pending: "Processing the evaluation…",
};
