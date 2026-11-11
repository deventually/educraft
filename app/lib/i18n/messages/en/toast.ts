import type { Messages } from "../nl";

export const toast: Messages["toast"] = {
  dismiss: "Dismiss notification",
  // Shown once after a redirect (P16); one per key in `~/lib/flash`.
  flash: {
    accountDeleted: "Your account has been deleted.",
    dossierCreated: "Dossier created. Go through the four steps, or skip one.",
    passwordReset: "Your password has been changed. You are signed in.",
    rubricDeleted: "Rubric deleted.",
    rubricDuplicated: "Copy made. You are now editing the copy.",
    signedIn: "You are signed in.",
    signedOut: "You are signed out.",
    signedOutEverywhere: "You are signed out on all your devices.",
    steppedDown: "You are no longer a team lead of this team.",
    teamDeleted: "Team deleted.",
    userDeleted: "User deleted.",
    welcome: "Welcome! Your account has been created.",
  },
  regionLabel: "Notifications",
  saving: "Working…",
};
