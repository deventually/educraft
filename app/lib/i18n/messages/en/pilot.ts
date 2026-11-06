import type { Messages } from "../nl";

export const pilot: Messages["pilot"] = {
  checkin: {
    heading: "How is the pilot going?",
    intro: "Three short questions, all optional. You see this at most once every two weeks.",
    notNow: "Not now",
    questions: {
      annoyed: "What annoyed you?",
      helped: "What helped you lately?",
      missing: "What are you still missing?",
    },
    submit: "Send",
    thanks: "Thanks, this really helps us.",
  },
  overview: {
    allTeams: "All teams",
    checkinsEmpty: "No check-in answers yet.",
    checkinsHeading: "What teachers say in the check-in",
    colComments: "Comments",
    colDate: "Date",
    colDown: "Thumbs down",
    colQuality: "Quality (1-5)",
    colTeacher: "Teacher",
    colTime: "Time saved",
    colTool: "Tool",
    colUp: "Thumbs up",
    colUses: "Used",
    empty: "Nothing to show for this selection yet.",
    heading: "Pilot per tool",
    hours: "{h} h",
    hoursMinutes: "{h} h {m} min",
    intro:
      "How often each tool was used and what teachers think of it, since the start. The number in brackets is how many answers it rests on. For time, 60+ counts as 60 minutes, so the real saving is likely higher.",
    minutes: "{m} min",
    show: "Show",
    teamLabel: "Team",
  },
};
