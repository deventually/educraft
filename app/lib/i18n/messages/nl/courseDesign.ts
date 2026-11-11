/** The course wizard: how a new course starts, step 1 (outcomes), 2 (tests) and 3 (lessons). */
export const courseDesign = {
  assessments: {
    errors: {
      failed:
        "Het lukte niet om een toetsprogramma voor te stellen. Probeer het opnieuw, of voeg de toetsen zelf toe.",
      invalid: "Noem de toetsvormen in hooguit 500 tekens.",
      nothing:
        "De AI heeft meer nodig om een toetsprogramma voor te stellen. Lees de toelichting hieronder.",
      notReady:
        "Een toetsprogramma laten voorstellen kan als de cursus leeruitkomsten heeft en nog geen toetsen.",
      quota:
        "AI-limiet bereikt: je ruimte voor deze maand is op, of je gebruikte vandaag heel veel AI (dan kan het morgen weer). Op de pagina Gebruik zie je je maand.",
    },
    forms: "Toetsvormen die jullie gebruiken",
    formsHelp:
      "Niet verplicht. Bijvoorbeeld: kennistoets, beroepsproduct, presentatie. Dan kiest de AI uit deze vormen.",
    intro:
      "De leeruitkomsten staan. Hoe weet je dat studenten ze beheersen? De AI stelt summatieve toetsen met een weging voor, en formatieve oefenmomenten ervoor. Jij kiest wat erin komt.",
    pending: "De AI stelt een toetsprogramma voor…",
    proposalIntro:
      "De AI maakte dit toetsprogramma bij je leeruitkomsten. Vink aan wat in de cursus komt en pas aan waar nodig. De wegingen zijn een voorstel: jij beslist als examinator.",
    ready: "Toetsprogramma klaar. Kies wat in de cursus komt.",
    submit: "Toetsprogramma voorstellen",
    title: "Volgende stap: het toetsprogramma",
    uncovered: "Deze leeruitkomsten zitten in geen summatieve toets: {list}",
    weight: "Weging (voorstel van de AI)",
    weightsOff: "De voorgestelde wegingen tellen niet op tot 100%. Pas ze aan voordat je toevoegt.",
  },
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
  lessons: {
    added:
      "{n} lessen en opdrachten toegevoegd. Je vindt ze bij Lessen en toetsen; vanuit elke les helpt Les voorbereiden verder.",
    apply: "Lessen toevoegen",
    errors: {
      failed:
        "Het lukte niet om een lessenreeks voor te stellen. Probeer het opnieuw, of voeg de lessen zelf toe.",
      invalid: "Vul hele getallen in en beschrijf je wensen in hooguit 500 tekens.",
      nothing:
        "De AI heeft meer nodig om een lessenreeks voor te stellen. Lees de toelichting hieronder.",
      notReady:
        "Een lessenreeks laten voorstellen kan als de cursus leeruitkomsten en toetsen heeft en nog geen lessen.",
      quota:
        "AI-limiet bereikt: je ruimte voor deze maand is op, of je gebruikte vandaag heel veel AI (dan kan het morgen weer). Op de pagina Gebruik zie je je maand.",
    },
    intro:
      "De leeruitkomsten en toetsen staan. Hoe komen studenten daar? De AI stelt per week lessen en opdrachten voor, elk met een lesdoel, die de leeruitkomsten behandelen vóór ze getoetst worden. Jij kiest wat erin komt.",
    late: "Leeruitkomst {n} wordt in week {week} getoetst ({test}), maar komt pas daarna voor het eerst in een les.",
    lessonN: "Les {n}",
    noWeek: "Zonder week",
    numbersHelp: "Niet verplicht. Wat je hier invult, komt ook in het lesrooster.",
    pending: "De AI stelt een lessenreeks voor…",
    proposalIntro:
      "De AI maakte deze lessenreeks bij je leeruitkomsten en toetsen. Vink aan wat in de cursus komt en pas aan waar nodig; de inhoud van elke les werk je later uit met Les voorbereiden.",
    ready: "Lessenreeks klaar. Kies wat in de cursus komt.",
    sessionsPerWeek: "Lesmomenten per week",
    submit: "Lessenreeks voorstellen",
    title: "Volgende stap: de lessenreeks",
    untaught: "Deze leeruitkomsten komen in geen les: {list}",
    week: "Week {n}",
    weeks: "Aantal weken",
    wishes: "Wensen voor de planning",
    wishesHelp:
      "Niet verplicht. Bijvoorbeeld: week 4 is projectweek, of elke week begint met een hoorcollege.",
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
