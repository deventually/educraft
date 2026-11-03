# Fase 17 — Vereenvoudiging V1: de studentenlaag eruit

> **Zo voer je deze brief uit:** open hem in een verse sessie en voer **één** deelfase uit per
> sessie, test-first volgens `AGENTS.md` / de `/tdd`-skill. Elke deelfase is **één PR met één doel**
> (17.1 → 17.2 → 17.3, in die volgorde). Schrijf eerst de RED-tests die bij de deelfase staan, zie
> ze falen om de goede reden, en maak ze dan groen. Poort per PR: `npm test && npm run typecheck &&
> npm run check`. Branch vanaf `main`. Merge nooit zelf; alleen Bastiaan merget. **Hangt af van:**
> niets; het ruimt P6, P7, het cohortdeel van P13 en P14 op.

## Context en doel

LimeOnIt wordt eerst een **assistent voor docenten** (BESLUIT-2026-11-02-1). De studentenlaag uit
P6/P7/P13/P14 (studentrol, cohorten, studentuitnodigingen, mentorinzicht, verwijderverzoek,
vergrendelde modus, één actieve sessie) wordt in de pilot niet gebruikt. Ze maakt elke wijziging
duurder: elke loader, de stream en elke modelpoort hebben een studenttak. Bastiaan heeft besloten dat
de laag eruit gaat (BESLUIT-2026-11-03-3) en dat er geen studentdata bewaard hoeft te worden. De
studenttutors blijven, als tools waarmee docenten zelf leren (BESLUIT-2026-11-03-4).

**Doel:** na P17 kent de app twee rollen, `teacher` en `admin`. Alle 15 tools blijven, en de zes
tutors zijn gewone docenttools. Er is geen cohortcode, geen inzichtcode en geen studentpad meer in
de engine. De studentdata is weg (aanbevolen optie) of blijft onaangeroerd liggen (alternatief,
onderaan).

## Vaste besluiten

1. **Twee rollen:** `Role = "teacher" | "admin"`. De string `"student"` blijft alleen bestaan als
   **tooldata** (`Tool.userType: "instructor" | "student"`). Die zegt tot wie de tool spreekt, niet
   wie hem mag gebruiken. Hij stuurt de niveau-instructie (`audience: "learner"` in `api.stream.tsx`)
   en de groepering op de startpagina. Die blijven ongewijzigd; namen en labels zijn V3.
2. **Elke ingelogde docent of beheerder ziet alle 15 tools**, behalve als de instelling een tool
   uitzet of een beheerder de tools van een docent beperkt (`allowedToolSlugs`). Die twee poorten
   blijven precies zoals ze zijn.
3. **Modellen:** het niveau van de instelling (`enabledModels`) en het niveau per docent
   (`assignedModels:<userId>`) blijven precies zoals ze zijn (doorsnede). Alleen het cohortniveau
   verdwijnt. Het herontwerp naar een overrule per docent (BESLUIT-2026-11-03-7) is **V2 en valt
   buiten P17**.
4. **Account verwijderen:** iedereen (docent en beheerder) verwijdert op `/account` direct en
   definitief, met de bestaande bevestiging door een woord te typen. Het verwijderverzoek en
   `disabledAt` verdwijnen. `disabledAt` wordt nergens anders gebruikt (gecontroleerd met grep:
   alleen `requestAccountDeletion`, `reactivateUser`, `getUser` en `login.tsx`).
5. **Eén actieve sessie gaat helemaal weg** (`sessionVersion`), zoals de opdracht zegt. Zie
   *Risico's* punt 2 voor wat docenten daarmee verliezen.
6. **Uitnodigingen:** een beheerder nodigt docenten uit zoals nu (`/admin/invites`,
   `npm run invite`). Studentuitnodigingen, cohortkoppeling en uitnodigingen gebonden aan een
   e-mailadres (alleen gebruikt voor studenten) verdwijnen.
7. **Data (aanbevolen, wacht op Bastiaan):** één Drizzle-migratie verwijdert definitief alle
   studentaccounts met hun data en verwijdert de cohort- en inzichttabellen en de studentkolommen.
   Docent- en beheerdersdata blijft onaangeroerd. Kiest Bastiaan voor laten staan, volg dan het
   alternatief onderaan. 17.1 en 17.2 zijn in beide gevallen hetzelfde.
8. **Schema pas in 17.3.** In 17.1 en 17.2 blijft `app/server/schema.server.ts` ongewijzigd en komt
   er geen migratie. Code houdt op de kolommen en tabellen te lezen of te schrijven. Waar een rijtype
   (`UserRow`, `InviteRow`) een veld nog eist, vul je het neutraal (`null`, `0`). Zo is 17.3 het enige
   PR dat de database aanraakt.

## Wat blijft (niet aanraken)

- De 15 tools, hun prompts en `userType`. De startpagina met het filter "Voor studenten" en de
  badges op de tutors blijft (V3 kijkt naar namen en labels).
- Per docent: tool-allowlist (`users.allowed_tool_slugs`), modelniveau (`assignedModels:`) en
  contextoverrule (P12). "Bekijk als docent" (`roleView.server.ts`, `set-view`) blijft; het
  verdwijnt in V2.
- Docentuitnodigingen, wachtwoordreset via link, rolwijziging door de beheerder en hard verwijderen
  door de beheerder (`deleteUserCascade`).
