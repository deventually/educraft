import type { Messages } from "../nl";

/** Working on a course together: editors and co-owners (BESLUIT-2026-11-10-4). */
export const courseMembers: Messages["courseMembers"] = {
  add: "Add",
  addLabel: "Colleague",
  addNone: "Choose a colleague",
  empty: "Nobody works on it with you yet.",
  errorAdd: "That did not work. Do you share a team with this colleague?",
  heading: "Work on this course together",
  intro:
    "Add colleagues from your teams. An editor changes the content. A co-owner can also share the course and add or remove people. Only the owner deletes the course and chooses the educational context. What someone makes with a tool stays theirs.",
  leave: "Stop working on it",
  leaveConfirm: "Stop working on this course? It leaves your list; your linked work stays yours.",
  listLabel: "Working on it",
  noTeammates:
    "You do not share a team with a colleague yet. An admin or team lead puts you in a team.",
  owner: "Owner: {owner}",
  ownerBadge: "By {owner} · {role}",
  profileOwner: "The owner chooses the educational context.",
  remove: "Remove",
  removeLabel: "Remove {name}",
  role: "Role",
  roleLabel: "Role of {name}",
  roles: { "co-owner": "Co-owner", editor: "Editor", owner: "Owner" },
  save: "Save",
  saveLabel: "Save the role of {name}",
  toastAdded: "Saved.",
  toastRemoved: "Removed.",
  youAre:
    "You work on this course by {owner}, as {role}. Deleting it and choosing the educational context is up to the owner.",
};
