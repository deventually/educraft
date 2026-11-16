/** Beheer → Overzicht en inrichten: the setup list and every admin page in one place. */
export const adminSetup = {
  all: "Alles van Beheer",
  heading: "Inrichten in zes stappen",
  intro:
    "Richt de instelling in van boven naar beneden. Een stap is klaar zodra hij gedaan is; de optionele stappen sla je over als je instelling geen faculteiten heeft.",
  list: "Inrichten",
  numbers: {
    divisions: { one: "{n} faculteit", other: "{n} faculteiten" },
    heading: "In cijfers",
    programmes: { one: "{n} opleiding", other: "{n} opleidingen" },
    teams: { one: "{n} team", other: "{n} teams" },
    users: { one: "{n} gebruiker", other: "{n} gebruikers" },
  },
  progress: "{done} van {total} vaste stappen klaar",
  status: {
    done: "Klaar",
    optional: "Optioneel",
    todo: "Nog te doen",
  },
  steps: {
    divisions: {
      action: "Naar Faculteiten en opleidingen",
      body: "Eén per faculteit. Opleidingen en teams zet je er later onder.",
      title: "Maak de faculteiten aan",
    },
    kind: {
      action: "Naar Faculteiten en opleidingen",
      body: "Bijvoorbeeld faculteit, college of vestiging: de laag tussen de instelling en haar opleidingen.",
      title: "Kies het woord voor de laag onder de instelling",
    },
    people: {
      action: "Naar Gebruikers",
      body: "Maak accounts of uitnodigingslinks voor de docenten.",
      title: "Nodig collega's uit",
    },
    placement: {
      action: "Naar Faculteiten en opleidingen",
      body: "Dan vindt iedereen de opleidingen per faculteit terug.",
      title: "Zet elke opleiding onder een faculteit",
    },
    programmes: {
      action: "Naar Opleidingen",
      body: "Voltijd, deeltijd en duaal elk apart. Een opleiding hoort bij een of meer teams.",
      title: "Maak de opleidingen aan",
    },
    teams: {
      action: "Naar Teams",
      body: "Een team per opleiding of per module, met een teamleider. Elk team heeft minstens één lid.",
      title: "Maak teams en zet collega's erin",
    },
  },
};
