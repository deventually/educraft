# Fase 36 — Groepsfeedback na het nakijken

> **Status:** ⚪ brief. Mag na P34.1 (BESLUIT-2026-11-12-10). Zo voer je deze brief uit: één
> deelstap per sessie, elke deelstap één PR vanaf `main`, test-first volgens `AGENTS.md` / de
> `/tdd`-skill, poort `npm test && npm run typecheck && npm run check`. Merge nooit zelf; alleen
> Bastiaan merget. Volgorde en gedeelde bestanden: `README.md`, *Docenthulpjes*.

## In gewone taal

Na het nakijken van een stapel werk ziet de docent steeds dezelfde fouten. Nu bespreekt hij die
per student, of schrijft hij er 's avonds een mail over. LimeOnIt weet al hoe de groep scoorde: de
rubric in batches bewaart per criterium welk niveau gekozen werd (zonder namen, P23.3), en de
toetsanalyse weet welke vragen slecht gingen. Daarmee maakt het één nabespreking voor de hele
groep: de drie tot vijf meest voorkomende problemen, wat goed werk daar laat zien, en een korte
oefenactiviteit.

De docent vindt het op twee plekken: een knop *Groepsfeedback* bij een afgesloten ronde van de
rubric, en als volgende stap onder de toetsanalyse.

Herkomst: onderzoek "Docenttaken en hulpjes in LimeOnIt", hulpje 4. Geschatte tijdwinst: 1 tot 2
uur per toets.

## Vaste uitgangspunten

1. **Geen studentwerk nodig.** De basis zijn de anonieme scores per criterium (`rubric_scores`) of de
   toetsanalyse. Wil de docent voorbeeldfouten meegeven, dan typt of plakt hij korte fragmenten,
   die door de namencheck in de browser gaan (`app/lib/privacy/redact.ts`).
2. **Tellen in code.** Hoeveel studenten op welk niveau zaten, rekent de code uit (36.1); de AI krijgt
   de tellingen en mag ze niet veranderen. Een getal in het antwoord dat niet in de invoer staat,
   valt weg in code.
3. **Feedforward, geen oordeel over personen.** De nabespreking gaat over het werk van de groep.
4. **Tools zijn data.** De nabespreking is één one-shot registry-entry (`group-feedback`), bereikbaar
   via `Tool.next` en een knop op de rubricpagina. Komt er een nieuw invulpad (vanuit een rubric),
   dan als data (een `prefillFrom…` naast `prefillFromCourse`), nooit als tak per tool.

## Deelstappen

### 36.1 — De groep in getallen (geen AI, geen migratie)

- `app/lib/utilities/rubric/groupSummary.ts`: uit een lijst `StoredRubricScore`
  (`app/server/repositories/rubricScores.server.ts`) en de rubric: per criterium het aantal per
  niveau, het percentage onder voldoende, en de criteria die het slechtst gingen eerst. Plus een
  tekstvorm voor de prompt.
- Op de rubricpagina per maand (de ronde) een blok *Hoe ging de groep*: de tabel, en de knop
  *Groepsfeedback maken*. Alleen voor de eigenaar; de scores worden niet gedeeld.
- **RED:** tellingen, een lege ronde, een criterium dat later uit de rubric is gehaald; component
  met axe.

### 36.2 — De nabespreking (`group-feedback@v1`)

- Registry `app/lib/registry/tools/group-feedback.ts`, one-shot, één stage. Invoer: `groupSummary`
  (tekst, ingevuld vanuit 36.1 of uit de toetsanalyse), `examples` (optioneel, geanonimiseerde
  fragmenten, `redact: true`), `assignment` (optioneel, of via `prefillFromCourse` de toets),
  `{{contextProfile}}`.
- Uitvoer: drie tot vijf punten, elk met het criterium of de vraag, hoeveel studenten het betrof (uit
  de invoer), wat goed werk hier laat zien (een zelfgemaakt voorbeeld, als voorbeeld gemarkeerd,
  nooit een stuk van een student), en een oefenactiviteit van tien minuten. Daaronder een korte
  tekst voor de groep om te delen. `exportAs` Word.
- `test-analysis` krijgt `group-feedback` in `next`. Waar de toetsanalyse de invoer al heeft, gaat
  die mee zoals `Tool.next` dat nu doet.
- **Evals:** vijf cases, twee met een bekende fout (een getal dat niet in de invoer staat; een
  voorbeeld dat letterlijk uit een studentfragment komt). Kwaliteitspoort zoals P24.
- **RED:** `tests/tools/group-feedback.test.ts` (slug, ankers, geen open `{{…}}`, verplichte velden,
  NL/EN), de controle op getallen.

## Volgorde

`36.1 ──▶ 36.2`. Na P34.1, omdat beide de rubricpagina (`app/routes/utilities.rubric.$id.tsx`) en
`app/lib/utilities/rubric/` raken; niet tegelijk met P34.2.

## Buiten deze fase

- Groepsfeedback uit *Studentwerk beoordelen* per student (die resultaten zijn studentwerk en
  worden niet samengevoegd).
- Automatisch een herkansing maken (hulpje 6 uit het onderzoek, later).
