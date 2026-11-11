import type { FlashKey } from "~/lib/flash";

export const toast = {
  dismiss: "Melding sluiten",
  // Shown once after a redirect (P16); one per key in `~/lib/flash`.
  flash: {
    accountDeleted: "Je account is verwijderd.",
    dossierCreated: "Dossier aangemaakt. Loop de vier stappen door, of sla er een over.",
    passwordReset: "Je wachtwoord is gewijzigd. Je bent ingelogd.",
    rubricDeleted: "Rubric verwijderd.",
    rubricDuplicated: "Kopie gemaakt. Je bewerkt nu de kopie.",
    signedIn: "Je bent ingelogd.",
    signedOut: "Je bent uitgelogd.",
    signedOutEverywhere: "Je bent op al je apparaten uitgelogd.",
    steppedDown: "Je bent geen teamleider meer van dit team.",
    teamDeleted: "Team verwijderd.",
    userDeleted: "Gebruiker verwijderd.",
    welcome: "Welkom! Je account is aangemaakt.",
  } satisfies Record<FlashKey, string>,
  regionLabel: "Meldingen",
  saving: "Bezig…",
};
