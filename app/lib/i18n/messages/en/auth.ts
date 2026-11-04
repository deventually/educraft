import type { Messages } from "../nl";

export const auth: Messages["auth"] = {
  loginHeading: "Log in",
  loginIntro: "Log in to continue.",
  email: "Email address",
  emailOptional: "Email address (optional)",
  password: "Password",
  passwordRepeat: "Repeat password",
  login: "Log in",
  loginFailed: "Incorrect email or password.",
  accountDisabled: "This account is deactivated. Contact your administrator.",
  logout: "Log out",
  name: "Name",
  inviteHeading: "Create your account",
  inviteIntro: "You've been invited. Create your account to get started.",
  createAccount: "Create account",
  inviteInvalidTitle: "Invitation invalid",
  inviteInvalid:
    "This invitation link is invalid, already used, or expired. Please request a new one.",
  nameRequired: "Name is required.",
  passwordTooShort: "Password must be at least 10 characters.",
  passwordMismatch: "The passwords do not match.",
  loggedInAs: "Logged in as {name}",
  accountArea: "Account",
  emailLoginHint: "Without an email address you won't be able to log back in yourself later.",
  resetHeading: "Set a new password",
  resetIntro: "Choose a new password for your account.",
  resetInvalidTitle: "Link invalid",
  resetInvalid:
    "This reset link is invalid, already used, or expired. Ask your admin for a new one.",
  resetSubmit: "Save password",
};
