# Fase 22 — De week van de docent

> **Status:** ⚪ brief, nog niet bouwen. **Hangt af van P27.3** (de Start-pagina met het blok *Deze
> week*); 22.3 gebruikt de toolknoppen van **P27.4** als die er zijn, en de pet-bevindingen van
> **P21** als die er zijn. Zonder P21 en P27.4 werkt alles, alleen met minder knoppen. Zo voer je deze
> brief uit: één deelstap per sessie, elke deelstap één PR vanaf `main`, test-first volgens
> `AGENTS.md` / de `/tdd`-skill, poort `npm test && npm run typecheck && npm run check`. Merge nooit
> zelf; alleen Bastiaan merget. **Eerst kiest Bastiaan** de punten onder *Te beslissen*; deze brief
> is geschreven op de aanbevolen keuzes.

## In gewone taal

Een docent weet nu pas wat er deze week moet gebeuren als hij zelf zijn cursussen langsloopt. Een
cursus kent alleen "week 3", geen datum.

P22 laat de week naar de docent toe komen:

1. **Echte datums.** De docent zet een startdatum bij een cursus. Dan weet de app dat "week 3" de
   week van 17 november is, en slaat hij de vakantieweken over.
2. **De week op Start.** Bovenaan Start staat wat er deze week gebeurt, over al je cursussen heen:
   welke lessen en toetsen er zijn, wat je nog moet voorbereiden, wat je nog moet nakijken, en welke
   aandachtspunten er openstaan. Bij elke regel een knop naar de juiste tool, al ingevuld.
3. **Vooruitkijken.** Vanaf vrijdag schuift er een blok *Volgende week* bij. Dat is de
   "zondagbriefing": je ziet hem zodra je de app opent, zonder dat er iets op de achtergrond draait.
4. **In je agenda.** Per cursus een agendabestand (`.ics`) om te downloaden, met de lessen en toetsen
   per week.

Er draait geen AI en er gaat geen e-mail de deur uit. Alles wordt berekend uit wat de docent al in
zijn cursus heeft staan.

## Wat er al is

- **Cursussen (P20):** activiteiten en toetsen hebben een relatieve `week` (1 t/m 60), nog geen
  datum (`app/lib/courses/types.ts`). `CourseDataSchema` is niet `.strict()`: een nieuw optioneel veld
  kost geen migratie.
- **Bevindingen (P20, P26):** `checkAlignment` geeft per cursus de vaste aandachtspunten.
- **Gekoppeld werk (P20.4):** `course_links` met `itemId` zegt welk werk bij welke les of toets hoort.
- **Start (P27.3):** het blok *Deze week* toont tot P22 de open bevindingen en het laatst gemaakte
  werk. P27 zegt: "P22 vervangt dit blok door de echte week; de Start-pagina is zijn plek."
- **Weekweergave (P27.4):** `/courses/:id` per week, met toolknoppen per onderdeel
  (`Tool.courseActions`, `FINDING_TOOLS`).
- **Aan en uit (P28.3):** `effectiveFeatures(user)`. Staat *Cursussen* uit, dan is er geen week.
- **Productie** is één Node-proces (`react-router-serve`) met één SQLite-bestand
  ([Deployment](../../wiki/Deployment.md)). Er is geen eigen serverbestand en geen achtergrondproces.

## Uitgangspunten (aanbevolen, zie *Te beslissen*)

1. **Afgeleid, niet bijgehouden.** De week is een pure functie van de cursussen, de koppelingen en de
   datum van vandaag. Er komt geen takenlijst om af te vinken: "voorbereid" betekent dat er werk aan
   de les hangt. Dat sluit aan op P21 ("Akkoord = alleen vastleggen, geen takenlijst").
2. **Geen planner in P22.** De "zondagbriefing" is het blok *Volgende week* op Start, berekend bij het
   openen. De jobrunner uit de oude stub vervalt hier; hij komt pas als er iets echt op de
   achtergrond moet (e-mail, de Cases-add-on). Zie *Waarom geen jobrunner*.