- `chat_sessions` en `messages`: de tabellen blijven met hun docentrijen (docentdata blijft
  onaangeroerd). Er wordt alleen niet meer in geschreven (17.1). Het transcript van een chat staat
  al in `generations` (`upsertChatGeneration`). Opruimen kan later, samen met de slapende tabel
  `projects`.
- `buildChatTranscript` (`app/lib/chat/transcript.ts`) blijft; `api.stream` gebruikt hem.

---

## 17.1 — Mentorinzicht eruit (PR 1)

**Doel:** geen sessiesamenvattingen, geen knop "Sessie beëindigen", geen inzichtpagina en geen
dubbele opslag van chatbeurten meer.

**Model:** Sonnet, gemiddeld. **Voorstel voor de branch:** `p17-1-remove-mentor-insight`.

### Weg

| Wat | Bestand / symbool |
| --- | --- |
| Inzichtpagina | `app/routes/cohorts.$id.insight.tsx` + `route("cohorts/:id/insight", …)` in `app/routes.ts` |
| Sessie sluiten | `app/routes/api.session-close.tsx` + `route("api/session-close", …)` in `app/routes.ts` |
| Inzicht-repo | `app/server/repositories/insight.server.ts` (geheel) |
| Sweep | `app/server/insight/sweep.server.ts` (map weg), `scripts/sweep-summaries.ts`, `package.json` → script `sweep` |
| Samenvatter | `app/lib/insight/summarise.ts`, `app/lib/insight/summary.ts` (map weg) |
| Prompt | `app/lib/prompts/session-summary.prompt.ts`, `app/lib/prompts/files/session-summary.{nl,en}.md`, import + `ALL`-item `SESSION_SUMMARY_PROMPT` in `app/lib/prompts/index.ts` |
| Eval | `scripts/eval-session-summary.ts`, `package.json` → script `eval:summary`, `evals/session-summary/` |
| Zelfrapportage | `app/components/SessionHelpfulness.tsx` |
| ChatView | in `app/components/ChatView.tsx`: state `ending`, `closeSession`, `handleEndSession`, de knop `t.chat.endSession` en `<SessionHelpfulness>` |
| Chatbeurt-opslag | `app/server/repositories/chat.server.ts` (geheel: `recordChatTurn`, `getChatSession`, `getSessionMessages`) + de aanroep `recordChatTurn(...)` en de import in `app/routes/api.stream.tsx` |
| Link naar inzicht | de `insightCta`-link op `app/routes/cohorts.$id.tsx` (de pagina zelf gaat in 17.2) |
| i18n (nl + en) | `chat.endSession`, `chat.endSessionHint`, de hele namespace `helpfulness`, de hele namespace `insight`, `cohorts.insightCta` |

`deleteUserCascade` blijft in 17.1 `chat_sessions`, `messages` en `session_summaries` opruimen: de
tabellen bestaan nog (besluit 8).

### Tests

- **RED, nieuw:** `tests/p17-removed.test.ts` (node). Lees bestanden met `node:fs`, zonder routes
  te importeren:
  - `it("routes.ts registers no api/session-close and no cohort insight page")`: de tekst van
    `app/routes.ts` bevat geen `api/session-close` en geen `/insight`.
  - `it("the mentor-insight modules are gone")`: `existsSync` is `false` voor
    `app/routes/api.session-close.tsx`, `app/routes/cohorts.$id.insight.tsx`,
    `app/server/repositories/insight.server.ts`, `app/server/insight`, `app/lib/insight`,
    `app/server/repositories/chat.server.ts` en `app/components/SessionHelpfulness.tsx`.
  - `it("the session-summary prompt is not registered")`: `PROMPTS["session-summary@v1"]` is
    `undefined`.
  - `it("package.json has no sweep or eval:summary script")`.
  - `it("the i18n catalogues have no insight or helpfulness namespace")`: `"insight" in nl` en
    `"helpfulness" in nl` zijn `false`; hetzelfde voor `en`.
- **RED, gewijzigd:**
  - `tests/components/ChatView.test.tsx`: een nieuw geval
    `it("offers no end-session control after a completed turn")`. Na één beurt is er geen knop met
    de naam `End session` / `Sessie beëindigen`. Houd de axe-check.
  - `tests/api/stream.test.ts`: in `"chat completion with a valid sessionId upserts one row with
    the rebuilt transcript"` vervalt de verwachting op `recordChatTurnSpy`. Haal de `vi.mock` van
    `~/server/repositories/chat.server` en de spy weg. Het geval controleert nu alleen
    `upsertChatSpy` (één keer) en `saveGenerationSpy` (niet).
- **Verwijderen:** `tests/api/insight-repo.test.ts`, `tests/api/insight-route.test.ts`,
  `tests/api/insight-sweep.test.ts`, `tests/components/insight.test.tsx`,
  `tests/components/session-helpfulness.test.tsx`, `tests/lib/summary-parse.test.ts`.
- **Aanpassen:** `tests/api/delete-account.test.ts`, geval met de chatcascade. Zet de
  `chat_sessions`- en `messages`-rijen klaar met `getDb().insert(chatSessions)` /
  `insert(messages)` (uit `~/server/schema.server`) in plaats van `chat.recordChatTurn`. Laat het
  klaarzetten met `insight.saveSummary` vallen. Blijf controleren dat beide tabellen na
  `deleteUserCascade` leeg zijn voor die gebruiker.

### Docs (zelfde PR)

- `wiki/Mentor-Insight.md` verwijderen. Links eruit in `wiki/Home.md` (regel "Mentor Insight" in de
  tabel en "privacy-safe mentor insight" in de samenvatting) en `wiki/Architecture.md` (de
  linkregel onderaan).
