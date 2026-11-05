# Fase 27 — De rode draad: één workflow voor de docent

> **Status:** ⚪ brief, nog niet bouwen. **Hangt af van P20** (20.3 en 20.4 gemerged); 27.2 ook van
> P25 (gemerged); 27.5 van P21 voor de knop bij pet-bevindingen (zonder P21 werkt de rest). Zo voer
> je deze brief uit: één deelstap per sessie, elke deelstap één PR vanaf `main`, test-first volgens
> `AGENTS.md` / de `/tdd`-skill, poort `npm test && npm run typecheck && npm run check`. Merge nooit
> zelf; alleen Bastiaan merget. Keuzes van Bastiaan: BESLUIT-2026-11-05-4.

## In gewone taal

LimeOnIt heeft veel goede onderdelen, maar ze kennen elkaar niet. Een docent begint bij een lijst van
22 tools, typt bij elke tool opnieuw zijn vak en leeruitkomsten, en elk resultaat verdwijnt in een
platte lijst. De BDB/BKE-werkplaats staat er los naast.

P27 maakt er één werkstroom van:

1. **Elk resultaat heeft een plek en een volgende stap.** Onder elk resultaat staan twee of drie
   logische vervolgen (toetsvragen → rubric → nakijken), plus "Bewaar bij cursus" en "Gebruik als
   bewijs".
2. **De BDB/BKE-werkplaats doet mee.** Vanuit een criterium open je de juiste tool, en het resultaat
   komt met één klik terug bij dat criterium. De app stelt bewijs voor uit je cursussen en eerder
   werk. Het dossier krijgt een route in vijf stappen.
3. **Eén startscherm met drie ingangen.** Bovenaan "Waar wil je mee aan de slag?", daaronder *Deze
   week*, daaronder je cursussen. De docent kiest per moment, niet per instelling. Het menu gaat van
   zeven naar vier items.
4. **De cursus als werkplek.** Bij elke les, toets en bevinding staat een knop naar de passende tool,
   al ingevuld.

Het denkwerk erachter staat in het document "LimeOnIt als één workflow" (Claude Doc in het project,
5 november 2026).

## Vaste besluiten (BESLUIT-2026-11-05-4)

1. **De cursus is de thuisbasis.** Tools vertrekken uit de cursus (of het dossier) en het resultaat
   komt daar terug. De catalogus blijft als snelle ingang; een resultaat zonder cursus mag.
2. **Drie ingangen op één scherm, geen keuze-instelling.** Vraagvak, *Deze week* en cursussen staan
   samen op de Start-pagina. Er komt geen voorkeur "mijn werkwijze" in het account.
3. **Eén keer maken, twee keer gebruiken.** Wat een docent voor zijn cursus maakt, kan zonder omweg
   bewijs worden in zijn BDB/BKE-dossier, en andersom.
4. **Adviseren, nooit aanpassen** (BESLUIT-2026-11-02-4). Volgende stappen en bewijsvoorstellen zijn
   knoppen en voorstellen; er wordt niets gekoppeld of toegevoegd zonder een klik van de docent.
5. **Data, geen code per tool.** Volgende stappen, cursusknoppen en "los op met" leven in het register
   (`Tool`) en worden bij opstart gevalideerd. Geen `if (tool.id === …)`. De cursus-engine
   (`app/lib/courses/`) blijft neutraal: de koppeling bevinding → tool leeft in het register, niet in
   de engine.
6. **Geen LLM in P27.** Het vraagvak zoekt in v1 met de bestaande zoekwoorden (`TOOL_KEYWORDS`). Een
   AI die de tool kiest, komt pas als de pilot laat zien dat zoeken tekortschiet.
7. **Tot de pilot geen nieuwe AI-tools.** De winst zit in minder klikken tussen de tools die er al
   zijn.
8. **P26.3 (OER-import) gaat naar voren**, direct na P20: zonder import is de eerste cursus typwerk,
   en de eerste tien minuten bepalen of een docent blijft.

## Deelstappen

### 27.1 — Volgende stap onder elk resultaat

