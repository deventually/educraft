# Jev als judge van de harde checks (experiment, 2026-11-13)

Vraag: kan TypeSafe Jev een deel van het werk van de LLM-judge van `npm run eval` overnemen,
sneller en goedkoper, en zonder dat de oordelen slechter worden? Het idee is een hybride: Jev
beslist wat een typed ja/nee goed kan, de LLM-judge houdt de rest.

## Wat er gemeten wordt

`npm run eval:judge-jev` leest de uitvoer van een gewone eval-run (`npm run eval -- --cases-only`,
in `evals/output/<datum>/`) en laat **beide** judges dezelfde uitvoer beoordelen:

- de **LLM-judge** precies zoals `npm run eval` hem vraagt (`buildJudgePrompt`, dezelfde
  `verifyEvidence`: een gefaalde check telt alleen met een citaat dat echt in de uitvoer staat);
- **Jev**, met de vragen uit [`checks.json`](checks.json) via de Decisions API van OpenRouter.

Per uitvoer en per check komt er een rij: wat Jev zegt (fail, pass, onbeslist of bij de LLM) en
wat de LLM-judge zegt. Het rapport (`evals/reports/<datum><label>-judge-jev.md`) telt hoe vaak Jev
beslist, hoe vaak dat overeenkomt met de judge, en geeft snelheid en kosten. Het ruwe bestand
(`…-judge-jev-raw.json`) bewaart elk exact Jev-verzoek met antwoord en het antwoord van de judge.

## Hoe de vragen gemaakt zijn

Volgens TypeSafe's eigen skill (plugin `typesafe@typesafe-ai`, staat aan in
`.claude/settings.json`), helemaal en niet half:

- **Jev oordeelt, code beslist.** De waarheidstabel staat in `parseJudgeJevAnswer`: een check
  faalt als één deel met kans ≥ 0,7 de fout laat zien; hij slaagt als alle delen ≤ 0,3 zijn;
  daartussen is **onbeslist**, een eigen rij, die naar de LLM-judge gaat. Een duidelijke fout wint
  van een onbeslist deel.
- **De toestand als benoemde velden**: `tool`, `case` (beschrijving, taal, niveau, invoer) en
  `output`, en de vragen noemen die paden tussen backticks.
- **Eén oordeel per vraag.** Een check die meer dingen vraagt, wordt per deel gevraagd en faalt
  als één deel faalt. Een check als "heeft het niet …" wordt positief gevraagd en faalt op nee.
  Zinnen in de rubric over wat wél mag, worden het nee-criterium.
- **Wat code kan, doet code.** Een voorwaarde op de case (een leeg veld, een vinkje, mbo-niveau)
  staat als `when` in `checks.json` en wordt in code beslist; geldt hij niet, dan slaagt de check
  zonder vraag.
- **Rekenen, tellen en exact opzoeken blijven bij de LLM** (TypeSafe's pagina over waar Jev
  zwak is). Dat zijn 10 van de 101 checks, elk met de reden in `checks.json`.

De vragen zijn één keer uit de rubrictekst geschreven, vóór enige meting: 101 checks van 19 tools,
134 delen, 4 voorwaarden in code.

## Holdout

Elke derde tool alfabetisch, vanaf de derde, is holdout (vaste regel, getest in
`tests/evals/judge-jev.test.ts`): contextualization, defense-review, difficult-conversation,
guided-reflection, rubric-builder en visit-prep. Op hun uitkomsten wordt niets aan de vragen
bijgesteld. Het rapport toont de holdout apart.

## Wie heeft gelijk

Waar de twee het eens zijn, telt dat als overeenstemming, niet als bewijs dat ze gelijk hebben.
Waar ze het oneens zijn, labelt Bastiaan de rij in `labels.json` (`{"labels": {"<tool>/<case>#<run>/<check>": true}}`,
`true` = de check faalt echt). Het rapport scoort dan beide judges op die rijen. Geen model
beoordeelt de modellen.

## Eerlijk over de vergelijking

- **De LLM-judge doet meer dan de harde checks.** Hij scoort in dezelfde call ook de dimensies van
  de rubric. Snelheid en kosten van de judge zijn die van de hele call. Jev vervangt daarvan alleen
  het deel met de harde checks, dus "Jev is X keer goedkoper" geldt niet voor de hele judge. Wat
  wel telt: hoeveel checks Jev betrouwbaar beslist, en of een kortere judge-prompt zonder die
  checks (een vervolgstap) dan goedkoper wordt.
- **Overeenstemming is geen gelijk hebben.** Zijn beide judges het eens en allebei fout, dan ziet
  deze meting dat niet.
- **De judge wordt niet in batch gedraaid**, zodat zijn snelheid en kosten te meten zijn; het
  genereren van de uitvoer mag wel in batch.

Nooit onderdeel van CI.