- `wiki/Compliance.md`: de bullet "Privacy-safe mentor insight" en de alinea over de sweep eruit.
  Zet "de-personalised session summaries" uit de opsomming van `deleteUserCascade` eruit.
- `AGENTS.md`: de bullet **Mentor insight (P7)** onder *Access & Availability* eruit.
- `docs/fabriek/STATUS.md` en de P17-rij in `docs/implementation/README.md` bijwerken.

### Klaar als

- [ ] De RED-tests faalden eerst en zijn nu groen; de poort is groen.
- [ ] `grep -rn "insight\|session-close\|SessionHelpfulness\|recordChatTurn\|session-summary" app scripts`
      geeft niets meer, op i18n-sleutels van andere betekenis na.
- [ ] Een chat met een tutor werkt, wordt opgeslagen in Projecten, en toont geen knop "Sessie
      beëindigen".
- [ ] De PR-beschrijving noemt onder *Wat Bastiaan moet beslissen*: de wijziging in `AGENTS.md`.

---

## 17.2 — De studentrol en cohorten eruit (PR 2)

**Doel:** de app kent alleen `teacher` en `admin`. Er zijn geen cohorten, geen
studentuitnodigingen, geen vergrendelde modus, geen verwijderverzoek, geen sessieversie en geen
cohortlaag in de modelpoort. Het schema blijft ongewijzigd (besluit 8).

**Model:** Sonnet, gemiddeld. De PR is groot maar mechanisch: vooral weghalen. Ga naar Sonnet hoog
als een cluster tests om onduidelijke reden faalt. **Voorstel voor de branch:**
`p17-2-remove-student-role-cohorts`.

### Rollen en toegang

- `app/lib/registry/access.ts`: `Role = "teacher" | "admin"`. Voeg toe:
  `export const ROLES = ["teacher", "admin"] as const` en `isRole(x: unknown): x is Role`. Verwijder
  `canUseTool` en het type `Audience`. Voor een niet-student is `canUseTool` altijd `true`, dus de
  functie heeft geen werk meer.
- `app/server/availability.server.ts`:
  - `AvailabilityContext.studentAllowlist`, de import van `getAllowedToolSlugs`/`getAllowedModelIds`
    en de `canUseTool`-aanroep in `passes()` eruit. `passes()` = boot-geldig ∧ ingeschakeld
    (`setting?.enabled ?? tool.enabled`) ∧ docent-allowlist.
  - `audienceOverride` wordt niet meer gelezen. Het commentaar bovenaan noemt twee poorten plus
    boot-geldigheid.
  - `userModelRestriction()` en `isModelSelectableForUser()`: de studenttak eruit (alleen de
    docenttak blijft). Commentaren over "per-cohort" / "cohort set" herschrijven naar twee niveaus.
- `app/server/auth.server.ts`:
  - `getUser()`: de controle op `row.disabledAt` en de controle op `sessionVersion` eruit. Nieuw:
    `if (!isRole(row.role)) return null;`. Een overgebleven studentrij (vóór 17.3, of blijvend in
    het alternatief) telt dan als uitgelogd.
  - `createUserSession()`: geen `bumpSessionVersion` meer; de cookie draagt alleen `userId`.
- `app/server/session.server.ts`: `sessionVersion` uit het cookietype en uit het commentaar. Oude
  cookies met dat veld blijven werken, want het veld wordt genegeerd.
- `app/routes/login.tsx`: de tak met `row.disabledAt`/`accountDisabled` eruit. Nieuw: een rij met
  een rol waarvoor `!isRole(row.role)` geldt, krijgt de generieke `m.auth.loginFailed` (geen
  opsomming van accounts).
- `app/routes/reset.$token.tsx`: alleen het commentaar over `sessionVersion` aanpassen.
- `app/server/repositories/users.server.ts`: `requestAccountDeletion`, `reactivateUser`,
  `bumpSessionVersion` en `createInvitesForCohort` eruit. Uit `CreateInviteInput` gaan `cohortId` en
  `email`. `createInvite`/`createUser` vullen de schemavelden met `null`/`0` (besluit 8). Uit
  `consumeInvite` gaat de e-mailbinding, en ook de parameter `submittedEmail`. Uit
  `listInvitesWithContext` gaan de `leftJoin(cohorts)` en de velden `cohortId`/`cohortName`/`email`.
  **`deleteUserCascade` blijft in 17.2 ongewijzigd**: de tabellen bestaan nog.
- `app/server/repositories/profiles.server.ts`: `getProfileForMember` eruit (de enige toegestane
  omzeiling van owner-scoping verdwijnt), plus de import van `getCohortForUser`.

### Cohorten

- Weg: `app/server/repositories/cohorts.server.ts` (geheel), `app/routes/cohorts._index.tsx`,
  `app/routes/cohorts.$id.tsx`, `app/routes/admin.cohorts.tsx`, plus de drie `route(...)`-regels
  (`cohorts`, `cohorts/:id`, `admin/cohorts`) in `app/routes.ts`.
- `app/routes/api.stream.tsx`: `getCohortForUser`/`isCohortActive`/`cohortConfig`/
  `getProfileForMember` en het hele `if (cohort) {…}`-blok eruit (cohortprofiel, EQF-cohort,
  ingevulde sandboxwaarden), ook de `cohortInactive`-weigering en `isEqfLevel` als die daarna
  ongebruikt is. Het profiel komt alleen nog uit `getProfile(user.id, body.contextProfileId)`. Pas
  de commentaren aan bij de beschikbaarheidspoort en de modelpoort.
