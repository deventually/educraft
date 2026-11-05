# Fase 28 — Teams, delen en efficiënt gebruikersbeheer

> **Status:** 🟡 28.1–28.3 gemerged (#91, #93, #96), 28.4 PR open, 28.5 bezig. Rolagenten gaan
> alleen voor de hele instelling aan of uit, niet per team (BESLUIT-2026-11-05-11). **Hing af van** P27.2 (#88, de BDB/BKE-schakelaar per
> docent), en 28.1 t/m 28.3 komen **vóór P27.3**. Zo voer je deze brief uit: één deelstap per
> sessie, elke deelstap één PR vanaf `main`, test-first volgens `AGENTS.md` / de `/tdd`-skill, poort
> `npm test && npm run typecheck && npm run check`. Merge nooit zelf; alleen Bastiaan merget. Keuzes
> van Bastiaan: BESLUIT-2026-11-05-5.

## In gewone taal

Beheer is nu één lange pagina: per docent zes knoppen, de modellen in een apart blok eronder, geen
zoekveld en alles één voor één. En collega's kunnen niets met elkaar delen.

P28 regelt drie dingen:

1. **Gebruikersbeheer in een paar klikken.** Eén lijst met zoeken en filteren, per persoon één pagina
   met alles van die persoon, één knop "Toevoegen", en acties voor meerdere mensen tegelijk.
2. **Teams van collega's.** Een beheerder maakt een team en wijst een teamleider aan. De teamleider
   voegt collega's toe en kan een andere docent in het team ook teamleider maken.
3. **Per team aan en uit.** Een team zet de grote onderdelen (zoals BDB/BKE), de tools en de modellen
   aan of uit. Voor één docent kan de beheerder een uitzondering maken.

En: **alles blijft privé tot een docent zelf iets deelt.** Een cursus, rubric of onderwijscontext kun
je delen met je team; collega's kunnen hem bekijken en een eigen kopie maken. Het BDB/BKE-dossier en
alles met studentwerk zijn nooit deelbaar.

Het denkwerk staat in het document "Teams, privacy en gebruikersbeheer (voorstel P28)" (Claude Doc in
het project, 5 november 2026).

## Vaste besluiten (BESLUIT-2026-11-05-5)

1. **Privé tenzij gedeeld.** Lid worden van een team deelt niets. Delen is een klik van de eigenaar,
   per stuk, met één team. Teamleden **bekijken en kopiëren**; alleen de eigenaar bewerkt. Stoppen
   met delen kan altijd; een gemaakte kopie blijft van de collega.
2. **Deelbaar:** cursus, rubric, onderwijscontext. **Nooit deelbaar:** het BDB/BKE-dossier,
   ingevulde rubrics (`rubric_scores`), chats, en werk van een tool die studentwerk verwerkt.
   Gemaakt werk is alleen zichtbaar via een gedeelde cursus, en alleen van tools zonder studentwerk.
3. **Een docent mag in meer teams.** Per onderdeel geldt één regel (hieronder); "aan" in één team is
   genoeg.
4. **Wie beheert teams:** beheerders (alle teams) en teamleiders (hun eigen team). Een teamleider kan
   leden toevoegen en weghalen, een lid teamleider maken, uitnodigen in zijn team, en de onderdelen,
   tools en modellen van zijn team aan- en uitzetten. Een teamleider kan **niet**: rollen,
   wachtwoorden, e-mail, non-actief of verwijderen, uitzonderingen per docent, en geen inhoud van
   anderen zien. Teamleider is een stand **per team**, geen nieuwe rol: `users.role` blijft
   `teacher | admin`.
5. **Versie 1 schakelt:** de vier grote onderdelen (BDB/BKE, Cursussen, Rolagenten, Hulpmiddelen),
   **de tools** en **de modellen**, per team.
6. **De beheerder ziet geen inhoud.** Wel wie in welk team zit en wat er aanstaat.
7. **Bouw voort op P27.2.** De BDB/BKE-schakelaar per docent uit P27.2 (#88,
   `portfolioEnabled:<userId>`, `portfolioAccess`) wordt de uitzondering per docent in de regel
   hieronder; hij wordt niet opnieuw gebouwd. 28.1 t/m 28.3 komen vóór P27.3, zodat het menu van
   P27.3 meteen `effectiveFeatures` gebruikt.
8. **Privacy:** delen van lesmateriaal tussen collega's is laag risico en studentdata kan niet mee;
   Bastiaan gaf akkoord zonder extra toets door de privacy-officer.

## De regel voor aan en uit

Elk onderdeel en elke tool heeft drie lagen.

1. **Instelling** (beheerder): *Uit* (niemand), *Aan* (standaard aan, een team kan uitzetten) of
   *Op verzoek* (standaard uit, een team kan aanzetten).
2. **Team** (beheerder of teamleider): *aan*, *uit* of *geen keuze*.
3. **Docent** (alleen beheerder): een uitzondering *aan* of *uit*, of geen.

```
effectief = instelling is Uit             → uit
          | docent heeft een uitzondering → die uitzondering
          | een van zijn teams zegt aan   → aan
          | een van zijn teams zegt uit   → uit
          | anders                        → standaard van de instelling
```

**Modellen** volgen dezelfde lagen als sets: eigen set van de docent (zoals nu, P18) → de
vereniging van de sets van zijn teams die een set hebben → de instelling. Altijd binnen wat de
instelling toestaat; de bestaande lockout-terugval blijft.

| Onderdeel | Standaard instelling |
| --- | --- |
| BDB/BKE-werkplaats (`portfolio`) | Op verzoek |
| Cursussen (`courses`) | Aan |
| Rolagenten (`roleAgents`) | Aan |
| Hulpmiddelen (`utilities`) | Aan |
| Elke tool | Aan, of Uit als hij nu in `tool_settings` uit staat |

Wat P27.2 al vastlegde, blijft: **een beheerder heeft BDB/BKE altijd**, en een docent zonder
keuze die al een dossier heeft, houdt toegang (de overgang). Uitzetten wist nooit iets. Uit betekent server-side een 404 (pagina's, export, acties) of een
weigering in de stream, zoals de toolbeschikbaarheid nu; de UI verbergt alleen als extra.

## Deelstappen

### 28.1 — De gebruikerslijst en de persoonspagina

Geen migratie.

- **Lijst** (`/admin/users`, de landing blijft, P27 besluit 2): één rij per persoon met naam, e-mail,
  status (*Actief*, *Uitgenodigd*, *Non-actief*) en *laatst actief* (de laatste dag uit `usage`;
  nooit gebruikt = "nog niet"). Openstaande uitnodigingen staan als rij met status *Uitgenodigd* en de
  knoppen kopiëren en intrekken; de aparte uitnodigingentabel verdwijnt.
- **Zoeken en filteren** via een `<form method="get">` (naam/e-mail, rol, status); de loader filtert
  server-side, met de lijstlimiet `Math.min(limit ?? 50, 500)`.
- **Persoonspagina** `/admin/users/:id` (nieuwe route in `app/routing/admin.ts`): Account (naam,
  e-mail, rol), Modellen, Toegang (resetlink, wachtwoord, non-actief), Verwijderen apart onderaan.
  Alles met `AutoSaveForm` en een toast. Teams en Features volgen in 28.2 en 28.3.
- De zes knoppen per rij en het blok "Modellen per docent" verdwijnen van de lijst. De `intent`-acties
  verhuizen naar de persoonspagina; de autorisatie blijft exact zoals nu (`mayManage`,
  `ownerOnly`, niet op jezelf).
- **Eén knop "Toevoegen"** opent één formulier: uitnodigingslink of (alleen de superbeheerder) direct
  een account met wachtwoord, zoals P18.7.
- **RED:** route-test via `tests/helpers/routes.ts`; component-test lijst (zoeken, filter, status,
  uitnodiging als rij, axe); component-test persoonspagina (secties, axe); actietests dat elke
  bestaande weigering (`selfDelete`, `ownerOnly`, …) op de nieuwe route blijft gelden; een gewone
  beheerder kan de persoonspagina van een beheerder niet beheren.

### 28.2 — Teams en teamleiders

Migratie (`npm run db:generate`).

- **Tabellen:** `teams` (id, name, createdAt), `team_members` (teamId, userId, `isLead` boolean,
  createdAt; uniek op teamId+userId), en een nullable `invites.team_id`.
- **Repository** `app/server/repositories/teams.server.ts`: alles async. Beheerdersfuncties
  (`createTeam`, `renameTeam`, `deleteTeam`, `setMembers`, `setLead`) en teamleiderfuncties die het
  team scopen op de aanroeper: `getTeamForLead(userId, teamId)` geeft `null` als de aanroeper geen
  teamleider van dat team is, en elke schrijffunctie van de teamleider gaat daar doorheen.
  `listTeamsForUser(userId)` voor de eigen teams.
- **Beheer** `/admin/teams`: lijst van teams, per team leden en teamleiders; een team aanmaken,
  hernoemen, opheffen (bevestigen). Opheffen haalt alleen de groep weg; gedeelde stukken worden weer
  privé.
- **Teamleider** in een nieuw route-onderdeel `app/routing/teams.ts`, `/teams/:id` (docentkant, geen
  `/admin`): leden zien (naam, e-mail), een lid toevoegen **op exact e-mailadres** (geen bladeren door
  alle accounts), een lid weghalen, **een lid teamleider maken**, zelf stoppen als teamleider, en een
  uitnodigingslink maken die bij gebruik lid van dit team maakt. Een teamleider haalt geen andere
  teamleider weg en neemt niemand de teamleiderstand af; dat doet een beheerder.
  Uitnodigingen blijven altijd `teacher` (BESLUIT-2026-07-03-2).
- **Persoonspagina** (28.1) krijgt de sectie Teams; **Toevoegen** krijgt een teamkeuze; de lijst
  een filter op team.
- Een account verwijderen haalt ook zijn lidmaatschappen weg (`deleteUserCascade`).
- **RED:** repositorytests (scoping: een teamleider van team A kan niets aan team B; een gewoon lid
  kan niets), actietests (`notLead` → 404), invite met team maakt lid, component- en axe-tests voor
  beide pagina's, `tests/hotspots.test.ts` groen (nieuwe i18n-namespace `teams`).

### 28.3 — Onderdelen, tools en modellen per team

Migratie voor de opslag per team en per docent; de instellingslaag mag in `instance_settings` /
`tool_settings`.

- **Register als data:** `app/lib/features/` met per onderdeel `id`, `{ nl, en }`-naam en
  standaard-instelling; gevalideerd bij opstart. Geen `if (feature === …)` door de code.
- **Eén diepe functie** in `app/server/availability.server.ts`: `effectiveFeatures(user)` en de
  bestaande `getAvailableTools` / `isToolAvailable` / `getSelectableModelIds` rekenen de drie lagen
  uit (de regel hierboven). De `_user`-parameter die er al staat is de naad. Loaders, menu en stream
  vragen alleen deze functies.
- **Opslag:** per team de keuzes voor onderdelen, tools en modellen; per docent de uitzonderingen.
  De vorm kiest de bouwer (een JSON-kolom op `teams` en een kleine tabel voor uitzonderingen ligt het
  meest voor de hand). Wat er al is, blijft en telt mee: `assignedModels:<id>` is de eigen modelset
  van de docent (P18), `portfolioEnabled:<id>` is de uitzondering voor BDB/BKE (P27.2). Verhuis je
  ze naar de nieuwe opslag, dan met een migratie die elke bestaande stand overneemt.
- **Instelling:** `/admin/tools` krijgt per tool de drie standen *Uit / Aan / Op verzoek*; een nieuwe
  sectie op dezelfde pagina doet hetzelfde voor de vier onderdelen.
- **Team:** op `/admin/teams` en `/teams/:id` (teamleider) per onderdeel en per tool *aan / uit /
  geen keuze*, en een eigen modelset of "volgt de instelling". Alleen wat de instelling niet op *Uit*
  heeft staan, is zichtbaar.
- **Docent:** de persoonspagina krijgt de sectie Features, met per onderdeel en tool de effectieve
  stand en **waar die vandaan komt** ("via team X", "uitzondering", "instelling"), en de knop voor een
  uitzondering (alleen beheerder).
- **BDB/BKE:** `portfolioAccess(user)` (P27.2) blijft het ene toegangspunt voor de werkplaats, maar
  vraagt voortaan `effectiveFeatures`: beheerder altijd aan, dan de regel, met als laatste stap de
  overgang (geen keuze en wel een dossier → aan). De schakelaar per docent die P27.2 op de
  gebruikerslijst zette, verhuist naar de sectie Features van de persoonspagina (28.1/28.3); de
  bestaande tests in `tests/api/portfolio-access.test.ts` blijven groen.
- **RED:** pure tests van de regel (alle combinaties, ook twee teams met aan/uit), tests dat de
  tool-404 en de stream-weigering de teamlaag volgen, portfolio-toegang via een team (team aan → aan,
  docent-uitzondering uit wint, beheerder altijd aan, overgang met dossier blijft), teamleider kan niets aanzetten wat de instelling op *Uit* heeft,
  componenttests met axe.

### 28.4 — Delen met het team

Migratie.

- **Tabel `shares`:** id, ownerUserId, kind (`course | rubric | contextProfile`), itemId, teamId,
  createdAt; uniek op kind+itemId+teamId. Eén tabel voor alle soorten.
- **Repository-regel uitbreiden** (aanpassing in `AGENTS.md`, akkoord via dit besluit): **lezen** mag
  als je eigenaar bent, óf als het stuk gedeeld is met een team waar je lid van bent, beide in de
  WHERE-clausule. **Schrijven, koppelen en verwijderen** blijven alleen voor de eigenaar.
  `linkGeneration` blijft weigeren voor een gedeelde cursus van een ander.
- **Tooleigenschap** `Tool.handlesStudentWork?: true` voor tools die studentwerk verwerken
  (`registry/validate.ts` controleert dat het een boolean is). Een test legt vast welke tools dat
  zijn; minimaal Studentwerk beoordelen, Wiskunde nakijken, Toetsanalyse en de forum-nakijker. Werk
  van zo'n tool komt nooit in een gedeelde weergave, ook niet als het aan een gedeelde cursus hangt.
- **UI:** bij een cursus, rubric en onderwijscontext een knop "Delen met team" (kies team, stoppen
  met delen). Een sectie *Van mijn team* op de lijstpagina's, met de naam van de eigenaar, alleen
  lezen, en "Maak een kopie" (de kopie heeft geen koppelingen en geen deelstand).
- Een lid dat het team verlaat, ziet de gedeelde stukken niet meer, en zijn eigen deelstanden voor
  dat team vervallen.
- **RED:** repositorytests (niet-lid ziet niets, lid kan niet schrijven, kopie is van de kopieerder),
  een test dat werk van een `handlesStudentWork`-tool nooit in de gedeelde cursus staat, dossier en
  scores hebben geen deelknop, component- en axe-tests.

### 28.5 — Meerdere mensen tegelijk

Geen migratie.

- **Lijst plakken** (in "Toevoegen"): per regel naam en e-mail, team kiezen; Zod valideert elke regel;
  uitkomst een tabel met per persoon de uitnodigingslink (kopieerknop) of de reden van weigering.
  Er komt geen e-mailservice.
- **Vinkjes** in de gebruikerslijst met: toevoegen aan team, uit team halen, non-actief, weer actief.
  **Verwijderen gaat niet in bulk.** De server controleert de autorisatie per persoon en meldt wat
  geweigerd is.
- **RED:** parser-tests (lege regels, dubbele e-mail, ongeldig adres), actietests per persoon
  (een gewone beheerder kan geen beheerder non-actief zetten), axe.

## Volgorde

P27.2 (#88) → 28.1 → 28.2 → 28.3, dan P27.3 (die `effectiveFeatures` gebruikt), dan 28.4 en 28.5. 28.4 en 28.5
kunnen naast elkaar. Hooguit twee werkers tegelijk (WIP-limiet).

## Buiten bereik

- Samen bewerken van een gedeelde cursus (eerst kijken of teams het missen).
- Een cursus overdragen aan een collega vóór het verwijderen van een account.
- Gebruik per team in `/admin/usage`.
- Team-eigen stukken (een onderwijscontext van het team in plaats van van een persoon).
- E-mail versturen vanuit de app.

## Acceptatie

`npm test && npm run typecheck && npm run check` groen na elke deelstap. Handmatig nalopen:

1. Een beheerder zoekt een docent op naam, opent de persoonspagina en ziet daar alles van die
   persoon, inclusief modellen.
2. Hij maakt team "Verpleegkunde", maakt docent A teamleider. A voegt B toe op e-mail en maakt B ook
   teamleider. A kan B die stand niet afnemen; de beheerder wel.
3. De instelling zet Wiskunde nakijken op *Op verzoek*. Alleen leden van een team dat hem aanzet,
   zien hem; een ander krijgt een 404 op de toolpagina.
4. BDB/BKE staat op *Op verzoek*; het team zet hem aan, en een lid ziet BDB/BKE. De beheerder zet
   voor één lid een uitzondering *uit*; die ziet hem niet meer, en zijn dossier is er nog als hij weer
   aan gaat.
5. Docent A deelt een cursus met het team. B ziet hem onder *Van mijn team*, kan hem niet bewerken en
   maakt een kopie. Werk van Studentwerk beoordelen dat aan de cursus hangt, ziet B niet.
6. A stopt met delen; B ziet de cursus niet meer, maar zijn kopie blijft.
7. Een beheerder plakt vijf regels en krijgt vijf uitnodigingslinks; wie er een gebruikt, zit in het
   gekozen team.
