import type { Messages } from "../nl";

/** Working on a course together: editors and co-owners (BESLUIT-2026-11-10-5). */
export const courseMembers: Messages["courseMembers"] = {
  add: "Add",
  addLabel: "Colleague",
  addNone: "Choose a colleague",
  admin: {
    add: "Add",
    addLabel: "Colleague",
    allLabel: "All courses to",
    allSubmit: "Hand all over",
    heading: "Courses",
    intro:
      "The courses this person owns. Hand them to a colleague or choose who works on them, also when the teacher is no longer active. The new owner gets the course at once.",
    keep: "Keeps working on it as editor",
    lost: "Courses without a co-owner: {n}. They are lost when you delete this account; hand them over under Courses first. A course with a co-owner goes to that co-owner by itself.",
    nobody: "Nobody works on it yet.",
    none: "No courses of their own.",
    refused: "That did not work. Choose an active colleague.",
    removeLabel: "Remove {name} from {course}",
    saved: "Saved.",
    submitLabel: "Hand {course} over",
    to: "New owner",
    transferred: "Courses handed over: {n}.",
  },
  empty: "Nobody works on it with you yet.",
  errorAdd: "That did not work. Do you share a team with this colleague?",
  errorTransfer: "Handing over did not work. Choose a colleague from your teams.",
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
  ownLost:
    "Courses without a co-owner: {n}. They go with your account; hand them over on the course page first.",
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
  toastTransferred: "Handed over. You now work on it as editor.",
  transfer: "Hand the course over",
  transferIntro:
    "The colleague becomes the owner at once. Shared teams, the place in programmes and who works on it go along; the educational context does not. What you made with a tool stays yours.",
  transferKeep: "I keep working on it as editor",
  transferSubmit: "Hand over",
  transferTo: "New owner",
  youAre:
    "You work on this course by {owner}, as {role}. Deleting it and choosing the educational context is up to the owner.",
};
