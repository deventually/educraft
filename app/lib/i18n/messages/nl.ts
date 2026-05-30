/**
 * Dutch UI strings — the canonical source of truth for the message shape.
 * `Messages = typeof nl`, so every other locale must match this structure
 * (enforced by tests/i18n.test.ts). No `as const`: values widen to `string`
 * so other locales can supply their own translations.
 *
 * Interpolation uses single-brace placeholders, e.g. "Niveau {n}". Resolve them
 * with `fmt()` from "~/lib/i18n/format".
 */
export const nl = {
  appName: "EduCraft",
  tagline: "Evidence-based onderwijs ontwerpen met generatieve AI",
  meta: {
    homeTitle: "EduCraft — Evidence-based onderwijs ontwerpen met AI",
    description:
      "EduCraft zet de evidence-based onderwijsmethoden uit The Pedagogical Promptbook om in werkende tools voor het hbo.",
  },
  language: {
    label: "Taal",
    nl: "Nederlands",
    en: "Engels",
  },
  nav: {
    tools: "Tools",
    projects: "Projecten",
    help: "Help",
    settings: "Context & instellingen",
    about: "Over",
  },
  badge: {
    instructor: "Docent",
    student: "Student",
  },
  home: {
    heading: "Kies een tool",
    intro:
      "Elke tool zet een evidence-based onderwijsmethode uit The Pedagogical Promptbook om in een werkende generator. Ontworpen voor het hbo.",
    filterAll: "Alle",
    instructor: "Voor docenten",
    student: "Voor studenten",
    comingSoon: "Binnenkort",
  },
  tool: {
    theory: "Onderbouwing",
    source: "Bron",
    evaluatedWith: "Geëvalueerd met {model}.",
    viewOriginal: "Bekijk originele prompt",
    contextProfile: "Onderwijscontext",
    noProfile: "Geen context",
    outputLanguage: "Taal van uitvoer",
    dutch: "Nederlands",
    english: "Engels",
    model: "Model",
    generate: "Genereer",
    generating: "Bezig met genereren…",
    stop: "Stop",
    regenerate: "Opnieuw",
    copy: "Kopieer",
    copied: "Gekopieerd!",
    exportMd: "Exporteer (Markdown)",
    result: "Resultaat",
    required: "verplicht",
    runStage: "Genereer fase",
    stageLocked: "Eerst vorige fase voltooien",
    optionalStage: "Optioneel",
    adaptedNotice:
      "Deze prompt is aangepast (interview → één keer genereren, en vertaald). Bekijk de originele prompt voor de exacte tekst uit het boek.",
    errorPrefix: "Er ging iets mis",
    emptyResult: 'Vul het formulier in en klik op "{action}". Het resultaat verschijnt hier.',
    fileComingSoon: "Bestand-/afbeeldinginvoer komt in een latere fase beschikbaar.",
    imageUploadLabel: "Afbeeldingen uploaden",
    imageRemove: "Verwijderen",
  },
  chat: {
    send: "Versturen",
    stop: "Stop",
    regenerate: "Opnieuw",
    streaming: "Aan het denken…",
    inputPlaceholder: "Jouw bericht…",
    sandboxHint: "Vul onderstaande velden in. Deze worden eenmaal gebruikt.",
    continue: "Doorgaan",
    startConversation: "Begin het gesprek door op een suggestie te klikken of typ je bericht.",
    interrupted: "Onderbroken",
  },
  settings: {
    heading: "Onderwijscontext",
    intro:
      "Maak herbruikbare contextprofielen aan. Het gekozen profiel wordt automatisch in de prompts verwerkt, zodat materialen passen bij de opleiding.",
    name: "Naam",
    programme: "Opleiding",
    domain: "Domein / sector",
    domainNone: "—",
    course: "Vak",
    studyYear: "Studiejaar",
    yearNone: "—",
    eqfOptional: "EQF (optioneel)",
    eqfNone: "—",
    competencies: "Beoogde competenties / leeruitkomsten",
    professionalContext: "Beroepspraktijk / werkveld",
    tools: "Technologie / methoden / instrumenten",
    notes: "Aanvullende context",
    ictPack: "hbo-i (ICT): architectuur, activiteiten & niveau",
    level: "HBO-i beheersingsniveau",
    levelOption: "Niveau {n}",
    layers: "Architectuurlagen",
    activities: "Beroepsactiviteiten",
    makeDefault: "Als standaard instellen",
    save: "Opslaan",
    delete: "Verwijderen",
    empty: "Nog geen contextprofielen. Maak er hieronder een aan.",
    newProfile: "Nieuw contextprofiel",
    nameRequired: "Naam is verplicht.",
    ph: {
      name: "bijv. Software Engineering — jaar 2",
      programme: "HBO-ICT, Verpleegkunde, Bedrijfskunde…",
      course: "bijv. Backend Development",
      competencies: "Welke competenties/leeruitkomsten staan centraal?",
      professionalContext: "Voor welk werkveld leidt deze opleiding op?",
      tools: "Java, Python, SPSS, verpleegtechnieken…",
      notes: "Vrije aanvullende context die in elke prompt wordt meegegeven.",
    },
  },
  about: {
    heading: "Over EduCraft",
    intro1: "EduCraft zet de evidence-based onderwijsmethoden uit",
    intro2:
      "({editor}, {year}) om in werkende tools. Elke tool koppelt een onderwijstheorie aan een zorgvuldig ontworpen, geëvalueerde prompt. De focus ligt eerst op het hbo-i.",
    licenseHeading: "Licentie & bron",
    licenseBody1: "De prompts komen uit",
    licenseBody2: "(DOI {doi}) en zijn gelicentieerd onder",
    licenseBody3:
      ". Dit betekent dat ze vrij gebruikt en aangepast (o.a. vertaald) mogen worden, mits correct toegeschreven. Per tool tonen we de bron en de originele prompttekst.",
    toolsHeading: "Beschikbare tools",
  },
  footer: {
    prompts: "prompts uit",
    by: "David Wiley, red.",
    licensed: "gelicentieerd onder",
  },
  projects: {
    subtitle: "Je recent gegenereerde materialen.",
    empty: "Nog niets gegenereerd. Kies een tool om te beginnen.",
    delete: "Verwijderen",
  },
  help: {
    heading: "Help & documentatie",
    intro: "Uitleg per tool en algemene onderwerpen om snel op weg te zijn.",
    topicsSection: "Algemeen",
    toolsSection: "Per tool",
    whatItDoes: "Wat het doet",
    inputsTitle: "Wat je invult",
    howToUse: "Hoe te gebruiken",
    noOverlay:
      "Een uitgebreide handleiding voor deze tool volgt. Hierboven zie je wat de tool doet en welke invoer je geeft.",
    openTool: "Open deze tool",
    fullHelp: "Hulp & voorbeelden",
    allHelp: "Alle help",
  },
  error: {
    title: "Oeps!",
    generic: "Er is een onverwachte fout opgetreden.",
    notFoundTitle: "404",
    notFound: "Deze pagina kon niet worden gevonden.",
    serverErrorTitle: "Fout",
    unknownTool: "Onbekende tool.",
    unknown: "Onbekende fout",
  },
};

export type Messages = typeof nl;
