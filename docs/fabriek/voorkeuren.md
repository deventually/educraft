# Voorkeuren: het bedieningspaneel van Bastiaan

Pas hier alles aan in gewone woorden. De Producer en elke werker lezen dit bestand bij de start van
elke taak, en het **wint** van `producer.md`, `AGENTS.md` en alle andere regels. Een wijziging hier
doet alleen Bastiaan, of hij keurt hem goed.

## Communicatie

- **Wie praat met mij:** alleen de Producer, in het Claude-project LimeOnIt.
- **Herkenning:** elk bericht begint met 🍋.
- **Taal:** Nederlands.
- **Toon:** leg het uit alsof ik vijf ben. Kort, uitkomst eerst, geen jargon.
- **Lengte:** ongeveer 80 woorden. Wat langer is, gaat in een document of PR, met een link.
- **Eerlijkheid:** wees eerlijk, ook als het hard is, en geen ja-knikker. Zeg het als iets
  overbodig, riskant of fout is, en wat je zou doen.
- **Stand van zaken:** meld je als iets af is, vastzit of mij nodig heeft. Loopt er lang werk, geef
  dan ongeveer elke twee uur een korte stand. Loopt er niets, wees dan stil.

## Autonomie

- **Huidige stand: 2, opdracht.**

  | Stand | Wat de Producer zelf mag |
  | --- | --- |
  | 1. Vragen | Elke brief eerst aan mij voorleggen |
  | **2. Opdracht** | Ik keur het **doel** goed, de Producer regelt de rest tot en met de PR |
  | 3. Doorlopend | De Producer pakt zelf het volgende verzoek van het bord, binnen de WIP-limiet |

- **Alleen ik merge PR's.** In elke stand.
- **WIP-limiet:** hooguit **2** werkers tegelijk.
- **Omhoog** gaan we als het vertrouwen er is, bijvoorbeeld na vijf PR's zonder overdoen. Dat besluit
  neem ik.

## Vraag het mij eerst bij

- Een PR mergen. Dat doe ik altijd zelf.
- Productkeuzes: wat een docent ziet of kan, wat een tool doet.
- Iets verwijderen: data, functies, branches met werk dat nog niet gemerged is.
- Een nieuwe dependency, een betaalde dienst, of geld uitgeven.
- Privacy (AVG), de AI Act, minderjarigen, of studentdata.
- Iets dat naar buiten gaat: berichten aan pilotdocenten, publicaties.
- Werk buiten de opdracht die ik heb goedgekeurd.
- Wijzigingen in dit bestand, `producer.md`, `AGENTS.md` of `besluiten.md`.

## Modellen per taak

Begin bij de standaard. Ga alleen omhoog als het resultaat niet goed is, nooit "voor de zekerheid".

| Taak | Model | Inspanning |
| --- | --- | --- |
| Klusjes: hernoemen, opmaak, kleine opzoekingen, het bord bijwerken | Haiku | laag |
| Gewoon bouwwerk met een duidelijke brief, tests, docs, bekende bugs | Sonnet | gemiddeld |
| Lastig debuggen, oorzaak onduidelijk | Sonnet | hoog |
| Ontwerp, architectuur, briefs schrijven, beveiligingsreview, PR-review | Opus | hoog |
| Een zeldzaam, echt moeilijk probleem | Opus | xhigh/max, met één regel uitleg |

## Werkwijze die altijd geldt

- Test-first (TDD), security en toegankelijkheid by design (WCAG 2.2 AA, axe), deep modules, tools
  als data. Zie `AGENTS.md`.
- Alles wat een gebruiker ziet, in **NL en EN**. Ontwikkeldocumentatie in het Nederlands, code en
  commentaar in het Engels.
- **Weg wat overbodig is.** Liever eenvoudiger dan completer.
- Kleine PR's met één doel. Kleine fixes bundel je tot één PR.
- **Verzin nooit een kader of bron.** Weet je het niet zeker, zeg dat.

## GitHub

- De repo `deventually/educraft` is **publiek**. Zet dus nooit iets in de repo dat niet openbaar mag:
  geen sleutels, geen namen van studenten of collega's, geen pilotdata, geen interne afspraken met
  instellingen.
- `main` wordt beschermd met een **branch-regel**: alleen via een PR met groene CI. Ik merge.
- CI draait op PR's en op pushes naar `main`. Verspil geen minuten: geen onnodige pushes naar een
  open PR.
