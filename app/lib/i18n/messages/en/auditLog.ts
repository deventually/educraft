import type { Messages } from "../nl";

export const auditLog: Messages["auditLog"] = {
  actions: {
    accountCreated: "Account created",
    accountDeleted: "Account deleted",
    deactivated: "Deactivated",
    instanceModelsChanged: "Instance models changed",
    inviteCreated: "Invite created",
    inviteRevoked: "Invite revoked",
    passwordSet: "Password set",
    reactivated: "Reactivated",
    resetLinkCreated: "Reset link created",
    roleChanged: "Role changed",
    teacherModelsChanged: "Teacher's models changed",
  },
  bulk: "via selection",
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
