# Jev telt de thema's van de cursusevaluatie (experiment, 2026-11-17)

**Vraag:** klopt het getal bij een thema ("12 studenten noemen dit") beter als Jev per antwoord
beoordeelt en de code telt, dan als het taalmodel het zelf zegt?

Nu bedenkt `course-evaluation@v1` de thema's en zegt het model er zelf bij hoeveel studenten ze
noemen. `parseEvaluation` kapt dat getal alleen af op het aantal respondenten. Of het klopt, meet
de gewone eval niet ([`../course-evaluation/rubric.md`](../course-evaluation/rubric.md), "Wat de
score niet meet"). Tellen is een bekende zwakte van taalmodellen, en ook van Jev zelf. Daarom
telt hier de code.

## Het ontwerp, volgens TypeSafe

Het ontwerp volgt TypeSafe's skill (`typesafe-ai/skills`, commit 302eea6) en twee pagina's van de
documentatie, zonder eigen draai:

- **De jaggedness-pagina over tellen:** "iterate over candidates in code, ask one yes/no question
  per item, and sum the results yourself". Per antwoord van een student vraagt Jev dus één ja/nee
  per thema, en de code telt.
- **Jev oordeelt, code beslist.** Vanaf 0,7 telt een antwoord mee. Tussen 0,3 en 0,7 is het
  **twijfel**, en dat komt in een eigen rij. Een mislukte aanroep of een ontbrekende vraag telt als
  **geen antwoord**, nooit als nee.
- **De toestand is wat een mens zou bekijken:** het ene antwoord, in een veld met een naam
  (`answer`), plus één zin over wat het is.
- **Eén verzoek per antwoord.** Alle thema's gaan in hetzelfde verzoek, want ze delen de toestand
  en de vragen lopen parallel.
- **Het thema staat in de vraag zelf.** De richting van het thema (iets wat goed ging, of een
  klacht) staat in het ja-criterium. Wat verwart, namelijk hetzelfde onderwerp met het
  tegenovergestelde oordeel, staat in het nee-criterium. Een opdracht in een antwoord is tekst van
  de student; dat staat er ook bij (de jaggedness-pagina over vijandige inhoud).

De vragen zijn één keer geschreven, vóór enige meting, in `app/lib/courses/themeCountJev.ts`. Na de
meting wordt er niets aan bijgesteld. Een verbetering wordt een nieuwe versie met een eigen meting.

## De waarheid

[`cases.json`](cases.json) geeft per antwoord welke thema's het maakt. Die labels zijn vóór de
meting geschreven, alleen uit de tekst van de antwoorden:

- de vijf cases van `course-evaluation` (6 tot 13 antwoorden);
- twee grotere enquêtes om in te tellen: Nederlands met 46 antwoorden, Engels met 25. Daarin staan
  antwoorden met twee thema's, hetzelfde onderwerp met het tegenovergestelde oordeel, een
  ontkenning en een antwoord in de andere taal.

Klopt een label niet, dan past Bastiaan het aan vóór de meting draait, niet erna.

## Wat er gemeten wordt

Per case en per run:

1. **De LLM** draait de echte cursusevaluatie: dezelfde prompt, hetzelfde bericht, dezelfde
   controle en dezelfde ene herkansing als de app.
2. **Jev** krijgt elk antwoord van de enquête, met één ja/nee per thema van die LLM-run (zoals de
   app het zou vragen) en één per echt thema.
3. **Het getal bij een thema van de LLM.** Een thema van de LLM wordt aan de waarheid gekoppeld via
   zijn citaten. Die regel ligt vooraf vast: het krijgt de echte thema's die meer dan de helft van
   de geciteerde antwoorden maken. Eén citaat van een antwoord met twee thema's houdt ze allebei
   (een samengevoegd thema). Het ware getal is het aantal antwoorden met een van die thema's.
   Daarnaast liggen het getal van de LLM en de telling van Jev. Een thema zonder bruikbaar citaat
   is niet te vergelijken en wordt apart geteld.
4. **Jev per antwoord, op de echte thema's.** Dit telt terecht ja, vals ja, gemist, twijfel en geen
   antwoord.

## Wat telt als beter (vooraf vastgelegd)

- **Jev telt beter** als Jevs telling vaker precies goed is dan het getal van de LLM, en
  gemiddeld minder ver ernaast zit, op de thema's die te vergelijken zijn.
- **Jev is bruikbaar in de app** als Jev per antwoord op de echte thema's een precisie en een
  vindkans van allebei minstens 90% haalt, met hooguit 10% twijfel.
- De drempels zijn 0,7 en 0,3 en worden niet bijgesteld.

## Eerlijk over de vergelijking

- **De LLM is de app zoals hij is**, met zijn eigen prompt. Een sterkere tegenhanger, waarbij de
  LLM per thema de nummers van de antwoorden noemt en de code telt, is niet gemeten.
- **De labels zijn van de schrijver van de cases.** De enquêtes zijn fictief en geschreven met een
  bedoeling. Een echte enquête is rommeliger.
- **Klein:** 7 enquêtes, 122 antwoorden.

## Draaien

```bash
JEV_API_KEY=… npm run eval:evaluation-jev -- --llm-model claude-code::claude-sonnet-5-5 --repeat 3 --label a
npm run eval:evaluation-jev -- --dry-run   # de Jev-verzoeken van de eerste antwoorden, zonder API
```

Het rapport komt in `evals/reports/<datum><label>-evaluation-jev.md`. Het ruwe bestand bewaart elk
exact Jev-verzoek met het antwoord, en elk antwoord van de LLM. Dit is nooit onderdeel van CI.

## Uitslag (2026-11-17)

Rapport: [`2026-11-17a-evaluation-jev.md`](../reports/2026-11-17a-evaluation-jev.md), met Sonnet
via Claude Code en Jev 1.14, 3 runs per case.

| Wie telt | Precies goed | Gemiddeld ernaast |
| --- | --- | --- |
| LLM (Sonnet) | 78 van 81 | 0,04 |
| Jev, code telt | 32 van 81 | 1,05 |

Per antwoord, op de echte thema's: precisie 100%, gevonden 80%, twijfel 2%.

**Besluit volgens het meetplan: nee, op beide punten.** Jev telt niet beter dan Sonnet, en de
vindkans van 80% haalt de 90% niet. Jev zegt nooit ten onrechte ja, maar mist een op de vijf
antwoorden die het thema echt maken. Op de thema's van de LLM mist Jev nog meer. Die thema's zijn
vaak samengesteld ("te snel en te weinig oefening"), en Jev leest letterlijk: hij zegt nee als een
antwoord maar één deel noemt. Dat staat als zwakte op TypeSafe's jaggedness-pagina.

**Wat het zegt over de aanname.** Tellen leek een zwakte van de LLM, maar Sonnet telde bij deze
enquêtes (tot 46 antwoorden) bijna foutloos. Bij honderden antwoorden kan dat anders zijn. Dat is
niet gemeten, en het is ook geen reden om verder te zoeken. Jev zou hier bovendien geen aanroep
vervangen, want de LLM is nodig voor de thema's. Er valt dus niets te besparen.

De vragen en drempels zijn na de meting niet bijgesteld.
