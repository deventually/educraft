import type { Messages } from "../nl";

/** Role agents ("Get a review", brief P21). */
export const agents: Messages["agents"] = {
  decide: {
    done: "Your decision is recorded.",
    invalid: "This decision could not be recorded. Check your reason (at most 500 characters).",
    notFound: "This advice does not exist (any more).",
  },
  panel: {
    about: "About: {item}",
    accept: "Agree",
    decided: "Handled ({n})",
    decision: { accepted: "Agree", rejected: "Disagree" },
    includeLinked: "Also review the linked test questions ({n})",
    intro:
      "Two critical colleagues review your course: an assessment expert and a designer. They advise; you decide on each piece of advice. Nothing in your course changes.",
    model: "Model",
    none: "No advice from this reviewer.",
    notYet: "Not reviewed yet.",
    pending: "The reviewers are looking at your course…",
    reason: "Reason (optional)",
    reject: "Disagree",
    reviewedWith: "Reviewed with {model}",
    run: "Get a review",
    severity: { info: "Tip", warning: "Note" },
    stale: "Your course changed after this review. Get a new review for up-to-date advice.",
    suggestion: "Suggestion",
    title: "Review",
    wholeCourse: "About the whole course",
  },
  review: {
    done: "The review is ready.",
    failed: "The review failed. Please try again later.",
    model: "This model is not available to you. Pick another model.",
    partial: "The review is ready, but {agents} gave no usable answer.",
    quota: "You have reached your daily limit. Please try again tomorrow.",
  },
};
