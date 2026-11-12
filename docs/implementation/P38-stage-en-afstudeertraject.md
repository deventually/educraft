# Fase 38 — Het stage- en afstudeertraject naast OnStage

> **Status:** ⚪ brief. Bouwen mag na P34.1; **aanzetten voor docenten pas na het akkoord van de
> privacy-officer** op de bewaartermijn en de DPIA-aanvulling (BESLUIT-2026-11-12-10, -11). Tot dan
> staat het onderdeel uit voor iedereen. Zo voer je deze brief uit: één deelstap per sessie, elke
> deelstap één PR vanaf `main`, test-first volgens `AGENTS.md` / de `/tdd`-skill, poort
> `npm test && npm run typecheck && npm run check`. Elke PR die opslag, routes of `/api` raakt, krijgt
> een `/security-review`. Merge nooit zelf; alleen Bastiaan merget. Volgorde en gedeelde bestanden:
> `README.md`, *Docenthulpjes*.

## In gewone taal

Bij stages en afstuderen zit het meeste uurwerk per student, en LimeOnIt dekt nu alleen het eind:
*Studentwerk beoordelen* op het eindverslag, oefenen voor het eindgesprek, de verdediging. Elk
concept begint opnieuw, en de eindbeoordeling weet niet welke feedback de student eerder kreeg.

Het traject houdt die lijn vast, zoals de BDB/BKE-werkplaats dat doet voor de docent zelf. De docent
opent per student een traject onder een code (bijvoorbeeld S-0423), gekoppeld aan de stage- of
afstudeercursus en het beoordelingsmodel. Het traject heeft zeven mijlpalen:

| # | Mijlpaal | Wat LimeOnIt doet | Wat er al is |
| --- | --- | --- | --- |
| 1 | Start | Cursus, beoordelingsmodel en inleverdata koppelen; plan van aanpak toetsen aan de criteria (go/no-go als concept) | Beoordelingsmodellen, *Studentwerk beoordelen* |
| 2 | Bezoeken | Bezoek voorbereiden (vragen uit de criteria), steekwoorden naar een verslag | Nieuw |
| 3 | Concepten | Feedforward per ronde; bij een nieuwe versie: wat deed de student met de vorige feedback | Nieuw |
| 4 | Eindversie | De bestaande beoordeling, nu met de eerdere feedback erbij | *Studentwerk beoordelen* |
| 5 | Tweede beoordelaar | Scores van de collega plakken; verschillen per criterium | Kalibreren (P34) |
| 6 | Eindgesprek | Vragen uit de zwakke plekken van het verslag; de verdediging nakijken | *Verdedig je werk*, *Een verdediging nakijken* |
| 7 | Klaar voor OnStage | Per formulierveld de tekst met een kopieerknop; daarna wordt het traject gewist | Word/PDF-export |

**OnStage blijft de officiële plek** (BESLUIT-2026-11-12-11). De docent downloadt het verslag uit
OnStage en zet het in het traject; anonimiseren gebeurt in de browser. Het beoordelingsmodel volgt
het OnStage-formulier van de opleiding (dezelfde criteria, dezelfde volgorde; één keer per opleiding,
te delen met het team). Bij *Klaar voor OnStage* plakt de docent per veld, controleert en tekent in
OnStage. Er is geen koppeling: OnStage (Xebic, nu Paragin) heeft geen openbare API die we kennen.

Wat het oplevert: de eindbeoordeling bouwt op de eigen eerdere feedback; bij een bezwaar ligt de
hele lijn er; één lijst van al je trajecten (code, fase, volgende mijlpaal). Geschatte tijdwinst: 3
tot 6 uur per student over het hele traject.

Herkomst: onderzoek "Docenttaken en hulpjes in LimeOnIt", delen *Stages en afstuderen*, *Workflow:
het stage- en afstudeertraject* en *Samen met OnStage*; Bastiaan: "We hebben al stage en
afstudeerverslagen beoordelen, maar ik heb het idee dat een workflow dit sterker kan maken".

## Vaste uitgangspunten

1. **De docent beslist** (BESLUIT-2026-07-03-4). Elk oordeel is een concept dat de docent bevestigt;
   feedforward geeft geen oordeel. `assistiveGrading` en de AI-melding gelden overal.
2. **Alleen geanonimiseerde tekst en feedback.** Nooit het origineel, nooit een naam. Anonimiseren in
   de browser met verplicht *Verstuur geanonimiseerd* (`redact: true`); de server slaat alleen de
   tekst op die naar de AI ging. De koppeling code–student houdt de docent zelf (in OnStage).
