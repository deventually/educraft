import type { Messages } from "../nl";

/** The course wizard: how a new course starts, and step 1 (learning outcomes from a description). */
export const courseDesign: Messages["courseDesign"] = {
  description: "What is the course about?",
  descriptionHelp:
    "Two to five sentences: what is the course about, and what should students be able to do at the end? The AI also uses the course's teaching context and disciplines.",
  ec: "Study load (EC)",
  errors: {
    failed: "Could not propose learning outcomes. Try again, or write them yourself.",
    invalid: "Describe the course in a few sentences (2000 characters at most).",
    nothing:
      "The AI needs more to propose learning outcomes. Read the note below and add to your description.",
    quota:
      "AI limit reached: your allowance for this month is used up, or you used a lot of AI today (then it works again tomorrow). The Usage page shows your month.",
  },
  numbersHelp: "Optional. What you fill in here also goes into the course details and schedule.",
  pending: "The AI is proposing learning outcomes…",
  proposalIntro:
    "The AI made this proposal from your description. Tick what goes into the course and edit the text where needed; it all stays yours.",
  proposalTitle: "AI proposal",
  ready: "Proposal ready. Choose what goes into the course.",
  start: {
    blank: {
      body: "You write the learning outcomes yourself.",
      cta: "To learning outcomes",
      title: "Start empty",
    },
    design: {
      body: "Describe the course in a few sentences. The AI proposes learning outcomes with success criteria; you choose and edit.",
      title: "Design in broad outline",
    },
    document: {
      body: "Already have a programme regulation, study guide or test blueprint? Take the learning outcomes and tests from it.",
      cta: "To import",
      title: "Start from a document",
    },
    intro: "Your course is still empty. Choose how to start; you can change everything later.",
    title: "How do you want to start?",
  },
  submit: "Propose learning outcomes",
  weeks: "Number of weeks",
};