- `app/routes/tool.tsx`: cohort-lookup, de 404 bij een inactief cohort en `lockedValues` eruit (uit
  de loader, de component en de prop naar `ChatView`). Profielen worden altijd geladen.
- Vergrendelde modus: `app/components/ChatView.tsx` → de prop `lockedValues`, `locked`, de regel
  `provisionedFor` en de voorwaarde `!locked` om het instellingenpaneel. De sandbox start altijd
  open (`useState(false)`). `app/lib/hooks/useSandbox.ts` → de optie `lockedValues` en de
  terugwaarde `locked`.
- `app/components/AppShell.tsx`: het navigatie-item `/cohorts` eruit. De voorwaarden
  `role !== "student"` / `isStudent` vervallen, dus "Onderwijscontext" staat er altijd (nav en
  footer).
- `app/routes/context-profiles.tsx`: de 403 voor studenten en het commentaar daarover eruit.
- Beheer:
  - `app/routes/admin.tsx`: het nav-item `cohorts`.
  - `app/routes/admin._index.tsx`: `listAllCohorts`, de stats `students` en `cohorts`, en de kaart
    Cohorten.
  - `app/routes/admin.invites.tsx`: `ROLES` komt uit `access.ts` (alleen teacher/admin). De action
    `role` weigert een onbekende rol (zoals nu, maar dan zonder `student`). De kolom
    Cohort en de hint `cohortLink` eruit. "Ontvanger" toont `note ?? linkOnly`. Een
    rollabel valt bij een onbekende rol terug op de ruwe string (geen crash, geen nieuwe sleutel).
  - `app/routes/admin.tools.tsx`: de doelgroepkeuze (`AUDIENCES`, `audienceLabel`, de kolom met de
    select, `audienceOverride` in loader en action) eruit. Aan/uit blijft, en ook de badge die het
    `userType` van de tool toont.
  - `app/server/repositories/settings.server.ts`: `audienceOverride` uit het patchtype van
    `setToolSetting`; schrijf `null`.
- `app/routes/invite.tsx`:
  - `addMembership`, de e-mailbinding (`boundEmail`, de controle op `emailMismatch`) en de
    vergrendelde e-mail in het formulier eruit.
  - Nieuw in `isRedeemable`: een uitnodiging met `cohortId` of met een rol waarvoor
    `!isRole(role)` geldt, is **ongeldig**. Zo kan een openstaande studentuitnodiging tussen 17.2 en
    17.3 (of blijvend in het alternatief) geen account meer maken.
- `app/routes/account.tsx`: de studenttak in de action (`requestAccountDeletion`) en in de UI
  (`requestHeading/Intro/Button`), plus `roleStudent` in `roleLabel`. Iedereen krijgt het
  bestaande blok om hard te verwijderen.
- `scripts/invite.ts`: `"student"` uit `ROLES` (gebruik `ROLES` uit `access.ts`).

### Commentaar en teksten

- Commentaren die "cohort" noemen in `app/lib/ai/models.ts` (rond regel 287),
  `app/components/GeneratorView.tsx` en `app/components/StageStepper.tsx` herschrijven naar "een
  docent wiens set alleen een lokaal model bevat". Het gedrag van `pickInitialModel` blijft.
- `app/routes/home.tsx`: alleen het commentaar in de loader (geen studenten, geen cohort).
- i18n (nl + en, pariteitstest):
  - **Weg:** `nav.cohorts`, `chat.provisionedFor`, `auth.accountDisabled`, `auth.emailMismatch`,
    `account.roleStudent`, `account.requestHeading`, `account.requestIntro`,
    `account.requestButton`, `admin.console.nav.cohorts`, `admin.overview.stats.students`,
    `admin.overview.stats.cohorts`, `admin.overview.desc.cohorts`, `admin.tools.colAudience`
    (al ongebruikt), `admin.tools.audienceLabel`, `admin.tools.audienceDefault`,
    `admin.tools.audienceBoth`, `admin.invites.colCohort`,
    `admin.invites.cohortLink`, `admin.invites.roleStudent`, de hele namespace `admin.cohorts`, de
    hele namespace `cohorts` en `error.cohortInactive`.
  - **Nieuwe tekst:**
    - `admin.overview.intro`: zonder cohorten.
    - `admin.overview.desc.tools`: "Zet tools aan of uit." / "Turn tools on or off."
    - `admin.tools.intro`: zonder doelgroep.
    - `admin.models.teacherIntro`: zonder "en aan cohorten toewijzen".
    - `admin.invites.deleteUserConfirm`: zonder "Cohorten blijven bestaan".
  - Controleer met grep of er geen andere sleutels met `cohort` of `student` als rol overblijven.
    `home.student`, `badge.student`, `admin.tools.audienceStudent` en
    `admin.tools.audienceInstructor` blijven: ze labelen tooldata (`userType`), geen rol.
- Hulp: in `app/content/help/topics/account.{nl,en}.md` gaan de secties over het
  verwijderverzoek (studenten) en over het beheer van studenten in een cohort eruit. Ook de zin over
  "een tutor die voor jouw cohort is ingesteld" gaat eruit.

### Tests

