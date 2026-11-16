import type { Messages } from "../nl";

export const menu: Messages["menu"] = {
  account: {
    context: "My teaching context",
    usage: "My AI use",
  },
  admin: {
    agents: "Which reviewers can check a course.",
    aiUsage: "What AI costs, per person and per model.",
    announcements: "A message at the top for everyone.",
    audit: "Who did what in Admin.",
    context: "Institution teaching context",
    contextDescription: "Levels, sectors and the school calendar of the institution.",
    errors: "Errors of the last few days, for the owner.",
    feedback: "What teachers report, and the pilot.",
    groups: {
      ai: "AI",
      control: "Oversight",
      organisation: "Organisation",
      people: "People",
    },
    organisation: "Faculties and programmes",
    organisationDescription: "How the institution is divided, and which programme sits where.",
    overview: "Overview and setup",
    overviewDescription: "How far setup has come, and all of Admin in one place.",
    teams: "Teams of colleagues, their leads and their programmes.",
    tools: "Which tools and AI models are available.",
    users: "Accounts, roles and invitations.",
  },
  breadcrumb: "Breadcrumb",
  education: {
    courses: "Your courses and your team's",
    label: "Education",
    programmes: "Programmes",
    programmesDescription: "Per programme its courses and learning lines",
  },
  tools: {
    all: "All tools",
    assessmentModels: "Assessment models",
    projects: "Earlier work",
    utilities: "Utilities",
  },
};