3. **Geen AI.** Geen samenvatting door een model en geen geplande beoordeling door de petten van P21.
   Dat kost per docent per week geld en voegt weinig toe aan een lijst die al klopt.
4. **Adviseren, nooit aanpassen** (BESLUIT-2026-11-02-4). De week toont en linkt; er wordt niets
   gekoppeld, gemaakt of gewijzigd zonder klik.
5. **Engine neutraal.** Weken zijn ISO-weken (maandag t/m zondag). Vakanties en tijdzone zijn
   instellingsdata, geen code. Geen `if (sector === …)`.
6. **Geen nieuwe dependency.** Datums rekenen we met `Date` in UTC op kalenderdagen plus
   `Intl.DateTimeFormat` voor de weergave. ICS schrijven we zelf (een paar regels, RFC 5545).

## Deelstappen

### 22.1 — Echte datums

Geen migratie.

- **Cursus:** optioneel `startDate?: string` in `CourseData` (ISO-datum `YYYY-MM-DD`, Zod-regex en
  een echte datum). Hoort de datum niet op een maandag te vallen, dan rekent de app vanaf de maandag
  van die week. De cursuseditor (P20.3) krijgt bij de gegevens een `<input type="date">` met label en
  uitleg ("Week 1 begint in deze week"). Een import (P26.3) laat hem leeg en overschrijft hem niet.
- **Vakantieweken (instelling):** sleutel `breakWeeks` in `instance_settings`, een lijst
  maandag-datums (hooguit 52). De beheerder vult ze in op `/admin/context` in een sectie
  *Schoolkalender*: per regel een datum, automatisch opslaan met toast (`AutoSaveForm`). Leeg = geen
  vakanties. Eén lijst voor de hele instelling: alle cursussen van een hogeschool delen dezelfde
  vakanties.
- **Tijdzone:** sleutel `timeZone` in `instance_settings`, standaard `Europe/Amsterdam`, nog zonder
  scherm. "Vandaag" is de kalenderdag in die tijdzone.
- **Puur rekenhart** `app/lib/calendar/` (`weeks.ts`):
  - `mondayOf(date)`, `addWeeks(date, n)`, `isoWeek(date)`;
  - `courseWeekDates(startDate, breakWeeks, lastWeek)` → per relatieve week de maandag, met
    vakantieweken overgeslagen;
  - `courseWeekOn(startDate, breakWeeks, today)` → de relatieve week van vandaag, of `before` /
    `after` / `break`.
- **Weergave:** waar P27.4 "Week 3" toont, staat met een startdatum "Week 3 · 17–23 nov"
  (`Intl.DateTimeFormat` in de taal van de gebruiker, in een `<time datetime>`).
- **RED:** `tests/calendar/weeks.test.ts` (maandag van een zondag, jaarwisseling en ISO-week 53,
  zomertijdwissel, vakantie in week 1, twee vakanties achter elkaar, vandaag in een vakantie, vóór de
  start, na de laatste week); `tests/courses/schema.test.ts` (ongeldige datum geweigerd, oude data
  zonder datum blijft geldig); editor-intent; admin-sectie met axe; `tests/hotspots.test.ts` en
  `tests/i18n.test.ts` groen.

### 22.2 — De week, puur

Geen migratie, geen scherm.

- `app/lib/week/teacherWeek.ts`: `teacherWeek({ courses, links, findings, breakWeeks, today })` →
  per cursus met een startdatum die nu loopt:
  - **Deze week:** de activiteiten en toetsen van de huidige relatieve week;
  - **Voorbereiden:** activiteiten en toetsen van deze en volgende week zonder gekoppeld werk
    (`course_links.itemId`);
  - **Nakijken:** toetsen uit de twee weken hiervoor (een vast getal in de code, geen termijn uit een
    OER);
  - **Aandachtspunten:** het aantal open bevindingen van `checkAlignment`, plus de open
    pet-bevindingen als P21.3 er is (anders weggelaten, geen lege rij).
  - Een cursus zonder startdatum komt in een aparte lijst *Zonder startdatum*; een cursus die nog niet
    begonnen of al afgelopen is, valt weg; een vakantieweek geeft één regel "Vakantie".