3. **Nooit gedeeld.** Een traject staat niet in `shares.server.ts` en is geen `SHAREABLE_WORK_SLUGS`,
   net als het dossier en `Tool.handlesStudentWork`-werk. Alleen een uitgenodigde tweede
   beoordelaar ziet het (38.5, via P32.4 als dat er is).
4. **Een bewaartermijn, en automatisch wissen.** Elk traject heeft `purgeAfter`. Afronden zet die op
   de afronddatum plus de termijn; *Nu wissen* kan altijd. Een dagelijkse taak wist per instelling
   (`runWithTenant`, zoals `app/server/aiUsageRetention.server.ts`). De termijn is een instelling
   van de beheerder met een voorlopige standaard (90 dagen voor een bezwaar); **de privacy-officer
   bevestigt de termijn** (open punt op het bord).
5. **Onderdeel uit tot het akkoord.** Een nieuw onderdeel `supervisionTracks` in `FEATURES`
   (`app/lib/features/index.ts`) met `defaultStand: "off"`; het traject is onbereikbaar (404) als
   het uit staat, server-side.
6. **Deep modules.** Het traject is één domein (`app/lib/tracks/`), zoals `app/lib/portfolio/`. De
   mijlpalen zijn data, de voortgang is puur afgeleid (zoals `app/lib/portfolio/progress.ts`), en het
   scherm hergebruikt `TabNav` en `ProgressPanel`. Geen tak per mijlpaal in de UI.
7. **Intervisie hoort bij de groep, niet bij één student,** en zit niet in het traject.

## Deelstappen

### 38.1 — Het domein en de opslag (migratie)

- `app/lib/tracks/`: `TrackSchema` (code, soort `internship` | `thesis`, cursus, beoordelingsmodel,
  inleverdata, mijlpalen met status), `progress(track)` en `nextStep(track)`, puur.
- Tabellen in een eigen schemabestand (`app/server/schemaTracks.server.ts`): `supervision_tracks`
  (`id`, `userId`, `code`, `kind`, `courseId`, `assessmentModelId`, `dataJson`, `closedAt`,
  `purgeAfter`, `createdAt`) en `track_rounds` (`id`, `trackId`, `milestone`, `round`,
  `redactedText`, `feedbackJson`, `createdAt`). Index op `userId`; tekst met een cap.
- Repository `app/server/repositories/tracks.server.ts`: alles `async`, gescoped op `userId` in de
  WHERE-clause; lijsten met `Math.min(limit ?? 50, 500)`. Wissen verwijdert rondes en traject.
- Taak `app/server/trackRetention.server.ts`: wist wat over `purgeAfter` is, per instelling.
- Het onderdeel `supervisionTracks` (uit) en de instelling voor de termijn.
- **Migratie:** `npm run db:generate`, het volgende vrije nummer.
- **RED:** scope (een ander leest of wist niets), wissen na de termijn, afronden zet `purgeAfter`,
  het onderdeel uit geeft 404. De code is vrij tekst; de UI waarschuwt "gebruik geen naam".

### 38.2 — De lijst en het traject (scherm, mijlpaal 1)

- Routes in een eigen `RouteArea` (`app/routing/tracks.ts`): `/tracks` (lijst: code, soort, fase,
  volgende mijlpaal) en `/tracks/:id` met tabbladen. *Nieuw traject*: code, soort, cursus en
  beoordelingsmodel (`assessment_models`, gefilterd op documenttype).
- Mijlpaal 1: het plan van aanpak toetsen aan de criteria, via *Studentwerk beoordelen*
  (`stage-assessment`) met het gekozen model; het resultaat (de feedback, niet het verslag) komt als
  ronde in het traject.
- Een plek in het menu? Nee: een blok *Mijn begeleiding* op de cursuspagina van een stage- of
  afstudeercursus en op Start, zoals de BDB/BKE-werkplaats (keuze 2).
- **RED:** loader en action (Zod), componenten met axe; `/accessibility-review`.

### 38.3 — Conceptrondes met feedforward (`feedforward@v1`)

- Prompt `feedforward@v1`: per criterium van het model alleen verbeterpunten en wat al sterk is,
  zonder niveau of cijfer. Vanaf ronde 2 krijgt de prompt de vorige feedback (`{{previousFeedback}}`,
  uit `track_rounds`) en zegt per eerder punt: opgepakt, deels of nog niet, met een letterlijk citaat
  uit de nieuwe versie. Een citaat dat niet letterlijk in de tekst staat, valt weg in code; een punt
  zonder citaat wordt "niet te zien".