- **Register:** `Tool.next?: string[]` (slugs, hooguit 3). `registry/validate.ts` weigert een
  onbekende slug, een verwijzing naar zichzelf en een tool die voor de gebruiker niet beschikbaar is
  (dan valt de knop weg in de loader, niet in de UI).
- **Eerste ketens** (data, aan te passen na de pilot):
  - `test-items` → `rubric-builder`, `test-analysis`
  - `rubric-builder` → `stage-assessment`
  - `authentic-assessment` → `rubric-builder`, `test-items`
  - `lesson-plan` → `differentiation`, `clear-assignment`
  - `guided-reflection` → `lesson-plan`, `authentic-assessment`
  - `differentiation` → `clear-assignment`
  - Controleer elke slug tegen `app/lib/registry/tools/` bij de start; verzin geen tool.
- **Resultaat:** onder het resultaat (`ResultPanel`, ook in chat en multi-stage) een rij "Volgende
  stap" met links. De link draagt de gekozen cursus en het onderdeel mee
  (`/tools/<slug>?course=<id>&item=<id>`), zodat de volgende tool via P20.4 al ingevuld opent.
- **"Bewaar bij cursus"**: dezelfde actie als het koppelformulier van P20.4 op `/projects`, nu ook
  direct onder het resultaat. Is de tool vanuit een cursus geopend, dan is de koppeling er al (P20.4,
  auto-koppeling) en toont de knop "Bewaard bij *cursus*".
- **"Gebruik als bewijs"**: kies een eigen dossier en een criterium → er komt een bewijsstuk bij met
  `sourceGenerationId`, net als de bestaande actie vanaf `/projects`. Hergebruik die actie; geen
  tweede pad.
- **RED:** `tests/registry/next.test.ts` (validatie), `tests/components/ResultNext.test.tsx` (links
  dragen `course` en `item` mee, geen knop voor een onbeschikbare tool, axe),
  `tests/api/result-actions.test.ts` (vreemde cursus of vreemd dossier → niets geschreven).

### 27.2 — De BDB/BKE-werkplaats doet mee

- **De weg terug (route-stap 3).** `ToolHints` linkt naar
  `/tools/<slug>?dossier=<id>&criterion=<id>`. De toolpagina toont dan een smalle balk "Voor je
  dossier: *criterium*" en na het genereren één knop **"Zet bij dit criterium"**. Eigendom van dossier
  en criterium wordt in de actie gecontroleerd; een vreemde of onbekende id geeft geen balk en geen
  fout.
- **Bewijs voorstellen (route-stap 2).** Pure functie `suggestEvidence(framework, generations,
  courseLinks)` in `app/lib/portfolio/`: per criterium de generaties waarvan de tool via
  `TOOL_HINTS` bij dat criterium past, nieuwste eerst, hooguit 5, en nooit iets dat al als bewijs
  bij dat criterium staat. Geen LLM. In het dossier: "Dit heb je misschien al", met selectievakjes.
- **De route in vijf stappen.** Pure functie `dossierStep(data)` → `framework | collect | fill | write
  | finish`, afgeleid uit wat er al is (bevestigd kader, bewijs per criterium, hoofdstukken, status).
  Een voortgangsbalk bovenaan het dossier, als `<ol>` met `aria-current="step"`; elke stap linkt naar
  de plek waar je hem doet. Stap 5 noemt de AI-verantwoording, de Word-export en *Lastig gesprek
  oefenen* voor het eindgesprek.
- **RED:** `tests/portfolio/suggest.test.ts`, `tests/portfolio/step.test.ts`,
  `tests/api/tool-dossier.test.ts` (balk alleen bij eigen dossier; "Zet bij dit criterium" schrijft
  het bewijsstuk met `sourceGenerationId`), component-test met axe.

### 27.3 — Startpagina en een menu van vier

- **Route-onderdeel `start`** (`app/routing/start.ts`, `/start`). `index.tsx` stuurt een docent
  voortaan naar `/start` in plaats van `/tools`. Een beheerder blijft op `/admin/users` landen
  (besluit 2 hieronder).