- `nextWeek(…)` is dezelfde functie met `today + 7 dagen`. Geen tweede pad.
- Begrensd: de loader vraagt hooguit 20 cursussen (`listCourses(userId, 20)`), en per blok staan
  hooguit 10 regels met "en nog N".
- **RED:** `tests/week/teacherWeek.test.ts` met vaste datums: les zonder werk staat onder
  Voorbereiden en verdwijnt na koppelen; toets van vorige week staat onder Nakijken; vakantieweek;
  cursus zonder datum; twee cursussen door elkaar, gesorteerd op cursusnaam; volgende week over een
  vakantie heen.

### 22.3 — De week op Start

Geen migratie.

- Het blok *Deze week* van P27.3 gebruikt `teacherWeek` zodra minstens één cursus een startdatum
  heeft. Anders blijft het P27.3-blok staan, met de hint "Zet een startdatum bij je cursus, dan zie je
  hier je week" en een link naar de cursus.
- **Indeling:** een `<section>` met kop "Deze week · week 47" en per cursus een `<h3>` met daaronder
  lijsten *Deze week*, *Voorbereiden*, *Nakijken*. Elke regel linkt naar het onderdeel in de cursus;
  met P27.4 ook een toolknop (`/tools/<slug>?course=<id>&item=<id>`), uit `Tool.courseActions` en
  `FINDING_TOOLS`. Geen eigen koppeling van regel naar tool in P22.
- **Volgende week:** van vrijdag tot en met zondag (in de tijdzone van de instelling) staat er een
  tweede sectie *Volgende week*, met dezelfde opbouw. Op maandag is het weer gewoon *Deze week*.
- Server-side: de loader rekent, alleen voor de eigen cursussen en koppelingen (repositories, per
  `userId`), en alleen als `effectiveFeatures(user)` *Cursussen* aan heeft.
- i18n-namespace `week` in `messages/{nl,en}/week.ts`.
- **RED:** `tests/components/TeacherWeek.test.tsx` (drie lijsten, lege cursus, vakantie, vrijdag
  toont Volgende week en maandag niet, links dragen `course` en `item`, axe nul overtredingen);
  `tests/routes/start.test.ts` uitgebreid (Cursussen uit → geen week; andermans cursus nooit
  zichtbaar). Screenshots NL/EN, desktop en mobiel.

### 22.4 — In je agenda (ICS-download)

Geen migratie.

- Route `/courses/:id/calendar.ics` in `app/routing/courses.ts`, alleen voor de eigenaar (anders
  404), alleen met een startdatum (anders 404). Antwoord `text/calendar; charset=utf-8` met
  `Content-Disposition: attachment`.
