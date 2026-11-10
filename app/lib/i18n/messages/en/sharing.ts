import type { Messages } from "../nl";

/** Sharing with your team (P28.4). */
export const sharing: Messages["sharing"] = {
  back: "Back",
  copy: "Make a copy",
  copyLabel: "Make a copy of {name}",
  errorNotFound: "This is not (or no longer) shared with your team.",
  errorShare: "Sharing with this team did not work. Are you in the team yourself?",
  fromTeam: "From my team",
  fromTeamIntro:
    "What colleagues share with your team. You can view it and make your own copy; only the owner edits it.",
  heading: "Share with your team",
  intro:
    "Colleagues in the team can view this and make their own copy. Sharing gives no right to edit. You can stop sharing at any time; a copy a colleague made stays theirs.",
  owner: "By {owner} · {teams}",
  readOnly: "Read only: this belongs to {owner}. Make a copy to get your own version.",
  share: "Share",
  shared: "Shared",
  shareLabel: "Share with {team}",
  stop: "Stop sharing",
  stopLabel: "Stop sharing with {team}",
  toastCopied: "Copy made.",
  toastShared: "Shared with your team.",
  toastStopped: "No longer shared.",
  view: "View",
  work: {
    empty: "There is no work for this course yet that you may see.",
    intro:
      "What the owner made with the tools for this course. Work from tools that process student work never shows here.",
    show: "Show result",
    title: "Work made",
  },
};
