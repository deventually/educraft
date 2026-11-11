/** The course wizard: how a new course starts, and step 1 (learning outcomes from a description). */
export const courseDesign = {
  description: "Waar gaat de cursus over?",
  descriptionHelp:
    "Twee tot vijf zinnen: waar gaat de cursus over, en wat moeten studenten aan het eind kunnen? De AI gebruikt ook de onderwijscontext en de disciplines van de cursus.",
  ec: "Studielast (EC)",
  errors: {
    failed:
      "Het lukte niet om leeruitkomsten voor te stellen. Probeer het opnieuw, of schrijf ze zelf.",
    invalid: "Beschrijf de cursus in een paar zinnen (hooguit 2000 tekens).",
    nothing:
      "De AI heeft meer nodig om leeruitkomsten voor te stellen. Lees de toelichting hieronder en vul je beschrijving aan.",
    quota:
      "AI-limiet bereikt: je ruimte voor deze maand is op, of je gebruikte vandaag heel veel AI (dan kan het morgen weer). Op de pagina Gebruik zie je je maand.",
  },
  numbersHelp:
    "Niet verplicht. Wat je hier invult, komt ook in de cursusgegevens en het lesrooster.",
  pending: "De AI stelt leeruitkomsten voor…",
  proposalIntro:
    "De AI maakte dit voorstel uit je beschrijving. Vink aan wat in de cursus komt en pas de tekst aan waar nodig; alles blijft van jou.",
  proposalTitle: "AI-voorstel",
  ready: "Voorstel klaar. Kies wat in de cursus komt.",
  start: {
    blank: {
      body: "Je schrijft de leeruitkomsten zelf.",
      cta: "Naar leeruitkomsten",
      title: "Begin leeg",
    },
    design: {
      body: "Beschrijf de cursus in een paar zinnen. De AI stelt leeruitkomsten met succescriteria voor; jij kiest en past aan.",
      title: "In grote lijnen ontwerpen",
    },
    document: {
      body: "Heb je al een OER, studiehandleiding of toetsmatrijs? Haal de leeruitkomsten en toetsen daaruit.",
      cta: "Naar importeren",
      title: "Begin met een document",
    },
    intro: "Je cursus is nog leeg. Kies hoe je begint; je kunt later alles aanpassen.",
    title: "Hoe wil je beginnen?",
  },
  submit: "Leeruitkomsten voorstellen",
  weeks: "Aantal weken",
};