- **Evals:** minstens vijf cases met twee versies, twee met een bekende fout (een verbetering die er
  niet is; een niveau of cijfer in feedforward). Dit is het grootste tijdslot, dus de meting telt.
- **RED:** parser (citaatcontrole, geen niveau), `buildSystemPrompt` zonder open `{{…}}`.

### 38.4 — De eindbeoordeling met de feedbacklijn

- *Studentwerk beoordelen* krijgt, vanuit een traject, de eerdere feedback mee als extra invoer:
  een nieuwe versie van de prompt (`stage-assessment@vN+1`) met `{{feedbackHistory}}`, dat leeg is
  buiten een traject. De vorige versie blijft geregistreerd (AGENTS.md, *Prompts*). Het resultaat
  noemt per criterium of de eerder gevraagde verbetering is opgepakt.
- **Evals:** de bestaande stage-assessment-cases blijven gelijk scoren met een lege geschiedenis;
  nieuwe cases met een geschiedenis.

### 38.5 — De tweede beoordelaar

- Op het tabblad *Tweede beoordelaar*: de scores van de collega plakken (of, als P32.4 er is, de
  collega uitnodigen om mee te kijken en zelf te scoren), dan de berekening van P34.1 voor dit ene
  werk, met de verschillen per criterium. Alleen de uitkomst wordt bewaard, bij het traject.

### 38.6 — Bezoeken en eindgesprek

- *Bezoek voorbereiden*: vragen voor student en praktijkbegeleider uit de criteria (AI, alleen
  criteria als invoer). *Verslag uit steekwoorden*: namen eruit met de namencheck; het verslag gaat
  naar Word of naar het klembord en wordt **niet** bewaard; het traject bewaart alleen dat er een
  bezoek was en wanneer.
- Eindgesprek: knoppen naar *Verdedig je werk* en *Een verdediging nakijken*, met de zwakke plekken
  uit de laatste feedback als invoer (`Tool.next`-patroon).

### 38.7 — Klaar voor OnStage en afronden

- Per criterium van het model (in de volgorde van het OnStage-formulier) de definitieve tekst die de
  docent heeft bevestigd, met *Kopieer*. Daarboven: "Plak dit in OnStage, controleer het en
  onderteken daar."
- *Afronden*: het traject sluit, `purgeAfter` wordt gezet, en de docent ziet wanneer het gewist
  wordt. Word/PDF van de hele lijn (P30) als de docent die zelf wil bewaren, met de melding dat dat
  zijn verantwoordelijkheid is.

### 38.8 — Help, wiki en de regels

- Helponderwerp `supervision-track` (NL/EN), met de OnStage-werkwijze. `wiki/Architecture.md`
  (feature-module), `wiki/Authentication.md` (nooit gedeeld), en een regel in `AGENTS.md` onder
  *Database*: een traject is van de docent, nooit gedeeld, en wordt gewist na `purgeAfter`.

## Volgorde

```
38.1 ──▶ 38.2 ──▶ 38.3 ──▶ 38.4 ──▶ 38.7 ──▶ 38.8
                    └────▶ 38.5 (na P34.1)
                    └────▶ 38.6
```

Kleinste nuttige stap: 38.1 + 38.2 + 38.3 (trajecten met feedforward per ronde). Aanzetten pas na
het akkoord van de privacy-officer.

## Buiten deze fase

- Een echte koppeling met OnStage (ophalen, terugzetten): pas als Paragin een API of LTI biedt en
  de hogeschool die openzet. Navragen bij functioneel beheer van OnStage.
- Intervisie met stagestudenten (reeks, draaiboeken, inbrengformulier): een blok bij de stagecursus,
  apart werk als de pilot erom vraagt; de casussen komen nooit in LimeOnIt.
- Het beoordelingsformulier van de opleiding als geüpload bestand invullen: *Klaar voor OnStage*
  maakt dat overbodig zolang het model het formulier volgt.

## Keuzes voor Bastiaan

| # | Vraag | Advies |
| --- | --- | --- |
| 1 | Welke bewaartermijn? | **De privacy-officer beslist.** Voorstel: wissen bij afronden plus 90 dagen voor een bezwaar; OnStage bewaart het officiële dossier. |
| 2 | Waar staan de trajecten? | **Geen nieuw menu-item.** Een blok *Mijn begeleiding* op Start en op de stage- of afstudeercursus. |
| 3 | Mag een collega-begeleider een traject overnemen? | **Nee in deze fase.** Een traject is van één docent; overdragen kan later via de overdracht van P28. |
