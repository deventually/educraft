import type { Messages } from "../nl";

/** Working on a course together (BESLUIT-2026-11-10-3). */
export const courseEditors: Messages["courseEditors"] = {
  add: "Add as editor",
  addLabel: "Choose an editor",
  addNone: "Choose a colleague",
  editorNote:
    "You are an editor of this course by {owner}. You change its content; deleting, sharing and choosing editors is up to the owner.",
  empty: "No editors yet.",
  errorAdd: "Adding did not work. Do you share a team with this colleague?",
  heading: "Work on this course together",
  intro:
    "Colleagues from your teams whom you add as editor change the course as you do. Deleting, sharing and choosing editors stay with you. What someone makes with a tool stays theirs.",
  leave: "Stop editing",
  leaveConfirm: "Stop editing? The course leaves your list; your linked work stays yours.",
  listLabel: "Editors",
  noTeammates:
    "You do not share a team with a colleague yet. An admin or team lead puts you in a team.",
  owner: "Owner: {owner}",
  ownerBadge: "By {owner}",
  profileOwner: "The owner chooses the educational context.",
  remove: "Remove",
  removeLabel: "Remove {name} as editor",
  toastAdded: "Editor added.",
  toastRemoved: "Editor removed.",
};
