# Fase 23 — Hulpmiddelen zonder AI: rubrics en de cijferrekenaar

> **Zo voer je deze brief uit:** open hem in een verse sessie en voer **één** deelfase uit per
> sessie, test-first volgens `AGENTS.md` / de `/tdd`-skill. Elke deelfase is **één PR met één doel**,
> in de volgorde 23.1 → 23.2 → 23.3. Schrijf eerst de RED-tests die bij de deelfase staan, zie ze
> falen om de goede reden, en maak ze dan groen. Poort per PR: `npm test && npm run typecheck && npm
> run check`. Branch vanaf `main`. Merge nooit zelf; alleen Bastiaan merget. **Hangt af van:** niets
> wat nog open staat (P19 is gemerged). **Lees eerst *Wat Bastiaan moet beslissen*.**

## Context en doel

Bastiaan vroeg welke tools we nog missen. Het onderzoek (Claude Doc "Ontbrekende docententools:
onderzoek en prioriteiten", 2026-11-04) leverde twee lijsten op: AI-tools en **hulpmiddelen zonder
AI**. Bastiaan: *"Dus wat mij betreft kunnen we ook nuttige tools aanbieden die geen LLM nodig
hebben"* en daarna *"Ja geef ze een eigen plek"* (BESLUIT-2026-11-04-5).

Een hulpmiddel rekent of ordent alleen. Het is snel, kost niets per gebruik, geeft altijd hetzelfde
antwoord en roept geen AI Act-vragen op. Deze brief bouwt **de plek** en de eerste twee
hulpmiddelen:

1. **Cijfer- en cesuurrekenaar** (B in het onderzoek): van punten naar cijfer.
2. **Rubric bewaren en invullen** (A in het onderzoek): een rubric opslaan, hergebruiken en per
   beoordeling invullen; de punten worden een cijfer via de rekenaar.

Later (niet in deze brief): toetsanalyse-rekenaar (C), studielastrekenaar (D). De toetsmatrijs-teller
(E) hoort bij de dekkingsmatrix van P20.

## Vaste besluiten

1. **Een eigen plek, los van de AI-tools.** Hulpmiddelen zijn géén `Tool` in het register: ze hebben
   geen prompt, geen model en geen stream. Ze krijgen een eigen, klein register
   (`app/lib/utilities/`), zodat de AI-engine niet verandert.
2. **Rekenen is pure code.** Elke berekening is een pure functie onder `app/lib/utilities/<id>/`,
   met unit-tests. Geen LLM, geen netwerk.
3. **Namen blijven op het apparaat van de docent; de server bewaart alleen anonieme scores**
   (BESLUIT-2026-11-04-8). Een rubric (het model) wordt bewaard. Bij het invullen werkt de docent in
   een **batch**: per student een naam (optioneel) en een code ("Student 7"). Namen staan alleen in
   de browser (`localStorage`, per batch, in try/catch) en gaan nooit naar de server of een LLM; de
   server ziet alleen de code. Bij **"Batch afsluiten"** wist de browser de namen en bewaart de server
   alleen de gekozen niveaus per criterium, **zonder code, zonder opmerkingen en zonder datum per
   invulling** (alleen de maand van de batch). Opmerkingen blijven alleen in de browser en verdwijnen
   met de batch. De privacy-officer van de instelling bevestigt dit ontwerp één keer vóór de pilot
   het gebruikt (pseudoniem is nog geen anoniem).
4. **Verzin geen regel.** Er is geen landelijke regel voor cesuur of cijferberekening in het hbo; die
   staat in de OER van de opleiding. De rekenaar maakt elke keuze **instelbaar** en zegt dat in de
   UI ("Controleer of dit past bij de OER van je opleiding"). De standaardwaarden zijn alleen een
   startpunt.
5. **Tweetalig, toegankelijk.** Alle teksten NL/EN via `LocalizedText`/messages; elk interactief
   onderdeel een vitest-axe-test; WCAG 2.2 AA.
6. **Altijd aan.** Hulpmiddelen kosten niets en hebben geen beheerinstelling. Geen schakelaar op
   `/admin/tools`.

## 23.1 — De plek en de cijferrekenaar

### Register (`app/lib/utilities/`)

```ts
export interface Utility {
  id: string;            // stable English slug, e.g. "grade-calculator"
  slug: string;          // URL segment, English (BESLUIT-2026-06-1)
  name: LocalizedText;   // task first (BESLUIT-2026-11-03-18), e.g. "Punten omrekenen naar een cijfer"
  summary: LocalizedText;
}
export const UTILITIES: readonly Utility[];
export function getUtilityBySlug(slug: string): Utility | undefined;
```

Het register is data. De pagina per hulpmiddel is een gewone route-component; één `switch` op
`slug` in een kleine `UtilityView` is hier toegestaan (er is geen gedeelde engine om naar te
refactoren, en twee à vier hulpmiddelen rechtvaardigen geen generieke formulierlaag).

### Routes en vindbaarheid

- `routes.ts`: `route("utilities", "routes/utilities._index.tsx")` en
  `route("utilities/:slug", "routes/utilities.$slug.tsx")`, binnen de ingelogde layout. Onbekende
  slug → 404.
- **Vindbaar via de toolspagina, niet via het menu.** Het menu blijft vier items
  (BESLUIT-2026-11-04-3). Onder de toolkaarten op `/tools` komt een sectie **"Hulpmiddelen"**
  ("Utilities") met een kaart per hulpmiddel en een link "Alle hulpmiddelen" naar `/utilities`.
  De zoekbalk op `/tools` vindt ook hulpmiddelen op naam en samenvatting.

### De cijferrekenaar (`app/lib/utilities/grade/`)

Pure functies:

```ts
export interface GradeScale {
  maxPoints: number;      // > 0
  passPercent: number;    // 0 < p < 100, default 55
  passGrade: number;      // default 5.5
  minGrade: number;       // default 1
  maxGrade: number;       // default 10
  decimals: 0 | 1 | 2;    // default 1
  guessing?: { options: number; questions: number }; // MC guessing correction, optional
}
export function cutScore(scale: GradeScale): number;            // points at the pass mark
export function pointsToGrade(points: number, scale: GradeScale): number;
export function gradeTable(scale: GradeScale): { points: number; grade: number }[];
```

- **Zonder raadkanscorrectie:** cesuur = `maxPoints × passPercent / 100`. Twee lineaire stukken:
  0 → `minGrade`, cesuur → `passGrade`, `maxPoints` → `maxGrade`.
- **Met raadkanscorrectie** (meerkeuze): de raadscore is `questions / options` (bij één punt per
  vraag; schaal naar `maxPoints` als de punten per vraag anders zijn). Cesuur = raadscore +
  (`maxPoints` − raadscore) × `passPercent / 100`. Scores tot en met de raadscore krijgen
  `minGrade`.
- Afronden op `decimals`, en altijd begrensd op `[minGrade, maxGrade]`.
- Ongeldige invoer (max ≤ 0, punten < 0 of > max, opties < 2) → een Zod-fout met een vertaalde
  melding, nooit `NaN` in de UI.

UI (`routes/utilities.$slug.tsx` → `GradeCalculator`):

- Velden met `label`/`htmlFor`; de geavanceerde velden (cijfergrenzen, decimalen, raadkans) onder
  een uitklapper "Meer instellingen".
- Uitkomst: de cesuur in punten, en een **cijfertabel** (punten → cijfer) als echte `<table>` met
  `<caption>`. Een knop "Kopieer tabel" (tab-gescheiden, plakt in Excel) en "Print".
- De uitkomst rekent mee terwijl de docent typt; een `aria-live="polite"` regel meldt de cesuur.
  Geen toast (er is geen actie die wordt opgeslagen).
- De OER-zin uit vast besluit 4 staat zichtbaar boven de tabel.

### Testplan (RED)

- `tests/utilities/registry.test.ts`: elke utility heeft unieke id/slug, NL/EN-naam en -samenvatting;
  `getUtilityBySlug` vindt hem en geeft `undefined` voor onbekend.
- `tests/utilities/grade.test.ts`:
  - 30 punten, 55 %: cesuur 16,5; 16,5 → 5,5; 0 → 1; 30 → 10.
  - monotoon stijgend over de hele tabel; altijd binnen de grenzen.
  - raadkans 40 vragen × 4 opties, 55 %: raadscore 10, cesuur 26,5; 10 → 1; 26,5 → 5,5.
  - afronden op 0/1/2 decimalen; ongeldige invoer geeft een fout.
- `tests/components/utilities/GradeCalculator.test.tsx`: rendert, invoer verandert de cesuur, de
  tabel heeft een caption, axe = 0 violations (NL en EN).
- `tests/components/Home.test.tsx` (bestaand, uitbreiden): de sectie "Hulpmiddelen" staat op `/tools`
  en de zoekbalk vindt de rekenaar.
- i18n-pariteit blijft groen (`tests/i18n.test.ts`).

## 23.2 — Rubrics bewaren

### Model (`app/lib/utilities/rubric/`)

```ts
export interface RubricLevel { id: string; label: string; points: number; description: string }
export interface RubricCriterion { id: string; title: string; weight?: number; levels: RubricLevel[]; knockout?: boolean }
export interface RubricData { criteria: RubricCriterion[]; passRule?: "total" | "no-fail-on-knockout" }
```

- `RubricDataSchema` (Zod) is de grens: ≤ 30 criteria, 2–6 niveaus per criterium, tekst ≤ 1 000,
  titels ≤ 200, punten 0–100, gewicht 0–100. Item-id's zijn UUID's in de JSON.
- Pure bewerkingen in `edit.ts` (toevoegen, wijzigen, verwijderen, herordenen; onveranderlijk).
- `maxPoints(data)` voor de koppeling met de rekenaar.

### Persistentie

- Nieuwe tabel `rubrics`: `id`, `userId` (notNull), `name`, `dataJson`, `createdAt`, `updatedAt`.
  Het `context_profiles`-patroon: als geheel bewerkt, geen joins per rij. **Eén migratie**
  (`npm run db:generate`; nummer volgt op 0010).
- Repository `app/server/repositories/rubrics.server.ts`: `listRubrics` (gecapt), `getRubric`,
  `createRubric`, `updateRubric` (parset opnieuw met het schema; ongeldig → fout, niets geschreven),
  `deleteRubric`, `duplicateRubric`. Alles async en per `userId` afgebakend.
- `deleteUserCascade` ruimt `rubrics` op.

### UI

- `/utilities/rubric`: lijst van eigen rubrics (lege staat via `EmptyState` met één actie
  "Nieuwe rubric"), en een editor. Opslaan via `AutoSaveForm` + toast (P15/P18-patroon), geen
  opslaanknop per regel.
- De editor toont de rubric als tabel (criteria × niveaus), met een mobiele weergave per criterium.
- Export: "Kopieer als tabel" (tab-gescheiden) en "Kopieer als Markdown", zodat de docent hem in de
  beoordelingstools (Stageverslag beoordelen, Forumbijdragen beoordelen) kan plakken.

### Testplan (RED)

- `tests/utilities/rubric-schema.test.ts`: geldig wordt geparsed; limieten; `maxPoints`.
- `tests/utilities/rubric-edit.test.ts`: elke bewerking is onveranderlijk.
- `tests/api/rubrics-repo.test.ts`: CRUD-rondreis; de rubric van een ander is onzichtbaar en niet bij
  te werken; ongeldige data schrijft niets; `deleteUserCascade` ruimt op.
- `tests/components/utilities/RubricEditor.test.tsx`: criterium en niveau toevoegen, axe = 0.

## 23.3 — Een rubric invullen, in batches

- Op een bewaarde rubric: knop **"Nieuwe batch"**. De docent voegt studenten toe (naam optioneel; de
  app geeft elke student een code). Per student kiest de docent per criterium een niveau (radiogroep
  in een `fieldset`/`legend`), met een optioneel opmerkingenveld.
- De uitkomst rekent mee: totaal, het cijfer via `pointsToGrade` van 23.1 (cijferinstellingen per
  rubric bewaard, met dezelfde standaardwaarden), en de slaagregel: is een `knockout`-criterium op het
  laagste niveau, dan "onvoldoende, ongeacht het totaal".
- **Namen en opmerkingen alleen in de browser** (vast besluit 3), in een kleine module
  `app/lib/privacy/localNames.ts` (code ↔ naam per batch; alleen client). Op het scherm en in de print
  zet de browser de naam terug bij de code. "Print" en "Kopieer" geven een overzicht met namen voor de
  docent.
- **"Batch afsluiten"** (met bevestiging): de browser wist de namen en opmerkingen van die batch; de
  server slaat per invulling alleen `{ rubricId, month, levels: { criterionId: levelId }[] }` op, los
  van elkaar en zonder code.
- **Persistentie:** tabel `rubric_scores` (`id`, `userId`, `rubricId`, `month` als `YYYY-MM`,
  `levelsJson`), in dezelfde migratie als 23.2 als die nog niet gedraaid is, anders een eigen migratie.
  Repository per `userId` afgebakend; `deleteRubric` en `deleteUserCascade` ruimen op.
- **Meten:** op de rubricpagina een klein overzicht per criterium (hoe vaak elk niveau gekozen is),
  vanaf **vijf** afgesloten invullingen, zodat één student niet herkenbaar is.
- **Testplan (RED):** `tests/utilities/rubric-score.test.ts` (totaal, gewichten, knock-out, koppeling
  met de rekenaar); `tests/privacy/localNames.test.ts` (koppelen, terugzetten, wissen); een
  repo-test dat `rubric_scores` geen naam, code of opmerking kan bevatten (het schema heeft er geen
  veld voor en de Zod-grens weigert extra sleutels); een test dat het overzicht onder vijf invullingen
  niets toont; `tests/components/utilities/RubricFill.test.tsx` (kiezen, uitkomst, **geen
  netwerkverzoek met een naam erin**, afsluiten wist de namen, axe = 0).

## Buiten bereik

- Namen op de server, exports naar een LMS.
- Een AI-tool die een rubric maakt (AI-tool 1 uit het onderzoek): dat wordt een aparte brief met de
  promptlat uit het onderzoek, en schrijft dan naar dit rubricmodel.
- Toetsanalyse- en studielastrekenaar (C en D): een volgende brief.
- Een vijfde menu-item.

## Wat Bastiaan moet beslissen

1. **Waar staan de hulpmiddelen?** Besloten: als sectie op de toolspagina; het menu blijft vier
   items (BESLUIT-2026-11-04-6).
2. **Ingevulde rubrics bewaren?** Besloten: namen alleen lokaal, na afsluiten alleen anonieme
   scores (BESLUIT-2026-11-04-8). Nog te doen door Bastiaan: de privacy-officer laten bevestigen.