- **Drie blokken, in deze volgorde:**
  1. **Vraagvak** "Waar wil je mee aan de slag?": een `<form method="get">` met een zoekveld. De
     uitkomst is hooguit drie tools uit dezelfde zoekfunctie als de catalogus (deel die, kopieer hem
     niet), elk met de gekozen cursus in de link.
  2. ***Deze week*:** tot P22 er is: openstaande bevindingen van je cursussen en je laatst gemaakte
     werk (hooguit 5). P22 vervangt dit blok later door de echte week.
  3. **Je cursussen:** naam, aantal open bevindingen, link.
- **Lege start:** zonder cursus alleen het vraagvak, plus "Maak je eerste cursus" en (na P26.3)
  "Importeer je OER".
- **Menu** (`AppShell`, desktop, mobiel en voettekst): **Start · Cursussen · BDB/BKE · Tools**, plus
  Beheer voor beheerders. BDB/BKE staat er alleen als de werkplaats voor die docent aanstaat. *Mijn werk* (`/projects`) blijft bestaan als "Eerder gemaakt", bereikbaar
  vanaf Tools en Start. *Onderwijscontext* gaat naar het accountmenu, *Help* wordt een vraagteken
  rechtsboven en blijft in de voettekst. Geen route verdwijnt.
- **Bijgewerkt (BESLUIT-2026-11-05-5):** de schakelaar hieronder kwam al mee met P27.2 (#88). P28.3
  maakt hem de uitzondering per docent naast teams; P27.3 vraagt voor het menu `portfolioAccess` /
  `effectiveFeatures` en bouwt geen eigen schakelaar.
- **BDB/BKE per docent (besluit 3).** Een beheerder zet de werkplaats aan of uit per docent, op
  `/admin/users`, met automatisch opslaan en een toast zoals de modelkeuze per docent (P18.5).
  Opslag zonder migratie: de sleutel `portfolioEnabled:<userId>` in `instance_settings`, naar het
  patroon van `assignedModels` (`users.server.ts`). Standaard uit. **Overgang:** een docent die al
  een dossier heeft, staat bij de uitrol aan, zodat niemand zijn werk kwijtraakt. Staat hij uit, dan
  geven `/portfolio`, de export en de acties een 404 (server-side, zoals de toolbeschikbaarheid), en
  verdwijnen de knop "Gebruik als bewijs" en de BDB/BKE-balk uit 27.1 en 27.2. Uitzetten wist
  niets: zet de beheerder hem weer aan, dan is het dossier er nog.
- **Techniek uit beeld:** de chips "Formulier", "Gesprek" en "N fasen" op de toolkaarten vervallen; de
  modelkeuze blijft onder *Geavanceerd*.
- **RED:** `tests/routes/start.test.ts` (via `tests/helpers/routes.ts`), `tests/components/Start.test.tsx`
  (drie blokken, lege start, axe), `tests/components/AppShell.test.tsx` (vier items + Beheer; drie
  zonder BDB/BKE), `tests/api/portfolio-access.test.ts` (uit → 404 op pagina's, export en acties; aan
  na een eerder dossier; uitzetten wist niets), een admin-test voor de schakelaar (axe),
  `tests/hotspots.test.ts` blijft groen (nieuwe i18n-namespace `start`).

### 27.4 — De cursus als werkplek

- **Register:** `Tool.courseActions?: ("outcome" | "activity" | "assessment")[]`: bij welk soort
  onderdeel de tool als knop verschijnt. Bijvoorbeeld `lesson-plan` en `differentiation` bij
  `activity`, `test-items` en `rubric-builder` bij `assessment`, `bloom-by-design` bij `outcome`.
- **Los op met:** `FINDING_TOOLS: Partial<Record<FindingCode, string>>` in `app/lib/registry/`
  (niet in de cursus-engine), bijvoorbeeld `outcome-not-assessed` → `test-items`,
  `outcome-not-taught` → `lesson-plan`, `bloom-below-outcome` → `test-items`. Gevalideerd bij
  opstart. Pet-bevindingen van P21 krijgen dezelfde knop als hun `targetId` naar een onderdeel wijst.
- **Weekweergave:** op `/courses/:id` een weergave per week (lessen en toetsen per week, zonder week
  onderaan), naast de bestaande secties van P20.3. Elk onderdeel toont zijn toolknoppen en het werk
  dat eraan gekoppeld is.
- **RED:** `tests/registry/course-actions.test.ts`, `tests/components/CourseWeek.test.tsx` (knoppen
  dragen `course` en `item`, gekoppeld werk staat bij het juiste onderdeel, axe).

### 27.5 — Documentatie (mee in de laatste PR)

`AGENTS.md`: één regel onder *Project model* ("Een resultaat heeft een plek en een volgende stap;
volgende stappen en cursusknoppen zijn registerdata"). Wiki (*Architecture*), de README-rij,
`STATUS.md`.

## Volgorde en afhankelijkheden

| Stap | Wacht op | Tegelijk met |
| --- | --- | --- |
| 27.1 Volgende stap | P20.4 | 27.2 |
| 27.2 BDB/BKE doet mee | P25 (gemerged); 27.1 voor "Gebruik als bewijs" | 27.1 |
| 27.3 Start en menu | P20.3, 27.1 | P21 |
| 27.4 Cursus als werkplek | P20.4; P21 voor pet-knoppen | P26 |

Plaats in het geheel: **P20 → P26.3 → 27.1 + 27.2 → 27.3 → P21 / 27.4 → P22 → rest van P26.** P21
mag naast 27.x lopen (WIP-limiet 2).

## Raakvlakken

- **P20.4** levert het voorinvullen via `?course=` en de auto-koppeling; P27 gebruikt die, en bouwt
  geen tweede pad.
- **P21:** "Los op met…" bij pet-bevindingen gebruikt alleen `targetId`; P21 hoeft er niets voor te
  doen.
- **P22:** vervangt het blok *Deze week* van 27.3 door de echte week; de Start-pagina is zijn plek.
- **P26.4** (cursus als bewijs) en 27.1 ("Gebruik als bewijs" voor een resultaat) delen de keuze van
  dossier en criterium; bouw die één keer, als component.

## Buiten bereik

- Een AI die bij het vraagvak de tool kiest of velden invult (BESLUIT-2026-11-05-4, punt 6).
- De uitvoer van een vorige stap als invoer van de volgende (bijvoorbeeld toetsvragen als bron voor de
  rubric). Logisch vervolg, maar eerst meten of docenten de volgende stap gebruiken.
- Tellingen van gebruik per stap in `/admin/usage` (privacy; eerst Bastiaan).
- Een instelling "mijn werkwijze" per docent.
- De werkplaats per instelling of per groep aanzetten; per docent is genoeg voor de pilot.

## Beslist door Bastiaan (5 november 2026, BESLUIT-2026-11-05-4)

1. **Het besluit klopt zoals verwoord**, ook "tot de pilot geen nieuwe AI-tools" en "P26.3 naar
   voren".
2. **Een beheerder landt op de gebruikerslijst** (`/admin/users`), zoals nu: daar staat wat voor een
   beheerder belangrijk is. Start is er voor docenten; een beheerder komt er via het menu.
3. **De BDB/BKE-werkplaats staat per docent aan of uit, en de beheerder zet hem aan.** Standaard uit
   voor een nieuwe docent. Zie 27.3.

## Acceptatie

`npm test && npm run typecheck && npm run check` groen na elke deelstap. Handmatig nalopen:

1. Een docent maakt toetsvragen vanuit zijn cursus en klikt "Volgende stap: rubric". De rubric-tool
   opent met dezelfde cursus en leeruitkomst ingevuld; het resultaat staat bij dezelfde toets.
2. In het dossier opent hij vanuit een criterium over toetsen de tool *Authentieke toets*, genereert,
   klikt "Zet bij dit criterium" en ziet het bewijsstuk bij dat criterium staan.
3. Het dossier stelt bij een criterium over lesontwerp een eerder gemaakte lesopzet voor; na
   aanvinken staat hij erbij.
4. Een nieuwe docent zonder cursus ziet op Start alleen het vraagvak en "Maak je eerste cursus", en
   geen BDB/BKE in het menu. De beheerder zet de werkplaats voor hem aan; na herladen staat hij erin.
5. Een beheerder logt in en landt op de gebruikerslijst.
6. Een tweede docent kan andermans cursus, dossier of generatie nergens via een link of formulier
   koppelen.
