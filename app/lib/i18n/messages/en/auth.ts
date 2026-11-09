import type { Messages } from "../nl";

export const auth: Messages["auth"] = {
  accountArea: "Account",
  accountDisabled: "This account is deactivated. Contact your administrator.",
  createAccount: "Create account",
  email: "Email address",
  emailLoginHint: "Without an email address you won't be able to log back in yourself later.",
  emailOptional: "Email address (optional)",
  inviteHeading: "Create your account",
  inviteIntro: "You've been invited. Create your account to get started.",
  inviteInvalid:
    "This invitation link is invalid, already used, or expired. Please request a new one.",
  inviteInvalidTitle: "Invitation invalid",
  loggedInAs: "Logged in as {name}",
  login: "Log in",
  loginFailed: "Incorrect email or password.",
  loginHeading: "Log in",
  loginIntro: "Log in to continue.",
  logout: "Log out",
  name: "Name",
  nameRequired: "Name is required.",
  password: "Password",
  passwordMismatch: "The passwords do not match.",
  passwordRepeat: "Repeat password",
  passwordTooShort: "Password must be at least 10 characters.",
  resetHeading: "Set a new password",
  resetIntro: "Choose a new password for your account.",
  resetInvalid:
    "This reset link is invalid, already used, or expired. Ask your admin for a new one.",
  resetInvalidTitle: "Link invalid",
  resetSubmit: "Save password",
  tooManyAttempts:
    "Too many failed attempts. Try again in {minutes} minutes, or ask your administrator for a new password.",
};
