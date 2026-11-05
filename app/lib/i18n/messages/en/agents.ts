import type { Messages } from "../nl";

/** Role agents ("Get a review", brief P21). */
export const agents: Messages["agents"] = {
  decide: {
    done: "Your decision is recorded.",
    invalid: "This decision could not be recorded. Check your reason (at most 500 characters).",
    notFound: "This advice does not exist (any more).",
  },
  review: {
    done: "The review is ready.",
    failed: "The review failed. Please try again later.",
    model: "This model is not available to you. Pick another model.",
    partial: "The review is ready, but {agents} gave no usable answer.",
    quota: "You have reached your daily limit. Please try again tomorrow.",
  },
};
