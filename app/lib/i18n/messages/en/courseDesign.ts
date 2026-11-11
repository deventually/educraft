import type { Messages } from "../nl";

/** The course wizard: how a new course starts, step 1 (outcomes) and step 2 (the test programme). */
export const courseDesign: Messages["courseDesign"] = {
  assessments: {
    errors: {
      failed: "Could not propose a test programme. Try again, or add the tests yourself.",
      invalid: "Name the assessment forms in 500 characters at most.",
      nothing: "The AI needs more to propose a test programme. Read the note below.",
      notReady:
        "A test programme can be proposed when the course has learning outcomes and no tests yet.",
      quota:
        "AI limit reached: your allowance for this month is used up, or you used a lot of AI today (then it works again tomorrow). The Usage page shows your month.",
    },
    forms: "Assessment forms you use",
    formsHelp:
      "Optional. For example: knowledge test, professional product, presentation. The AI then chooses from these forms.",
    intro:
      "The learning outcomes are set. How do you know students master them? The AI proposes summative tests with a weight, and formative practice moments before them. You choose what goes in.",
    pending: "The AI is proposing a test programme…",
    proposalIntro:
      "The AI made this test programme for your learning outcomes. Tick what goes into the course and edit where needed. The weights are a proposal: you decide as the examiner.",
    ready: "Test programme ready. Choose what goes into the course.",
    submit: "Propose a test programme",
    title: "Next step: the test programme",
    uncovered: "These learning outcomes are in no summative test: {list}",
    weight: "Weight (the AI's proposal)",
    weightsOff: "The proposed weights do not add up to 100%. Adjust them before you add.",
  },
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
