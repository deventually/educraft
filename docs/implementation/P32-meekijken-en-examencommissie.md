# Fase 32 — Meekijken: een reviewer Examencommissie en meekijkers die de docent zelf kiest

> **Zo voer je deze brief uit:** open hem in een verse sessie en voer één deelstap uit, test-first
> volgens `AGENTS.md` / de `/tdd`-skill. Elke deelstap is een eigen PR vanaf `main`; de poort
> (`npm test && npm run typecheck && npm run check`) is groen vóór de PR.
> **Niet vóór het einde van de pilot** (BESLUIT-2026-11-10-1). **Hangt af van:** opleidingen
> (#241), leerlijnen (#244), samenwerken en overdragen (#243, #247), het reviewteam (P21, #231,
> #235–#239), delen met het team (P28.4) en de vakgebiedpakketten (#242, #245).

> **Stand (2026-11-10):** plan, nog niet gebouwd. De keuzes onderaan liggen bij Bastiaan; elke
> keuze heeft een advies, en de brief is geschreven alsof hij dat advies volgt.

## In gewone taal

Er komen twee dingen, die los van elkaar werken:

1. **Een reviewer Examencommissie (AI).** Op de pagina van een opleiding klikt het team op
   *Laat de examencommissie meekijken*. Een AI-collega leest alle cursussen van de opleiding en de
   leerlijnen, en geeft adviezen over de opleiding als geheel: komt elke eindkwalificatie terug in
   een toets, loopt het niveau op, klopt de studielast per jaar. Het team zegt per advies *Akkoord*
   of *Niet akkoord*, net als bij het reviewteam van een cursus. Zo kan het team zelf kijken,
   vóórdat de echte commissie dat doet.
2. **Meekijken met echte mensen, op uitnodiging.** Een docent nodigt iemand uit om mee te kijken
   naar een eigen cursus, rubric of ander werk: een collega, een mentor, iemand van buiten de
   school. De teamleider doet hetzelfde voor een hele opleiding, met een commissie erbij
   (Examencommissie, Toetsingscommissie, CTL). Alleen wie is uitgenodigd kijkt mee; elke
   uitnodiging heeft een **verloopdatum** en is altijd **in te trekken**. Een meekijker leest en
   adviseert, maar verandert nooit iets, en ziet nooit studentwerk, chats of het dossier.

Er is **één** meekijkmechanisme. Een commissie is daarin alleen een label met een standaardfocus,
en de namen zijn **data**: een nieuwe commissie, zoals later misschien een BDB/BKE-team, is een
regel data erbij, zonder nieuwe code (zie *Uitbreiden*).

### Twee manieren om iemand uit te nodigen

| | **Met een account** | **Met een leeslink** (zonder account) |
| --- | --- | --- |
| Voor wie | Iemand die al in LimeOnIt kan inloggen: een collega, een commissielid | Iedereen anders: een mentor, een werkveldpartner, een collega van een andere school |
| Hoe | De docent kiest de persoon op e-mailadres | De docent maakt een link en stuurt die zelf door |
| Alleen die persoon? | **Ja**, want hij of zij moet inloggen | **Nee, niet hard.** Wie de link heeft, kan lezen. Daarom: kort geldig, in te trekken, en de docent ziet wanneer de link geopend is |
| Adviseren | Ja, met Akkoord / Niet akkoord van de docent | Nee, alleen lezen |
| Verloopt | Ja, standaard na 90 dagen, hooguit een jaar, te verlengen | Ja, standaard na 14 dagen, hooguit 90 dagen |

Een uitnodiging per e-mail met een inlogcode zou "alleen die persoon" ook zonder account waar
maken, maar LimeOnIt verstuurt nu geen e-mail. Dat vraagt een maildienst (keuze 8), en valt buiten
deze fase.

## Vaste besluiten (uit eerdere besluiten, niet opnieuw ter discussie)

- **Adviseren, nooit aanpassen** (BESLUIT-2026-11-02-4). Dat geldt voor de AI-reviewer én voor
  meekijkers. Niets in deze fase schrijft naar een cursus, opleiding, leerlijn of werk.
- **Feiten zonder knoppen, meningen met knoppen** (P21). Het leerlijnoverzicht en de P20-controles
  zijn feiten; alleen adviezen (van de AI-reviewer of van een mens) krijgen Akkoord / Niet
  akkoord. Een verworpen AI-advies komt niet terug.
- **Een reviewer is data** (`app/lib/agents/registry.ts`). Docenten lezen *Reviewteam* en
  *reviewer* (BESLUIT-2026-11-10-2). Geen `if (agent.id === …)`.
- **Een opleiding is van een team** (BESLUIT-2026-11-10-3). Collega's lezen een cursus in de
  opleiding alleen zolang die met het team gedeeld is (`listProgrammeCourses`).
- **Lezen buiten de eigenaar gaat alleen via `shares.server.ts`** (P28.4). Werk van een
  `Tool.handlesStudentWork`-tool, chats en het dossier worden nooit gedeeld; ander werk alleen als
  het in `SHAREABLE_WORK_SLUGS` staat.
- **Rollen blijven `teacher | admin`.** Meekijken is een stand per item, zoals teamleider een
  stand per team is. `users.sessionVersion` gaat er niet van omhoog. Een leeslink maakt geen
  account aan.
- **Alleen geverifieerde kaders.** De reviewer noemt alleen kaders die in de invoer staan (de
  vakgebiedpakketten, het Dublin-pakket); hij citeert geen wetsartikelen.

## Het patroon

- **Reviewer:** hetzelfde als P21. De pure helft bouwt de invoer en controleert het antwoord
  (`app/lib/agents/`); de serverhelft roept de provider aan (`app/server/agentReview.server.ts`).
  Nieuw is alleen het doel `programme` naast `course` en `generation`.
- **Meekijken:** hetzelfde als delen (P28.4), maar met één persoon of één link in plaats van een
  team. Eén tabel `view_grants` beschrijft elke uitnodiging; de leesregel staat in de
  WHERE-clause, in `shares.server.ts`, en controleert altijd ook "nog geldig" (niet verlopen). Een
  leeslink wordt bewaard zoals een uitnodigings- of resetlink nu: alleen de hash van het token.

---

## Spoor A — de reviewer Examencommissie (3 PR's)

### 32.1 — Invoer, prompt en meting (geen migratie)

- `AGENT_TARGETS` krijgt `"programme"`. De reviewer is één regel data:
  `{ id: "exam-board", role: { nl: "Examencommissie", en: "Examination board" }, promptId:
  "agent-exam-board@v1", watches: ["programme"], focus, teacherDefault: "on" }`.
  `agentsWatching("course")` blijft dus precies de zes cursusreviewers; geen enkele cursusscherm
  verandert.
- `app/lib/agents/programmeInput.ts`: `buildProgrammeReviewMessage({ programme, courses, lines,
  rejected }, locale)`.
  - Elke cursus krijgt een sleutel `C1`, `C2`, … (volgorde: jaar, periode, naam), met jaar,
    periode, EC en de items onder samengestelde sleutels `C1·L1`, `C2·T3` (hergebruik
    `courseKeys`).
  - **Feiten**, in code berekend en als vaste feiten in de invoer, zodat de reviewer ze niet
    herhaalt: per leerlijn het `learningLineOverview` (draden, dalend Bloom-niveau), per cursus de
    tellingen uit `checkAlignment`, en EC per studiejaar.
  - **Begrenzing:** hooguit 40 cursussen; per cursus de tekst begrensd zoals in `input.ts`. Is de
    opleiding groter, dan zegt de invoer eerlijk dat er cursussen ontbreken en welke.
- `app/lib/agents/programmeFilter.ts`: `parseProgrammeReview(raw, keys, rejected)` zet
  `C2·T3` terug naar `{ courseId, itemId }`, `C2` naar `{ courseId }`, en geen sleutel naar de
  opleiding als geheel. Weg met onbekende sleutels, dubbelen en eerder verworpen adviezen.
- Prompt `agent-exam-board@v1` (NL en EN, volgens `app/lib/prompts/TEMPLATE.md`): kijkt naar de
  opleiding als geheel, niet naar losse cursussen (dat doet het reviewteam per cursus al): wordt
  elke leeruitkomst op eindniveau ergens getoetst, loopt het niveau op door de jaren, zijn er
  toetsen die dubbel toetsen of gaten laten, staat er ergens alleen ongecontroleerd (*zonder
  toezicht*) getoetst werk op een eindkwalificatie, klopt de studielast per jaar.
- Evals `evals/agent-exam-board/`: opleidingen met een **bekende fout** (een eindkwalificatie die
  nergens getoetst wordt; een leerlijn waarin het niveau daalt; jaar 2 met 75 EC; alleen
  ongecontroleerde toetsen op een eindkwalificatie) en één goede opleiding waarop niets verzonnen
  mag worden. Harde checks zoals P21.2. Klaar bij BESLUIT-2026-11-04-24 (elke case ≥ 4,5),
  tussenrondes via de Batch API (BESLUIT-2026-11-04-25).
- **RED:** `tests/agents/programmeInput.test.ts`, `programmeFilter.test.ts`,
  `tests/agents/registry.test.ts` (het doel `programme`), `tests/agents/prompts.test.ts` (geen open
  `{{…}}`).
- **Besluit:** in deze PR komt het besluit met Bastiaans keuzes van onderaan in `besluiten.md`.

### 32.2 — Opslag en draaien (migratie)

- Nieuw schemabestand `app/server/schemaProgrammeReviews.server.ts` (eigen bestand, zodat
  het niet botst met spoor B):
  - `programme_reviews`: `id`, `programme_id`, `agent_id`, `model`, `findings_json`,
    `input_hash` (een hash van de invoer: verandert een cursus of leerlijn, dan is de review
    "verouderd"), `requested_by`, `created_at`. Index op `programme_id`.
  - `programme_decisions`: `id`, `programme_id`, `review_id`, `finding_id`, `decision`,
    `reason`, `decided_by`, `created_at`. Uniek op (`review_id`, `finding_id`). Adviezen van
    mensen (spoor B) dragen hun antwoord op hun eigen rij, dus spoor A en B delen geen tabel.
- Een review is **van de opleiding, dus van het team**, niet van wie hem startte. Repository
  `app/server/repositories/programmeReviews.server.ts`, gescoped zoals `programmes.server.ts`:
  lezen wie de opleiding mag lezen; draaien elk teamlid; beslissen de teamleider of een beheerder
  (keuze 1).
- `app/server/agentReview.server.ts` krijgt `reviewProgramme(actor, programmeId, model)`, op het
  model dat de docent kiest (P18.3), met het dagquotum zoals de cursusreview. Eén reviewer, dus geen
  keuzevinkjes; de schakelaar van de beheerder op `/admin/agents` geldt wel.
- **Migratie:** `npm run db:generate`; het volgende vrije nummer (nu 0029). Staat er eerder
  een migratie van spoor B op `main`, dan genereert deze PR opnieuw na het binnenhalen van `main`.
- **RED:** repositorytests (scope: een niet-teamlid leest niets; een teamlid zonder leiding beslist
  niet; een beslissing op een onbekende `finding_id` wordt geweigerd), `reviewProgramme` met de
  nepprovider.

### 32.3 — Scherm en help (geen migratie)

- Op `/programmes/:id` een paneel **Reviewteam** met de knop *Laat de examencommissie meekijken*,
  de adviezen gegroepeerd per cursus en "over de hele opleiding", Akkoord / Niet akkoord voor wie
  mag beslissen, en "verouderd" als de invoer veranderde. Een advies met een cursussleutel linkt
  naar die cursus (eigen of gedeeld). Hergebruik de bestaande paneelonderdelen van de cursus waar
  dat kan; maak ze dieper in plaats van te kopiëren.
- Help: een eigen stuk *Examencommissie* in `review-team` (`tests/help.test.ts` eist het), en een
  alinea in het helponderwerp `programmes`.
- i18n in een eigen namespace (`programmeReview`).
- **RED:** componenttest met axe, routetest met `signInAs` (teamlid ziet het paneel, beslisknoppen
  alleen voor de teamleider; een niet-teamlid krijgt 404).

---

## Spoor B — meekijken op uitnodiging (5 PR's)

### Wat kan meegekeken worden

| Item | Wie nodigt uit | Met account | Met leeslink | Commissie erbij |
| --- | --- | --- | --- | --- |
| Cursus | eigenaar of mede-eigenaar (wie mag delen, BESLUIT-2026-11-10-5) | ja | ja | nee |
| Rubric | eigenaar | ja | ja | nee |
| Ander werk (een generatie) | eigenaar, alleen werk uit `SHAREABLE_WORK_SLUGS` | ja | ja | nee |
| Opleiding | teamleider of beheerder | ja | nee (keuze 6) | ja |

Wat nooit kan: werk van een `Tool.handlesStudentWork`-tool, chats, het dossier, een
onderwijscontext. De lijst van soorten is data (`VIEW_SUBJECTS`), net als `SHARE_KINDS`; een
nieuwe soort vraagt een leesfunctie in `shares.server.ts` en een besluit.

### Commissies als data

`app/lib/observers/committees.ts`, gevalideerd bij opstart zoals de reviewers:

```ts
{ id: "exam-board",           name: { nl: "Examencommissie", … },    about: {…}, startView: "lines" }
{ id: "assessment-committee", name: { nl: "Toetsingscommissie", … }, about: {…}, startView: "assessments" }
{ id: "ctl",                  name: { nl: "CTL", … },                about: {…}, startView: "design" }
```

- `about` is één zin uitleg, getoond bij het uitnodigen en bij de meekijker.
- `startView` is de **standaardfocus**: met welk overzicht de pagina van een opleiding opent. De
  overzichten zijn een vaste lijst voor iedereen: `lines` (leerlijnen en eindniveau),
  `assessments` (toetsen en dekkingsmatrix per cursus), `design` (activiteiten en alignment). Een
  meekijker kan altijd wisselen. Er is geen code per commissie.
- Een uitnodiging zonder commissie is gewoon "meekijker", en opent op `design`.

**Uitbreiden.** Een nieuwe commissie die naar een opleiding kijkt, is één regel in deze lijst plus
de helptekst; `tests/observers/committees.test.ts` dwingt af dat elke commissie een helpstuk heeft.
Een commissie die naar **iets anders** kijkt, is geen data alleen. Een BDB/BKE-team zou naar
dossiers kijken, en het dossier wordt nooit gedeeld: dat vraagt eerst een besluit en een eigen
leesregel. Dit plan bouwt daar niets voor.

### 32.4 — Meekijken met een account: cursus, rubric en werk (migratie)

- Nieuw schemabestand `app/server/schemaViewGrants.server.ts` (eigen bestand, zodat het niet
  botst met spoor A): `view_grants` met `id`, `subject_kind`, `subject_id`, `granted_by`,
  `grantee_user_id` (leeg bij een leeslink), `token_hash` (leeg bij een account), `committee`
  (leeg, of een id uit de lijst), `expires_at` (verplicht), `last_opened_at`, `created_at`.
  Uniek op (`subject_kind`, `subject_id`, `grantee_user_id`); indexen op `grantee_user_id` en
  `token_hash`. Alle kolommen voor 32.5 en 32.6 staan er al, zodat die geen migratie nodig hebben.
- **Uitnodigen** op de pagina van het item, onder *Delen*: *Laat iemand meekijken*, persoon op
  e-mailadres (een bestaand, actief account; geen lijst van alle gebruikers, dus geen
  zoekfunctie die namen lekt), en een verloopdatum (standaard 90 dagen, hooguit een jaar).
  De docent ziet wie meekijkt, tot wanneer, en wanneer voor het laatst geopend.
- **Intrekken** en **verlengen** kan altijd, door wie mag uitnodigen. Intrekken haalt de rij weg en
  werkt meteen. Verloopt een uitnodiging, dan leest niemand meer; de rij blijft tot de docent hem
  opruimt of verlengt.
- **Lezen, alleen in `shares.server.ts`:** `listViewGrantsForMe(viewerId)` en
  `getViewedCourse` / `getViewedRubric` / `getViewedWork(viewerId, id)`, elk met
  `expires_at > now` in de WHERE-clause. Een cursus geeft geen gekoppeld werk mee (keuze 3) en geen
  reviews van het reviewteam (keuze 4). Geen kopiëren (keuze 5).
- Een pagina **Meekijken** (`/observe`, eigen routegebied `app/routing/observe.ts`), in het menu
  alleen voor wie ergens meekijkt: wat je mag inzien, van wie, tot wanneer.
- Wie mag weten wie meekijkt: de uitnodiger, de eigenaar en mede-eigenaars van een cursus, en een
  beheerder op de persoonspagina.
- Onderdeel `viewing` in `FEATURES` (standaard aan, `instanceOnly`), zodat de beheerder het voor de
  hele instelling kan uitzetten.
- `AGENTS.md`, onder *Database*: één regel over meekijken naast die over delen.
- **RED:** repositorytests (alleen de uitgenodigde leest; na intrekken niet meer; na de
  verloopdatum niet meer; een bewerker kan niet uitnodigen, een mede-eigenaar wel; studentwerk en
  chats kunnen nooit een uitnodiging krijgen), `tests/architecture.test.ts` (geen leesquery op
  `view_grants` buiten `shares.server.ts` en de eigen repository), routetests met `signInAs`, axe.
- **Migratie:** het volgende vrije nummer.

### 32.5 — Meekijken met een leeslink (geen migratie)

- *Maak een leeslink*: een willekeurig token van 32 bytes, in de database alleen de SHA-256-hash
  (zoals uitnodigingen en wachtwoordresets). De link is één keer te zien en te kopiëren; daarna
  niet meer, alleen intrekken of een nieuwe maken. Verloopt standaard na 14 dagen, hooguit 90.
- Een openbare route `/view/:token`, buiten het inloggen: alleen lezen, met dezelfde inhoud als
  in 32.4, zonder namen van collega's (de eigenaar staat er alleen als hij of zij dat aanvinkt).
  Rate limit per IP zoals inloggen, `noindex`, `Referrer-Policy: no-referrer`, de bestaande
  CSP. Een verlopen of ingetrokken link geeft een nette pagina "Deze link werkt niet meer",
  zonder te zeggen of hij ooit bestond.
- `last_opened_at` wordt bijgewerkt, zodat de docent ziet of en wanneer de link geopend is.
- Onderdeel `readLinks` in `FEATURES`, **standaard uit** (keuze 7): een instelling kiest zelf of
  docenten iets buiten de school mogen laten zien.
- **RED:** het token staat nergens leesbaar in de database; een verkeerd, verlopen of ingetrokken
  token geeft dezelfde 404; de pagina toont nooit linked werk van een studentwerktool; axe en een
  e2e-test met CSP op `/view/:token`.

### 32.6 — Commissies bij een opleiding (geen migratie)

- De teamleider of een beheerder nodigt op `/programmes/:id` een meekijker uit, met een commissie
  uit de lijst (verplicht bij een opleiding). Verloopdatum standaard het einde van het studiejaar
  (31 augustus), te verlengen. Toevoegen en intrekken komen in het logboek (`admin_audit`, alleen
  id's).
- `getViewedProgramme(viewerId, programmeId)` in `shares.server.ts`: de opleiding, haar cursussen
  (met dezelfde regel als `listProgrammeCourses`: alleen wat met het team gedeeld is), de
  leerlijnen, en de review van de AI-reviewer met de besluiten van het team (als spoor A er is).
  `getViewedCourse` leest ook een cursus die via een opleiding zichtbaar is.
- Een meekijker is **geen** teamlid: hij krijgt niets van wat het team verder deelt.
- `/observe/programmes/:id` met de drie overzichten, opent op de `startView` van de commissie. Het
  hergebruikt `learningLineOverview`, `coverageMatrix`, `checkAlignment` en de leesweergave van
  een gedeelde cursus.
- **RED:** repository (een meekijker leest alleen die opleiding; een cursus die niet meer gedeeld
  is verdwijnt; een gewone docent kan niemand uitnodigen), loadertests (de startweergave komt uit
  de data, niet per commissie), axe.

### 32.7 — Adviezen van meekijkers (migratie)

- `view_advice`: `id`, `grant_id`, `subject_kind`, `subject_id`, `author_user_id`,
  `course_id` en `item_id` (leeg = het hele item), `message`, `suggestion`, `decision`,
  `reason`, `decided_by`, `decided_at`, `created_at`, `updated_at`. Het antwoord staat op de rij
  zelf: één advies, één antwoord. Tekst begrensd zoals `AGENT_LIMITS`. De server controleert dat
  `course_id` en `item_id` nu bestaan, net als het filter van de AI-reviewer.
- Alleen een meekijker **met account** en een geldige uitnodiging schrijft adviezen, en wijzigt of
  verwijdert ze tot er een antwoord is.
- Antwoorden (Akkoord / Niet akkoord, optionele reden): bij een cursus de eigenaar,
  mede-eigenaars en bewerkers; bij een rubric of werk de eigenaar; bij een opleiding de
  teamleider of een beheerder (keuze 1). De meekijker ziet het antwoord en de reden (keuze 2).
- Op de pagina van het item staan de adviezen onder een eigen kop **Meekijkers**, met naam en
  (als die er is) commissie, naast het paneel Reviewteam. Zo is altijd duidelijk wat van een mens
  komt en wat van een AI-reviewer.
- Na intrekken of verlopen blijven de adviezen staan bij het item; de meekijker ziet ze niet meer.
- **RED:** repository (alleen een geldige meekijker schrijft; een advies op een cursus buiten de
  opleiding wordt geweigerd; na een antwoord niet meer te wijzigen; wie mag antwoorden per soort
  komt uit data), componenttest met axe.

### 32.8 — Help, wiki en afronding (geen migratie)

- Helponderwerp `viewing` ("Iemand laten meekijken"), met de twee manieren, verlopen en intrekken,
  en per commissie een stuk dat de test uit *Commissies als data* afdwingt; een alinea in `courses`,
  `programmes` en `teams`.
- Wiki: `Authentication.md` (een sectie naast *Sharing with your team*, met de leeslink en zijn
  grenzen), `Architecture.md` (het doel `programme` en meekijken als feature-module).
- `docs/implementation/README.md`: deze brief wordt geschiedenis.

---

## Volgorde

```
Spoor A:  32.1 ──▶ 32.2 ──▶ 32.3
Spoor B:  32.4 ──▶ 32.5
            └────▶ 32.6 ──▶ 32.7 ──▶ 32.8
```

- Twee werkers tegelijk (de WIP-limiet): spoor A en spoor B beginnen samen met 32.1 en 32.4.
- 32.5 (leeslink) en 32.6 (commissies) hangen allebei alleen van 32.4 af; 32.6 toont de AI-review
  als 32.2 er is, en anders nog niet.
- Migraties: 32.2, 32.4 en 32.7. Ze botsen alleen in de drizzle-journal; wie als tweede `main`
  binnenhaalt, genereert zijn migratie opnieuw. De schema's staan in eigen bestanden.
- **Schatting:** acht PR's, twee à drie werkdagen in het tempo van nu, plus de evals van 32.1 (een
  paar euro) en Bastiaans merges.
- **Kleinste nuttige stappen:** 32.4 alleen (een docent laat een collega meekijken), of spoor A
  alleen (een AI-examencommissie voor het team). Elk is op zichzelf bruikbaar.

## Buiten deze fase

- Een uitnodiging per e-mail met een inlogcode (keuze 8).
- Meldingen als er een advies of antwoord is.
- Gekoppeld werk (toetsvragen) bij een cursus voor een meekijker (keuze 3).
- Een commissie die naar iets anders kijkt dan een opleiding (BDB/BKE-team).
- Meeschrijven: dat kan al met de bewerkersrol van #243, voor wie een team deelt met de eigenaar.

## Keuzes voor Bastiaan

| # | Vraag | Advies |
| --- | --- | --- |
| 1 | Wie antwoordt op adviezen over een **opleiding** (van de AI-reviewer en van meekijkers)? | **De teamleider of een beheerder.** Elk teamlid mag de AI-reviewer laten draaien en alles lezen. |
| 2 | Ziet een meekijker het antwoord op zijn advies? | **Ja,** met de reden. Anders weet hij niet wat ermee gebeurd is. |
| 3 | Ziet een meekijker bij een cursus ook het gekoppelde werk, zoals toetsvragen? | **Nee in deze fase.** Wil de docent werk laten zien, dan nodigt hij uit voor dat werk zelf. |
| 4 | Ziet een meekijker de reviews van het reviewteam bij een cursus? | **Nee.** Die zijn voor de docent. Bij een opleiding wel de review van de opleiding. |
| 5 | Mag een meekijker met account een kopie maken? | **Nee.** Meekijken is lezen en adviseren; kopiëren blijft voor het team (P28.4). |
| 6 | Mag een hele opleiding ook via een leeslink? | **Nee.** Een opleiding bevat werk van meer docenten; alleen een persoon met account, door de teamleider gekozen. |
| 7 | Staan leeslinks standaard aan? | **Nee, de beheerder zet ze aan.** Een link kan doorgestuurd worden; de instelling kiest zelf of dat mag. Meekijken met een account staat wel standaard aan. |
| 8 | Willen we later "alleen die persoon" ook zonder account, via een e-mail met een inlogcode? | **Later, als de pilot erom vraagt.** Het vraagt een maildienst (een nieuwe afhankelijkheid en mogelijk kosten) en een privacytoets. |
| 9 | Mag een meekijker met een docentaccount ook de tools gebruiken? | **Ja, het is een gewoon docentaccount.** Wil je dat niet, zet hem dan in een eigen team met tools uit (P28.3). Een nieuwe rol is niet nodig. |
| 10 | De AI-reviewer en de echte commissie heten allebei "Examencommissie". Verwarrend? | **Laat het zo.** De AI staat onder *Reviewteam* als reviewer; mensen staan onder *Meekijkers* met hun naam. |
