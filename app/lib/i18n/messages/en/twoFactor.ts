import type { Messages } from "../nl";

export const twoFactor: Messages["twoFactor"] = {
  accountCardIntro:
    "A second step when you log in: after your password, a code from an app on your phone.",
  accountCardManage: "Manage two-step verification",
  accountCardSetUp: "Set up two-step verification",
  adminLabel: "Two-step verification",
  adminReset: "Turn off two-step verification",
  adminResetConfirm:
    "{name} will then log in with a password only and has to set up two-step verification again. Only do this when {name} has lost both the phone and the recovery codes. This goes in the audit log.",
  adminResetDone: "Two-step verification is off for this person.",
  adminResetTitle: "Turn off two-step verification?",
  appExamples:
    "For example Microsoft Authenticator, Google Authenticator, Authy, 1Password, Bitwarden or the Passwords app on an iPhone.",
  backToAccount: "Back to your account",
  codeLabel: "Code from your app",
  codeOrRecoveryLabel: "Code from your app or a recovery code",
  codeWrong:
    "That code is not right. Check that the time on your phone is correct and try the newest code.",
  confirmButton: "Confirm",
  disableButton: "Turn off",
  disabled: "Two-step verification is off.",
  disableHeading: "Turn off",
  disableIntro: "You will then log in with your password only.",
  enabled: "Two-step verification is on.",
  heading: "Two-step verification",
  intro:
    "After your password, LimeOnIt asks for a six-digit code from an authenticator app on your phone. Someone who only knows your password cannot get in.",
  loginBack: "Back to log in",
  loginButton: "Continue",
  loginHeading: "Two-step verification",
  loginIntro:
    "Open your authenticator app and type the six-digit code for LimeOnIt. Lost your phone? Type one of your recovery codes.",
  loginWrong: "That code is not right. Try the newest code from your app, or a recovery code.",
  manualKey: "Can't scan? Type this key into your app instead:",
  newCodesButton: "Make new recovery codes",
  newCodesHeading: "New recovery codes",
  newCodesIntro: "Lost them or nearly out? Make new codes. The old codes then stop working.",
  qrAlt: "QR code to add LimeOnIt to your authenticator app",
  recoveryHeading: "Your recovery codes",
  recoveryIntro:
    "Keep these codes somewhere safe, for example in your password manager or printed. If you lose your phone, log in with one of them. Each code works once, and you only see them now.",
  recoveryLeft: "{n} recovery codes left.",
  required:
    "Two-step verification is required for administrators. Set it up to open the admin pages.",
  requiredCannotDisable:
    "Two-step verification is required for administrators, so you cannot turn it off.",
  selfReset:
    "You manage your own two-step verification from your account. Lost everything? Then the server turns it off (reset-2fa).",
  startButton: "Set up",
  statusLabel: "Status",
  statusOff: "Off",
  statusOn: "On",
  step1: "1. Scan this QR code with your authenticator app.",
  step2: "2. Type the six-digit code your app shows now.",
};
