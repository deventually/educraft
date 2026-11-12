# Fase 34 — Kalibreren met een tweede beoordelaar (zonder AI)

> **Status:** ⚪ brief. Mag nu (BESLUIT-2026-11-12-10). Zo voer je deze brief uit: één deelstap per
> sessie, elke deelstap één PR vanaf `main`, test-first volgens `AGENTS.md` / de `/tdd`-skill, poort
> `npm test && npm run typecheck && npm run check`. Merge nooit zelf; alleen Bastiaan merget.
> Volgorde en gedeelde bestanden met de andere docenthulpjes: `README.md`, *Docenthulpjes*.

## In gewone taal

Bij een eindwerk, een stage of een afstudeerverslag beoordelen vaak twee docenten. Daarna gaan ze
om tafel om hun oordelen gelijk te trekken. Nu gebeurt dat op papier of in Excel. LimeOnIt kent de
rubric al, dus het kan de twee scores per criterium naast elkaar zetten en laten zien waar jullie
het eens zijn en waar het meest verschilt. Dat verschil is de agenda voor het gesprek.

Er komt geen AI aan te pas: het is rekenwerk, net als de cijferrekenaar en de toetsanalyse. Het is
ook BKE-bewijs: kalibreren hoort bij betrouwbaar beoordelen.

Herkomst: onderzoek "Docenttaken en hulpjes in LimeOnIt", hulpje 3; ook mijlpaal 5 van het
stagetraject (P38).

## Vaste uitgangspunten

1. **Scores blijven in de browser,** zoals bij de rubric in batches (P23.3, BESLUIT-2026-11-04-8).
   Er wordt niets opgeslagen: geen naam, geen code, geen score. Alleen de rubric zelf komt van de
   server.
2. **Puur en controleerbaar.** De berekening staat in een pure functie met tests; de UI toont ook
   hoe het getal tot stand kwam (bijvoorbeeld "7 van 10 werken gelijk").
3. **Feiten, geen oordeel.** Het hulpje zegt niet wie gelijk heeft. Het toont verschillen.
4. **Een plek, geen nieuwe tool** (BESLUIT-2026-11-12-9): een knop *Kalibreren* op de rubricpagina.

## Deelstappen

### 34.1 — De berekening (`app/lib/utilities/rubric/calibrate.ts`)

- Invoer: een rubric (`RubricData`) en twee lijsten scores, per werk een code (vrij, bijvoorbeeld
  `A1`) en per criterium het gekozen niveau (`LevelChoice`, `app/lib/utilities/rubric/score.ts`).
  Werken worden gekoppeld op code; een code die maar bij één beoordelaar staat, wordt gemeld en telt
  niet mee.
- Uitvoer per criterium: aantal werken, exact gelijk (aantal en percentage), één niveau verschil
  (de niveaus zijn geordend), twee of meer verschil, en Cohens kappa (gewogen lineair, alleen
  vanaf 5 werken, anders "te weinig werken"). Per werk: het cijfer volgens beide beoordelaars
  (`rubricGradeSettings`) en het verschil. Daarbij de agenda: de criteria en werken met het grootste
  verschil eerst, hooguit tien regels.
- **RED:** gelijk, één niveau ernaast, ontbrekende code, kappa bij perfecte overeenstemming (1) en
  bij toeval, te weinig werken, een criterium zonder niveaus. Grensgevallen eerst.

### 34.2 — Het scherm `utilities/rubric/:id/calibrate`

- Route in `app/routing/utilities.ts` (vóór `utilities/:slug`), pagina
  `app/routes/utilities.rubric.$id.calibrate.tsx`, knop *Kalibreren* op `utilities.rubric.$id.tsx`.
  Ook voor een rubric die met je team gedeeld is (alleen lezen, P28.4): kalibreren schrijft niets.
- Invoer per beoordelaar: plakken uit Excel (kolommen: code, dan één kolom per criterium met het
  niveau zoals in de rubric) of per werk invullen in een tabel. Een voorbeeld-CSV te downloaden.
- Uitvoer: een tabel per criterium, de cijfers per werk naast elkaar, en *Agenda voor het gesprek*.
  *Afdrukken* via de bestaande print-weergave; geen Word nodig.
- Tekst onder de uitkomst: "Niets hiervan wordt bewaard. Sluit je deze pagina, dan is het weg."
- **RED:** loader (alleen eigen of gedeelde rubric), component (plakken, fout bij een onbekend
  niveau, uitkomst), axe; een `/accessibility-review` (tabel met kopcellen, reflow op 320px).

### 34.3 — Als BKE-bewijs (optioneel, geen migratie)

- *Gebruik als bewijs* op de uitkomst: een samenvatting zonder codes (per criterium de
  overeenstemming en het gesprekspunt, de datum en "met een collega") gaat als tekstbewijs naar het
  BDB/BKE-dossier, via de bestaande bewijsroute (`app/server/evidence.server.ts`). De docent ziet de
  tekst vóór het versturen.
- **RED:** de samenvatting bevat geen codes; het dossier van een ander kan niet.

## Volgorde

`34.1 ──▶ 34.2 ──▶ 34.3`. P38.5 (tweede beoordelaar in het traject) en P36 (groepsfeedback) bouwen
op 34.1.

## Buiten deze fase

- De tweede beoordelaar uitnodigen om in LimeOnIt zelf te scoren: dat vraagt meekijken (P32.4) en
  komt in P38.5.
- Meer dan twee beoordelaars.
