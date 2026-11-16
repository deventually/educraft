import type { Messages } from "../nl";

export const adminSetup: Messages["adminSetup"] = {
  all: "All of Admin",
  heading: "Set up in six steps",
  intro:
    "Set up the institution from top to bottom. A step is done once it has been done; skip the optional steps if your institution has no faculties.",
  list: "Setup",
  numbers: {
    divisions: { one: "{n} faculty", other: "{n} faculties" },
    heading: "At a glance",
    programmes: { one: "{n} programme", other: "{n} programmes" },
    teams: { one: "{n} team", other: "{n} teams" },
    users: { one: "{n} user", other: "{n} users" },
  },
  progress: "{done} of {total} required steps done",
  status: {
    done: "Done",
    optional: "Optional",
    todo: "To do",
  },
  steps: {
    divisions: {
      action: "To Faculties and programmes",
      body: "One per faculty. Programmes and teams go under them later.",
      title: "Create the faculties",
    },
    kind: {
      action: "To Faculties and programmes",
      body: "For example faculty, college or location: the layer between the institution and its programmes.",
      title: "Choose the word for the layer under the institution",
    },
    people: {
      action: "To Users",
      body: "Create accounts or invitation links for the teachers.",
      title: "Invite colleagues",
    },
    placement: {
      action: "To Faculties and programmes",
      body: "Then everyone finds the programmes per faculty.",
      title: "Put every programme under a faculty",
    },
    programmes: {
      action: "To Programmes",
      body: "Full-time, part-time and dual each on their own. A programme belongs to one or more teams.",
      title: "Create the programmes",
    },
    teams: {
      action: "To Teams",
      body: "A team per programme or per module, with a lead. Every team has at least one member.",
      title: "Create teams and add colleagues",
    },
  },
};
