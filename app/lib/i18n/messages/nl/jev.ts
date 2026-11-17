/** TypeSafe Jev's one switch on Beheer → Tools (BESLUIT-2026-11-17-1). */
export const jev = {
  akkoord:
    "Aanzetten geldt als akkoord van de instelling: OpenRouter en TypeSafe worden dan verwerker van deze gegevens. Het logboek bewaart wie het deed en wanneer.",
  heading: "TypeSafe Jev",
  intro:
    "Jev is een beslismodel van TypeSafe, bereikbaar via OpenRouter. Het geeft korte oordelen, zoals het Bloom-niveau van een leeruitkomst of bij welke leeruitkomst een bestand hoort. Staat Jev aan, dan gaan stukken cursusdocument (leeruitkomsten, toetstitels en de tekst eromheen) en bij Bewijs in één keer de bestandsnaam en het begin van elk bestand naar OpenRouter. Namen van studenten die de docent opgeeft zijn dan al vervangen door codes, maar het is niet volledig anoniem. Staat Jev uit, dan doet het gewone taalmodel dit werk.",
  keyMissing:
    "De sleutel JEV_API_KEY ontbreekt op de server. Zolang die er niet is, gaat er niets naar Jev, ook als het aan staat.",
  label: "Jev gebruiken",
  never: "Nog nooit aangezet.",
  someone: "een beheerder",
  switchedOff: "Uitgezet door {name} op {when}.",
  switchedOn: "Aangezet door {name} op {when}.",
};
