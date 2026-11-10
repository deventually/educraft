import type { Messages } from "../nl";

/** Role agents ("Get a review", brief P21). */
export const agents: Messages["agents"] = {
  admin: {
    caption: "Every hat with what it reviews and its stand.",
    colHat: "Hat",
    colStand: "Stand",
    colWatches: "Looks at",
    hatsHeading: "Hats",
    hatsIntro:
      "A hat that is off no longer reviews. Its earlier advice is kept and comes back when you switch it on again.",
    heading: "Role agents",
    intro:
      "The hats are critical colleagues who advise teachers on their course. Switch the whole part on or off here, and each hat separately.",
    mainHint:
      "This is the same switch as under Parts on Tools and models. A team cannot switch role agents on or off; that goes for the whole instance. An exception for one teacher is possible, on their person page.",
    mainLabel: "Role agents for teachers",
    mainOff: "Role agents are off. Then every hat rests, whatever you choose below.",
    standLabel: "Stand of {name}",
    watches: { course: "course", generation: "linked test questions" },
  },
  decide: {
    done: "Your decision is recorded.",
    invalid: "This decision could not be recorded. Check your reason (at most 500 characters).",
    notFound: "This advice does not exist (any more).",
  },
  panel: {
    about: "About: {item}",
    accept: "Agree",
    chooseLegend: "Which hats review your course?",
    chooseMore: "More about the hats",
    chooseNone: "Pick at least one hat to get a review.",
    decided: "Handled ({n})",
    decision: { accepted: "Agree", rejected: "Disagree" },
    includeLinked: "Also review the linked test questions ({n})",
    intro:
      "Critical colleagues review your course: {roles}. They advise; you decide on each piece of advice. Nothing in your course changes.",
    introNone:
      "Critical colleagues review your course. They advise; you decide on each piece of advice. Nothing in your course changes.",
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
    none: "Pick at least one hat to have your course reviewed.",
    partial: "The review is ready, but {agents} gave no usable answer.",
    quota: "You have reached your daily limit. Please try again tomorrow.",
  },
};