- **RED, nieuw of gewijzigd:**
  - `tests/lib/access.test.ts` (herschrijven):
    - `it("knows exactly two roles")`: `ROLES` is gelijk aan `["teacher", "admin"]`.
    - `it("isRole rejects the legacy student role")`.
  - `tests/api/auth.test.ts`:
    - `it("treats a legacy student row as logged out")`: een rij met `role: "student"` plus een
      geldige cookie geeft `getUser` → `null`.
    - `it("login refuses a legacy student account with the generic message")`.
    - `it("a second login keeps the first session valid")`: twee keer `createUserSession` voor
      dezelfde gebruiker; beide cookies lossen op naar die gebruiker. Dit test is nu RED, door
      `sessionVersion`.
    - De blokken `disabled account (Phase 14)` en `single active session (Phase 6 anti-sharing)`
      verwijderen.
  - `tests/api/invite-flow.test.ts`:
    - `it("a legacy student invite is invalid")`.
    - `it("a legacy cohort invite is invalid")`.
    - Zet beide klaar met een directe insert in `invites` met `role: "student"` / `cohortId`; ze
      zijn RED.
    - Het blok `invite flow — cohort provisioning (Phase 6)` verwijderen.
  - `tests/p17-removed.test.ts` (uitbreiden):
    - `it("routes.ts registers no cohort routes")`: geen `"cohorts"` in `app/routes.ts`.
    - `it("the cohort modules are gone")`: `cohorts.server.ts`, `cohorts._index.tsx`,
      `cohorts.$id.tsx` en `admin.cohorts.tsx` bestaan niet.
    - `it("the i18n catalogues have no cohorts namespace")`.
  - `tests/components/AppShell.test.tsx`: `it("shows no Cohorten link for a teacher")`.
    Vervangt `"hides the Onderwijscontext link for a signed-in student"`.
  - `tests/components/admin-invites.test.tsx`: `it("offers only teacher and admin in the role select")`.
  - `tests/components/admin-tools.test.tsx`: `it("offers no audience select")`. Pas de mock-rijen aan
    (geen `audienceOverride`) en houd de axe-check.
  - `tests/api/admin-routes.test.ts`: `it("refuses to set the legacy student role")`. Een POST
    `intent=role, role=student` laat de rol ongewijzigd.
- **Dekking verplaatsen, niet verliezen:** de cohortgevallen voor modellen worden gevallen voor de
  docent. Zo blijven de P13/P14-bugfixes bewaakt:
  - `tests/api/stream.test.ts`: `[P13] a cohort's model set …` → verwijderen (de docentvariant
    bestaat al). `[P14] a local/CLI model outside a cohort's set …` → herschrijven als
    `… outside a teacher's assigned set is refused`. `[bugfix] a cohort allowing ONLY a local model
    …` → herschrijven als `a teacher assigned ONLY a local model is served it, never the disabled
    tool default`.
  - `tests/lib/availability.test.ts`: `a student's cohort set narrows a local/CLI id` → de
    docentvariant bestaat al, dus verwijderen. `effectiveDefaultModel substitutes the cohort's local
    model …` → herschrijven voor een docent met `setUserAssignedModels(id, [localId])`.
- **Verwijderen:**
  - In `tests/api/stream.test.ts`: de gevallen `[3]` (student/instructortool), `[11]`, `[12]` en
    `[13]`, plus het blok `api.stream — provisioned student (P6)`.
  - In `tests/lib/availability.test.ts`: `a student sees student tools…`,
    `audienceOverride "both" exposes…`, `a student is narrowed…` en `a student with no cohort…`.
  - In `tests/components/ChatView.test.tsx`: de twee gevallen met `locked` / `no lockedValues`.
  - In `tests/lib/useSandbox.test.tsx`: het geval met `locked`.
  - In `tests/components/Account.test.tsx` en `tests/api/account-route.test.ts`: de
    studentvarianten.
  - In `tests/api/users-repo.test.ts`: `disables + flags…`, `createInvite stores creator, cohort and
    email` (vervangen door creator only) en `createInvitesForCohort…`.
  - In `tests/api/context-profiles-route.test.ts`: het blok
    `students may not create a teaching context`.
  - In `tests/api/index-redirect.test.ts`: `sends a student to /tools`.
  - In `tests/routes/toastWiring.test.tsx`: de twee gevallen voor `admin.cohorts`.
  - In `tests/api/admin-access.test.ts`: `admin.cohorts` uit de lijst. `cookieFor("student")` wordt
    `cookieFor("teacher")`; het geval "rejects a student" vervalt, want het docentgeval bestaat.
  - In `tests/api/delete-account.test.ts`: het geval
    `keeps a teacher's cohorts (orphan-safe)…` blijft. `deleteUserCascade` ruimt die tabellen in
    17.2 nog op; het geval gaat pas in 17.3 weg.
  - In `tests/api/settings-repo.test.ts`: het geval over `audienceOverride`.
  - Hele bestanden: `tests/api/cohorts-repo.test.ts`, `tests/api/cohorts-route.test.ts`,
    `tests/components/admin-cohorts.test.tsx`, `tests/components/cohorts-index.test.tsx` en
    `tests/components/cohorts.test.tsx`.
- **Aanpassen** (een student gebruikt als "willekeurige andere gebruiker"):
  - `tests/api/reset-flow.test.ts`: `role: "teacher"`.
  - `tests/api/admin-routes.test.ts`, regel ~346: gebruik een admin als "geen docent". Regel ~452:
    `role: "teacher"`. Het blok `admin.cohorts action` verwijderen.
  - `tests/lib/roleView.test.ts`: alleen "a teacher stays a teacher".
  - `tests/components/ConfirmDialog.test.tsx`: de titel `"Cohort verwijderen?"` wordt een neutrale
    titel (alleen testdata).
  - `tests/models.test.ts`: alleen het commentaar.

