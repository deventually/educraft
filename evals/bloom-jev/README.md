# Bloom-voorstel: Jev, de LLM en een werkwoordenlijst (experiment, 2026-11-13)

Vraag: wie stelt bij een leeruitkomst het beste het Bloom-niveau voor? De import
(`course-import@v3`) zegt: "Bloom-voorstel alleen uit het werkwoord … Is het werkwoord vaag of
twijfel je, gebruik dan `null`." Drie manieren, op dezelfde leeruitkomsten:

- **De LLM** zoals de app het nu doet: de echte import-prompt, het echte bericht
  (`buildImportMessage`) en de echte controle (`parseImport`), op een klein document met alleen de
  leeruitkomsten. De leeruitkomsten worden teruggevonden met een genormaliseerde vergelijking
  (`sameOutcome`), omdat de import spaties en een punt mag herstellen.
- **TypeSafe Jev**, één verzoek per leeruitkomst.
- **Een werkwoordenlijst in code** (`bloomFromVerb`). TypeSafe zegt: kan code het betrouwbaar,
  laat code het doen. Deze meting laat zien of dat zo is.

`npm run eval:bloom-jev` schrijft `evals/reports/<datum><label>-bloom-jev.md` en
`…-bloom-jev-raw.json` (elk exact Jev-verzoek met antwoord, elk importantwoord, en alle rijen).
Met `--rescore <raw-bestand>` komt het rapport opnieuw met de labels zoals ze nu zijn, zonder API.

## Hoe Jev gevraagd wordt

Volgens TypeSafe's skill, helemaal:

- de toestand als benoemde velden (`outcome`, `language`), met het pad tussen backticks in de vraag;
- **het nulgeval als eigen ja/nee**: `clear_verb`, "geeft het werkwoord duidelijk één niveau aan?";
- het niveau als **keuze** met beschrijvende namen, en per optie wat eronder valt en wat niet;
- de volgorde van de opties **draait per herhaling** (Jev neigt naar de eerste optie);
- **code beslist** (`parseBloomJevAnswer`): een niveau alleen als `clear_verb` ≥ 0,7 én het
  gekozen niveau ≥ 0,7; anders geen niveau, net als de regel van de import.

## De werkwoordenlijst

Per niveau de gangbare werkwoorden van de herziene taxonomie (Anderson & Krathwohl, 2001), vóór
enig label geschreven. Nederlandse werkwoorden als stam, scheidbare als "stam…partikel" ("past …
toe"). Een werkwoord dat de lijsten op meer niveaus zetten, staat er niet in. Vage werkwoorden
(kent, begrijpt, heeft inzicht in) geven geen niveau, en werkwoorden van verschillende niveaus in
één leeruitkomst ook niet.

## De sets

- **Afstemmen** ([`cases.json`](cases.json)): 40 leeruitkomsten. 21 komen uit de cases van de
  import-eval, 19 zijn erbij geschreven voor vage werkwoorden, scheidbare werkwoorden en Engels.
- **Holdout** ([`holdout.json`](holdout.json)): 71 echte leeruitkomsten uit openbare studiegidsen
  van vijf opleidingen (HAN, Hogeschool Rotterdam, De Haagse Hogeschool, Windesheim, University
  College Maastricht), elk met de bron-URL. Er wordt niets op afgestemd.

## Wie heeft gelijk

Bastiaan labelt alle 111 leeruitkomsten zelf, zonder de antwoorden van de methodes te zien, op
een labelpagina. Zijn labels gaan in `labels.json` (`{"labels": {"<leeruitkomst>": "apply" | null}}`).
"Goed" is hetzelfde als zijn label, ook bij "geen niveau". Het rapport geeft per set hoe vaak elke
methode goed is, en hoe vaak een voorgesteld niveau klopt.

## Eerlijk over de vergelijking

- **De LLM doet in dezelfde call de hele import** (leeruitkomsten, criteria, toetsen). Zijn
  snelheid en kosten zijn die van de hele import; het Bloom-veld is daar een klein deel van. Jev
  maakt de import dus niet veel goedkoper. De vraag bij B is vooral of het voorstel **beter** wordt,
  en of het uit de LLM kan.
- **Holdout-teksten zijn citaten van een webpagina**, en een paar zijn midden in de zin afgebroken.
  Het werkwoord staat vooraan, dus voor het niveau maakt dat zelden uit, maar het staat hier.
- De afstemset is deels door ons geschreven; daarom telt vooral de holdout.
- **Via Claude Code** (`--llm-model claude-code::claude-sonnet-5-5`) kost de meting alleen Jev.
  De kosten van de LLM zijn dan zijn tokens tegen de API-lijstprijs van hetzelfde model (de
  prompt is die van de app, zonder Claude Code's eigen prompt). Zijn snelheid is de tijd van de
  model-call zelf, zoals Claude Code die meet (`duration_api_ms`), zonder het opstarten van de CLI.
  Het rapport zegt dat erbij.

Nooit onderdeel van CI.
