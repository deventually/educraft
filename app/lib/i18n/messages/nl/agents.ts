/** Role agents ("Laat beoordelen", brief P21). */
export const agents = {
  admin: {
    caption: "Alle petten met wat ze nakijken en hun stand.",
    colHat: "Pet",
    colStand: "Stand",
    colWatches: "Kijkt naar",
    hatsHeading: "Petten",
    hatsIntro:
      "Een pet die uit staat, kijkt niet meer mee. Zijn eerdere adviezen blijven bewaard en komen terug als je hem weer aanzet.",
    heading: "Rolagenten",
    intro:
      "De petten zijn kritische collega's die docenten advies geven bij hun cursus. Zet hier het hele onderdeel aan of uit, en elke pet apart.",
    mainHint:
      "Dit is dezelfde schakelaar als bij Onderdelen op Tools en modellen. Teams en uitzonderingen per docent werken zoals daar.",
    mainLabel: "Rolagenten voor docenten",
    mainOff: "Rolagenten staan uit. Dan staan alle petten stil, wat je hieronder ook kiest.",
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
    decided: "Afgehandeld ({n})",
    decision: { accepted: "Akkoord", rejected: "Niet akkoord" },
    includeLinked: "Ook de gekoppelde toetsvragen nakijken ({n})",
    intro:
      "Kritische collega's kijken je cursus na: {roles}. Ze geven advies; jij beslist per advies. Er verandert niets aan je cursus.",
    model: "Model",
    none: "Geen adviezen van deze pet.",
    notYet: "Nog niet beoordeeld.",
    pending: "De petten kijken je cursus na…",
    reason: "Reden (optioneel)",
    reject: "Niet akkoord",
    reviewedWith: "Beoordeeld met {model}",
    run: "Laat beoordelen",
    severity: { info: "Tip", warning: "Let op" },
    stale:
      "Je cursus is gewijzigd na deze beoordeling. Laat opnieuw beoordelen voor actueel advies.",
    suggestion: "Voorstel",
    title: "Beoordeling",
    wholeCourse: "Over de hele cursus",
  },
  review: {
    done: "De beoordeling is klaar.",
    failed: "De beoordeling is mislukt. Probeer het later opnieuw.",
    model: "Dit model is niet voor jou beschikbaar. Kies een ander model.",
    partial: "De beoordeling is klaar, maar {agents} gaf geen bruikbaar antwoord.",
    quota: "Je hebt je dagelijkse limiet bereikt. Probeer het morgen opnieuw.",
  },
};
