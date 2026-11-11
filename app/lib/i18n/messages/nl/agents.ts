/** Role agents, shown to teachers as the "Reviewteam" (brief P21, BESLUIT-2026-11-10-2). */
export const agents = {
  admin: {
    caption: "Alle reviewers met wat ze nakijken en hun stand.",
    colHat: "Reviewer",
    colStand: "Stand",
    colWatches: "Kijkt naar",
    hatsHeading: "Reviewers",
    hatsIntro:
      "Een reviewer die uit staat, kijkt niet meer mee. Zijn eerdere adviezen blijven bewaard en komen terug als je hem weer aanzet.",
    heading: "Reviewteam",
    intro:
      "Het reviewteam bestaat uit kritische collega's (AI) die docenten advies geven bij hun cursus. Zet hier het hele onderdeel aan of uit, en elke reviewer apart.",
    mainHint:
      "Dit is dezelfde schakelaar als bij Onderdelen op Tools en modellen. Een team kan het reviewteam niet aan- of uitzetten; dat gaat voor de hele instelling. Een uitzondering voor één docent kan wel, op diens persoonspagina.",
    mainLabel: "Reviewteam voor docenten",
    mainOff:
      "Het reviewteam staat uit. Dan kijkt geen enkele reviewer mee, wat je hieronder ook kiest.",
    standLabel: "Stand van {name}",
    watches: { course: "cursus", generation: "gekoppelde toetsvragen" },
  },
  decide: {
    done: "Je besluit is vastgelegd.",
    invalid: "Dit besluit kon niet worden vastgelegd. Controleer je reden (hooguit 500 tekens).",
    notFound: "Dit advies bestaat niet (meer).",
  },
  panel: {
    about: "Over: {item}",
    accept: "Akkoord",
    chooseLegend: "Wie zit in je reviewteam?",
    chooseMore: "Meer over het reviewteam",
    chooseNone: "Kies minstens één reviewer om te laten reviewen.",
    decided: "Afgehandeld ({n})",
    decision: { accepted: "Akkoord", rejected: "Niet akkoord" },
    includeLinked: "Ook de gekoppelde toetsvragen nakijken ({n})",
    intro:
      "Je reviewteam kijkt je cursus na: {roles}. Ze geven advies; jij beslist per advies. Er verandert niets aan je cursus.",
    introNone:
      "Je reviewteam kijkt je cursus na. Ze geven advies; jij beslist per advies. Er verandert niets aan je cursus.",
    model: "Model",
    none: "Geen adviezen van deze reviewer.",
    notYet: "Nog niet gereviewd.",
    pending: "Je reviewteam kijkt je cursus na…",
    reason: "Reden (optioneel)",
    reject: "Niet akkoord",
    reviewedWith: "Gereviewd met {model}",
    run: "Laat reviewen",
    severity: { info: "Tip", warning: "Let op" },
    stale: "Je cursus is gewijzigd na deze review. Laat opnieuw reviewen voor actueel advies.",
    suggestion: "Voorstel",
    title: "Reviewteam",
    wholeCourse: "Over de hele cursus",
  },
  review: {
    done: "De review is klaar.",
    failed: "De review is mislukt. Probeer het later opnieuw.",
    model: "Dit model is niet voor jou beschikbaar. Kies een ander model.",
    none: "Kies minstens één reviewer om je cursus te laten reviewen.",
    partial: "De review is klaar, maar {agents} gaf geen bruikbaar antwoord.",
    quota:
      "AI-limiet bereikt: je daglimiet of de limiet voor deze maand. Op de pagina Gebruik zie je welke.",
  },
};
