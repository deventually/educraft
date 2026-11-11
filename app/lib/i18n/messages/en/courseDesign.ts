import type { Messages } from "../nl";

/** The course wizard: how a new course starts, step 1 (outcomes), 2 (tests) and 3 (lessons). */
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
  lessons: {
    added:
      "{n} lessons and assignments added. You find them under Lessons and tests; from each lesson, Prepare a lesson takes it further.",
    apply: "Add lessons",
    errors: {
      failed: "Could not propose a lesson series. Try again, or add the lessons yourself.",
      invalid: "Enter whole numbers and describe your wishes in 500 characters at most.",
      nothing: "The AI needs more to propose a lesson series. Read the note below.",
      notReady:
        "A lesson series can be proposed when the course has learning outcomes and tests, and no lessons yet.",
      quota:
        "AI limit reached: your allowance for this month is used up, or you used a lot of AI today (then it works again tomorrow). The Usage page shows your month.",
    },
    intro:
      "The learning outcomes and tests are set. How do students get there? The AI proposes lessons and assignments per week, each with a lesson goal, that teach the learning outcomes before they are tested. You choose what goes in.",
    late: "Learning outcome {n} is tested in week {week} ({test}), but only comes up in a lesson after that.",
    lessonN: "Lesson {n}",
    noWeek: "No week",
    numbersHelp: "Optional. What you fill in here also goes into the timetable.",
    pending: "The AI is proposing a lesson series…",
    proposalIntro:
      "The AI made this lesson series for your learning outcomes and tests. Tick what goes into the course and edit where needed; you work out each lesson later with Prepare a lesson.",
    ready: "Lesson series ready. Choose what goes into the course.",
    sessionsPerWeek: "Teaching sessions per week",
    submit: "Propose a lesson series",
    title: "Next step: the lesson series",
    untaught: "These learning outcomes are in no lesson: {list}",
    week: "Week {n}",
    weeks: "Number of weeks",
    wishes: "Wishes for the planning",
    wishesHelp:
      "Optional. For example: week 4 is a project week, or every week starts with a lecture.",
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