### Docs (zelfde PR)

- `AGENTS.md`, sectie *Access & Availability*:
  - **Roles:** `teacher | admin`. Geen `canUseTool`; de tools volgen uit `getAvailableTools`.
  - **Effective availability:** twee poorten, instelling en docent-allowlist.
  - De bullets **Cohorts & student provisioning (P6)** en **Account disable + student-initiated
    removal (P14)** eruit. In de plaats komt één regel: "Account verwijderen: iedereen verwijdert
    hard op `/account` (P17)".
  - **Model availability:** twee niveaus (instelling ∩ docent). Uit de P14-subbullet gaan de
    verwijzingen naar cohorten en studenten.
- `wiki/Authentication.md`: de rollentabel (zonder `student`) en de sectie "Account disable &
  student-initiated removal (P14)" eruit. Haal ook het stuk over één actieve sessie weg, als dat er
  staat.
- `wiki/Architecture.md` (regels ~47, ~76, ~81), `wiki/Context-Model.md` (regel ~95: "role/cohort")
  en `wiki/Home.md` (de samenvatting "three roles · teacher-provisioned cohorts"):
  bijwerken.
- `wiki/Compliance.md`: geen rol `student`, geen cohortlidmaatschappen in de cascade-opsomming. De
  AVG-zin over studentdata blijft algemeen waar.
- `docs/Tenancy-and-Admin.md`: de rollentabel (regels 15–17).
- `docs/adr/0001-student-provisioning-cohorts-mentor-insight.md`: status →
  "Vervangen door BESLUIT-2026-11-03-3 (P17)". Laat de inhoud verder staan; het is geschiedenis.
- Het bord en de README-rij.

### Klaar als

- [ ] De RED-tests faalden eerst en zijn nu groen; de poort is groen.
- [ ] `grep -rn '"student"' app` geeft alleen nog tooldata (`userType`, `UserType`, `goals.ts`,
      `home.tsx`/`about.tsx`-filter, `api.stream.tsx` audience).
- [ ] `grep -rni "cohort" app` geeft alleen nog `schema.server.ts` en `deleteUserCascade`
      (tot 17.3).
- [ ] Handmatig: een docent ziet 15 tools (of zijn allowlist), zonder menu-item Cohorten. Een
      tutorchat start met het bewerkbare instellingenpaneel. Inloggen op twee apparaten werkt
      tegelijk. `/account` verwijdert direct.
- [ ] Handmatig: een beheerder ziet in `/admin` geen Cohorten, geen studentstatistiek en geen
      doelgroepkeuze bij tools.
- [ ] De PR-beschrijving noemt onder *Wat Bastiaan moet beslissen*: de wijziging in `AGENTS.md` en
      het verlies van "uitloggen na een wachtwoordreset" (Risico 2).

---

## 17.3 — Studentdata en schema opruimen (PR 3, aanbevolen optie)

**Doel:** één migratie die alle studentaccounts en hun data definitief verwijdert, en die de
cohort- en inzichttabellen en de studentkolommen laat vallen. Docent- en beheerdersdata blijft
onaangeroerd.

**Model:** Sonnet, gemiddeld voor het bouwen. Daarna een **PR-review door Opus, hoog**, vóór
Bastiaan merget. Het is een destructieve migratie op de live pilotdatabase. **Voorstel voor de
branch:** `p17-3-drop-student-data`.

**Voorwaarde:** Bastiaan heeft gekozen voor **definitief verwijderen**. Leg dat vast als nieuw
besluit in `docs/fabriek/besluiten.md` in deze PR. Wijzigingen in `besluiten.md` keurt Bastiaan
goed met de merge; noem het in de PR.

### Schema (`app/server/schema.server.ts`)

- Weg (tabellen): `cohorts`, `cohortMemberships`, `cohortTeachers` en `sessionSummaries`, met hun
  rijtypes (`CohortRow`, `CohortMembershipRow`, `CohortTeacherRow`, `SessionSummaryRow`).
- Weg (kolommen):
  - `users`: `sessionVersion`, `disabledAt`, `deletionRequestedAt`. Werk het commentaar bij
    `role` bij naar `"teacher" | "admin"`.
  - `invites`: `cohortId`, `email`.
  - `chatSessions`: `cohortId`.
  - `toolSettings`: `audienceOverride`.
- Haal daarna de neutrale opvulling (`null`/`0`) uit `createUser`/`createInvite`/`setToolSetting`
  weg, en ook de opruimregels voor de verdwenen tabellen in `deleteUserCascade` (cohort-profielref,
  `cohortTeachers`, `cohortMemberships`, `sessionSummaries`). Werk het doc-commentaar van
  `deleteUserCascade` bij.

### Migratie

1. Draai `npm run db:generate`. Drizzle maakt de volgende migratie (`0008_…` als P20 nog niet
   gemerged is, anders `0009_…`) met `DROP TABLE` en `ALTER TABLE … DROP COLUMN`. Controleer de
   gegenereerde SQL: alleen drops, geen tabelherbouw van `users`/`invites`.