- Puur `app/lib/calendar/ics.ts`: `courseToIcs(course, weekDates, locale)` → per activiteit en toets
  met een week één hele-weekgebeurtenis (`DTSTART;VALUE=DATE` maandag, `DTEND` de maandag erna), met
  de titel en de cursusnaam. Vaste `UID` `<courseId>-<itemId>@limeonit`, zodat opnieuw importeren
  bijwerkt in plaats van verdubbelt. CRLF, regels gevouwen op 75 octets, `,;\` en nieuwe regels
  ge-escaped.
- Er staat alleen in wat de docent zelf typte (cursus, lessen, toetsen); nooit studentdata.
- Knop "Zet in je agenda" op `/courses/:id` bij de startdatum.
- **RED:** `tests/calendar/ics.test.ts` (escaping, vouwen, CRLF, stabiele UID, vakantie overgeslagen,
  onderdeel zonder week weggelaten), `tests/api/course-ics.test.ts` (eigenaar 200 met de juiste
  headers, ander 404, zonder datum 404).

### 22.5 — Documentatie (mee in de laatste PR)

Wiki (*Architecture*, kort: de week is afgeleid, geen planner), de README-rij, `STATUS.md`, en een
kort helponderwerp "Je week".

## Volgorde

| Stap | Wacht op | Tegelijk met |
| --- | --- | --- |
| 22.1 Echte datums | — (kan na P27.3, raakt de cursuseditor) | 22.2 |
| 22.2 De week, puur | 22.1 (het rekenhart) | 22.1 als 22.1 eerst `weeks.ts` merget |
| 22.3 De week op Start | 22.2, P27.3; P27.4 voor de toolknoppen | 22.4 |
| 22.4 ICS | 22.1 | 22.3 |

Hooguit twee werkers tegelijk (WIP-limiet).

## Waarom geen jobrunner

De oude stub had een `jobs`-tabel, een tick-worker en een geplande zondagbriefing. Eerlijk advies: nu
niet bouwen.

- **Er is niets om op de achtergrond te doen.** Zonder e-mail en zonder AI is de briefing een
  berekening van een paar milliseconden. Die kan gewoon bij het openen van Start.
- **Er is geen plek voor een achtergrondproces.** De app start met `react-router-serve`. Een worker
  vraagt een eigen serverbestand, netjes stoppen bij afsluiten, en een oplossing voor de dev-server die
  modules herlaadt. Dat is werk en risico zonder winst voor de docent.
- **Een bewaarde briefing veroudert.** Koppelt de docent op maandag werk aan een les, dan klopt een
  briefing van zondag al niet meer. Een berekende week klopt altijd.
- **De Cases-add-on** (de reden om de runner generiek te maken) staat onder *Later* op het bord. Bouw
  de runner als die add-on of e-mail echt komt, met die eisen erbij.

## Buiten bereik

- E-mail met de briefing (er is geen e-maildienst, zie P28).
- Een jobrunner, geplande jobs, en geplande beoordelingen door de petten van P21.
- Een takenlijst om af te vinken; een nakijktermijn uit de OER.
- Een agendafeed met een geheime link, terugschrijven naar een agenda, OAuth.
- Dagen en tijden van lessen (roosters); de week is de kleinste eenheid.
- Pushmeldingen, roosters voor studenten, de Cases-add-on.
- Een eigen schoolkalender per team of per cursus.

## Te beslissen door Bastiaan

1. **Planner of niet.** *Aanbevolen:* geen jobrunner; *Volgende week* verschijnt vanaf vrijdag op
   Start. *Alternatief:* de stub zoals hij was, met jobrunner en een bewaarde zondagbriefing in de
   app (één deelstap extra, plus een eigen serverbestand).
2. **Vakantieweken: één lijst voor de instelling**, ingevuld door de beheerder. *Alternatief:* per
   cursus door de docent (geen beheerscherm, wel meer typwerk).
3. **Agenda: een bestand om te downloaden.** *Alternatief:* een feed met een geheime link die de agenda
   zelf bijwerkt. Handiger, maar wie de link heeft, ziet de cursus; en agenda's van Google of
   Microsoft halen hem dan op hun eigen servers op.

Na de keuze legt de Producer het vast als BESLUIT in `besluiten.md` en zet hij de keuzes hier onder
*Beslist door Bastiaan*.

## Acceptatie

`npm test && npm run typecheck && npm run check` groen na elke deelstap. Handmatig nalopen:

1. De beheerder zet de herfstvakantie als vakantieweek. Een docent zet bij zijn cursus een
   startdatum vóór die vakantie. Op `/courses/:id` staat bij elke week de juiste datum, en de week na
   de vakantie is de volgende lesweek.
2. Op Start ziet de docent deze week de les en de toets van zijn cursus. De les zonder gekoppeld werk
   staat onder *Voorbereiden*; hij klikt de toolknop, maakt een lesopzet, en na herladen is de les van
   die lijst af.
3. De toets van vorige week staat onder *Nakijken*.
4. Op vrijdag staat er ook *Volgende week*; op maandag niet meer.
5. Een cursus zonder startdatum geeft de hint met de link, geen fout.
6. Hij downloadt het agendabestand en opent het in zijn agenda: elke les en toets staat in de juiste
   week, de vakantie is leeg. Opnieuw importeren maakt geen dubbele afspraken.
7. Een tweede docent krijgt een 404 op `/courses/<id van de eerste>/calendar.ics` en ziet de cursus
   van de eerste nergens in zijn week.
