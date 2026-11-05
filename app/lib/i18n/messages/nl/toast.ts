import type { FlashKey } from "~/lib/flash";

export const toast = {
  dismiss: "Melding sluiten",
  // Shown once after a redirect (P16); one per key in `~/lib/flash`.
  flash: {
    accountDeleted: "Je account is verwijderd.",
    passwordReset: "Je wachtwoord is gewijzigd. Je bent ingelogd.",
    rubricDeleted: "Rubric verwijderd.",
    rubricDuplicated: "Kopie gemaakt. Je bewerkt nu de kopie.",
    signedIn: "Je bent ingelogd.",
    signedOut: "Je bent uitgelogd.",
    steppedDown: "Je bent geen teamleider meer van dit team.",
    teamDeleted: "Team verwijderd.",
    userDeleted: "Gebruiker verwijderd.",
    welcome: "Welkom! Je account is aangemaakt.",
  } satisfies Record<FlashKey, string>,
  regionLabel: "Meldingen",
  saving: "Bezig…",
};
