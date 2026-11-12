/** Exporting a result (brief P30). */
export const exportResult = {
  button: "Exporteer",
  download: "Download als {format}",
  formats: { docx: "Word (.docx)", md: "Markdown (.md)", pptx: "PowerPoint (.pptx)" },
  intro: "Zo ziet het bestand eruit.",
  loading: "Voorbeeld laden…",
  newTab: "(opent in een nieuw tabblad)",
  preview: "Voorbeeld van de export",
  print: "Print of bewaar als PDF",
  printHint: 'Kies in het printvenster "Opslaan als PDF" om een PDF te maken.',
  slides: {
    intro:
      "Op de dia's staan het leerdoel, de stappen per fase en het terugkomen. Wat voor jou bedoeld is, staat in de sprekersnotities.",
    next: "Volgende dia",
    notes: "Sprekersnotities",
    position: "Dia {n} van {total}",
    preview: "Voorbeeld van de dia's",
    previous: "Vorige dia",
  },
  templates: {
    choose: "PowerPoint-sjabloon",
    current: "Huidig sjabloon",
    delete: "Verwijder sjabloon {name}",
    deleted: "Sjabloon verwijderd.",
    errors: {
      macros: "Dit bestand bevat macro's. Bewaar het als .pptx of .potx zonder macro's.",
      noFile: "Kies eerst een bestand.",
      noLayout:
        'In dit sjabloon staat geen indeling met een titel en een tekstvak, zoals "Titel en inhoud".',
      notPowerPoint: "Dit is geen PowerPoint-bestand. Kies een .pptx of .potx.",
      tooLarge: "Dit bestand is te groot. Een sjabloon mag hooguit 10 MB zijn.",
      wrongType: "Kies een bestand dat eindigt op .pptx of .potx.",
    },
    field: "Sjabloon (.pptx of .potx, max. 10 MB)",
    heading: "PowerPoint-sjabloon",
    introOwn:
      "Upload het PowerPoint-sjabloon van je school. Bij het exporteren van dia's kies je of LimeOnIt dit sjabloon gebruikt: je dia's krijgen dan de indeling \"Titel en inhoud\", met het logo, de kleuren en de letters van het sjabloon.",
    introTeam:
      "Upload een PowerPoint-sjabloon voor dit team. Elk teamlid kan het kiezen bij het exporteren van dia's.",
    own: "Mijn sjabloon: {name}",
    saved: "Sjabloon {name} bewaard.",
    standard: "LimeOnIt (standaard)",
    team: "{team}: {name}",
    upload: "Sjabloon uploaden",
  },
};