2. Zet **bovenaan** dezelfde `.sql` de dataverwijdering, vóór de drops. De `invites`-regel heeft
   `cohort_id` nog nodig. Elke regel eindigt met `--> statement-breakpoint`:

   ```sql
   -- P17 (BESLUIT-2026-11-03-3): permanently remove student accounts and their data.
   DELETE FROM `messages` WHERE `session_id` IN (SELECT `id` FROM `chat_sessions` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student'));
   DELETE FROM `chat_sessions` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');
   DELETE FROM `generations` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');
   DELETE FROM `feedback` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');
   DELETE FROM `usage` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');
   DELETE FROM `context_profiles` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');
   DELETE FROM `projects` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');
   DELETE FROM `password_resets` WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');
   DELETE FROM `instance_settings` WHERE substr(`key`, instr(`key`, ':') + 1) IN (SELECT `id` FROM `users` WHERE `role` = 'student');
   DELETE FROM `invites` WHERE `role` = 'student' OR `cohort_id` IS NOT NULL OR `used_by_user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'student');
   DELETE FROM `users` WHERE `role` = 'student';
   ```

   Daarna volgen de gegenereerde `DROP TABLE`/`DROP COLUMN`-regels. `session_summaries` en
   `cohort_memberships` hoeven niet apart geleegd te worden; ze verdwijnen met de drop.
3. Raak `drizzle/meta/*_snapshot.json` niet met de hand aan; die komt van `db:generate`.

### Tests

- **RED, nieuw:** `tests/api/migration-p17.test.ts` (node). Dit is de enige plek buiten
  `db.server.ts` die better-sqlite3 direct gebruikt; dat mag, want het is testcode.
  - Open een `new Database(":memory:")`. Lees `drizzle/meta/_journal.json` en voer de `.sql` van
    elke entry tot en met tag `0007_heavy_morbius` uit. Splits op `--> statement-breakpoint` en
    gebruik `db.exec`.
  - Zet klaar:
    - een **docent** met een generatie, een contextprofiel, usage, feedback, een
      `chat_sessions`-rij plus `messages`, een `assignedModels:<id>`-sleutel en een open
      docentuitnodiging;
    - een **student** met dezelfde soorten rijen, plus een cohort van de docent, een
      lidmaatschap, een `session_summaries`-rij, een gebruikte studentuitnodiging en een open
      cohortuitnodiging.
  - Voer daarna alle **latere** journal-entries uit. Zoek ze op via de journal, niet via een vast
    nummer, zodat de test ook werkt als P20 eerder landt.
  - Gevallen:
    - `it("removes every student row and nothing of the teacher")`: elke tabel heeft 0 rijen met
      het student-id; de docentrijen zijn er allemaal nog (tel per tabel).
    - `it("drops the cohort and insight tables")`: `sqlite_master` kent `cohorts`,
      `cohort_memberships`, `cohort_teachers` en `session_summaries` niet meer.
    - `it("drops the student-only columns")`: `PRAGMA table_info` mist `users.session_version`,
      `users.disabled_at`, `users.deletion_requested_at`, `invites.cohort_id`, `invites.email`,
      `chat_sessions.cohort_id` en `tool_settings.audience_override`.
    - `it("keeps the open teacher invite redeemable")`: de rij bestaat nog, met `role='teacher'`.
  - RED: zonder nieuwe migratie zijn er geen latere entries en falen alle vier.
- **Aanpassen:**
  - `tests/api/delete-account.test.ts`: het geval `keeps a teacher's cohorts (orphan-safe)…`
    verwijderen.
  - Tests die nog `sessionVersion`, `disabledAt` of `audienceOverride` in een rij-literal zetten:
    weghalen. `npm run typecheck` vindt ze.
- **Verwijderen:** de nu overbodige bestandscontroles hoeven niet weg; `tests/p17-removed.test.ts`
  blijft als bewaking.

### Docs (zelfde PR)

- `wiki/Deployment.md`: een korte sectie **"Back-up vóór een destructieve migratie"** met de stappen
  uit *Risico's* punt 1. Migraties draaien automatisch bij de eerste DB-toegang na een deploy.
- `AGENTS.md`: noem bij *Repositories & the DB seam* geen cohorttabellen. Zoek met grep naar
  resten.
- `docs/fabriek/besluiten.md`: het nieuwe besluit (definitief verwijderen, met datum).
- Het bord en de README-rij: P17 ✅.

### Klaar als

- [ ] De migratietest faalde eerst en is nu groen; de poort is groen.
- [ ] `grep -rni "cohort\|sessionVersion\|session_version\|disabledAt\|audienceOverride" app`
      geeft niets meer.
- [ ] Lokaal geprobeerd op een kopie van een database in de stand van 0007 (geen pilotdata in de
      repo!): de app start, een docent logt in, ziet zijn werk in Projecten en zijn profielen.
- [ ] De PR-beschrijving zet onder *Wat Bastiaan moet beslissen*: het moment van deployen, de
      back-up vooraf en hoe lang die back-up bewaard blijft.

---

## Als Bastiaan kiest voor laten staan

Dan verdwijnt alle **code** (17.1 en 17.2 ongewijzigd), maar blijven **tabellen en rijen** staan.
Er komt geen destructieve migratie.

- **17.3 vervalt.** In de plaats komt een kleine docs-PR (Haiku, laag):
  - `schema.server.ts`: een commentaarblok boven de vier tabellen en bij de studentkolommen:
    `// Legacy (P17): unused since V1, kept by decision BESLUIT-…; do not read or write.`.
    Geen schemawijziging, geen `db:generate`.
  - `AGENTS.md`, bij *Repositories & the DB seam*: één regel dat deze tabellen en kolommen
    verouderd zijn en niet gebruikt mogen worden.
  - `docs/fabriek/besluiten.md`: het besluit "laten staan", met de reden.
- **Wat er dan geldt (komt al uit 17.2):**
  - Een studentrij kan niet inloggen (`isRole` in `getUser` en `login`).
  - Een student- of cohortuitnodiging is ongeldig.
  - `deleteUserCascade` blijft de verouderde tabellen opruimen. Een beheerder kan een oud
    studentaccount dus één voor één verwijderen via `/admin/invites` → Gebruikers. Het rollabel
    toont dan de ruwe rol.
- **Let op:**
  - De studentdata (namen, e-mail, wachtwoordhashes, chatgeschiedenis, samenvattingen) blijft dan
    zonder doel op de server staan. Dat is een AVG-afweging die Bastiaan maakt, niet de werker.
  - Wil hij later toch opruimen, dan is 17.3 hierboven nog steeds uitvoerbaar.

---

## Risico's

1. **Destructieve migratie op de live pilotdatabase (17.3).** Migraties draaien automatisch bij de
   eerste DB-toegang na een deploy. Dus:
   - **Vooraf:**
     - Tel de rollen (`SELECT role, COUNT(*) FROM users GROUP BY role;`) zodat je weet hoeveel
       accounts verdwijnen.
     - Stop de app en kopieer `limeonit.db` **plus** `limeonit.db-wal` en `limeonit.db-shm` van het
       volume, of maak een back-up met `sqlite3 limeonit.db ".backup …"`.
     - Bewaar de back-up buiten de repo.
   - **Daarna:**
     - Tel opnieuw: geen `student`, en dezelfde aantallen docenten en beheerders.
     - Een docent logt in en ziet zijn werk.
   - **Terugdraaien** = de back-up terugzetten op het volume en de vorige image deployen.
   - De back-up bevat studentdata. Verwijder hem na een korte, door Bastiaan gekozen termijn.
2. **Eén actieve sessie weg = ook "uitloggen na een wachtwoordreset" weg.** Nu maakt een login of
   reset elke oudere cookie ongeldig. Zonder `sessionVersion` blijft een oude cookie tot 30 dagen
   geldig, ook na een reset. Voor docenten is het gemak (inloggen op laptop en telefoon tegelijk)
   een winst. Wil Bastiaan de reset-uitlog houden, houd dan de kolom en verhoog hem **alleen** in
   `reset.$token.tsx` en bij `changePassword` (niet bij elke login). Dat is een klein extra geval in
   17.2, alleen op zijn verzoek.
3. **Volgorde met P20.** P20 maakt ook een migratie en noemt "0008". Wie later merget, krijgt het
   volgende nummer. De migratietest zoekt entries via de journal, dus niets breekt. Als P17 eerst
   landt, vervallen in P20 de studentgevallen (`requireRole` → een student krijgt een 404, de
   AppShell-test "niet voor een student", acceptatiestap 5). Pas dat aan wanneer P20 wordt
   uitgevoerd; de rest van P20 blijft geldig.
4. **Tussen 17.2 en 17.3** staan studentrijen nog in de database, maar ze kunnen niet inloggen en
   hun uitnodigingen zijn ongeldig (de guards uit 17.2). Laat 17.3 daarom niet weken liggen; de data
   heeft geen doel meer.
5. **Grote diff in 17.2.** Het is vooral weghalen. Push één keer als de poort lokaal groen is
   (CI-minuten, `voorkeuren.md`).
6. **Tutors spreken de gebruiker aan als lerende.** Dat is gewenst: docenten gebruiken ze om zelf
   te leren (BESLUIT-2026-11-03-4). De badges "Student" / "Voor studenten" op de startpagina kunnen
   een docent verwarren. Dat is V3 (namen en labels), niet P17.

## Buiten bereik

- Het herontwerp van het modelbeheer (overrule per docent): **V2 / P18**.
- Beheer van acht naar vier pagina's, "Bekijk als docent" weg, de land-as en de
  docenttoegang voor tools en context: **V2 / P18**.
- Toolnamen, badges, het filter "Voor studenten" en de tutorprompts aanpassen: **V3 / P19**.
- `chat_sessions`, `messages` en `projects` laten vallen (docentdata of slapend). Dat is een latere
  opruim-PR.
- `scripts/invite.ts` staat `--role admin` toe, terwijl BESLUIT-2026-07-03-2 zegt dat beheerders
  nooit via een uitnodiging komen. Dat is een losse fix, alleen op verzoek.
- Een nieuwe studentenlaag ("later, opnieuw en beter"). Dat komt op het bord onder *Later*.

## Acceptatie

`npm test && npm run typecheck && npm run check` zijn groen na elk PR.

Handmatig nalopen, na 17.3 op een kopie van een 0007-database met een docent, een student en een
cohort:

1. De app start; de migratie loopt zonder fout.
2. De docent logt in en ziet 15 tools, zijn profielen en zijn werk in Projecten. Het menu toont
   geen Cohorten.
3. Een tutorchat (bijv. Socratic Partner) start met het bewerkbare instellingenpaneel. De docent
   kan zijn profiel kiezen en de chat wordt opgeslagen. Er is geen knop "Sessie beëindigen".
4. De student kan niet inloggen; zijn uitnodigingslink is ongeldig; in de database staat niets meer
   van hem.
5. De beheerder ziet in `/admin` geen Cohorten en geen studenttelling. Bij Uitnodigingen kan hij
   alleen docent of beheerder kiezen. Een nieuwe docentuitnodiging werkt.
6. Een docent verwijdert zijn account op `/account`. Het account en zijn data zijn weg.
