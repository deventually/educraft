import type { Messages } from "../nl";

export const auditLog: Messages["auditLog"] = {
  actions: {
    accountCreated: "Account created",
    accountDeleted: "Account deleted",
    deactivated: "Deactivated",
    instanceModelsChanged: "Instance models changed",
    inviteCreated: "Invite created",
    inviteRevoked: "Invite revoked",
    logCleaned: "Audit log cleaned up",
    passwordSet: "Password set",
    reactivated: "Reactivated",
    resetLinkCreated: "Reset link created",
    roleChanged: "Role changed",
    teacherModelsChanged: "Teacher's models changed",
  },
  bulk: "via selection",
  cleaned: "{n} entries older than {days} days",
  cleanedAll: "{n} entries, everything",
  cleanup: {
    all: "Everything",
    choiceLabel: "What to delete",
    confirm: "Delete permanently",
    description:
      "Warning: this cannot be undone. The deleted entries are gone for good, for you too. The cleanup itself is added to the log as a new entry.",
    done: "{n} entries deleted.",
    heading: "Clean up",
    intro:
      "The log cleans itself up: entries are removed automatically after a year. Only the owner can clean up earlier.",
    olderThan: "Older than {n} days",
    title: "Clean up the audit log?",
    trigger: "Clean up audit log",
    typeLabel: "Type {word} to confirm",
    word: "CLEAN UP",
  },
  colAction: "What",
  colActor: "Who",
  colTarget: "For whom",
  colWhen: "When",
  deletedAccount: "Deleted account",
  empty: "No admin actions recorded yet.",
  followsInstance: "Follows the instance",
  heading: "Audit log",
  intro:
    "Who changed what in roles, passwords, accounts, invites and the model choice. The newest {n} actions are at the top.",
  invites: "{n} invites",
  role: "Role: {role}",
};
