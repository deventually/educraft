# Fase 18 — Vereenvoudiging V2: eenvoudiger beheer

> **Zo voer je deze brief uit:** open hem in een verse sessie en voer **één** deelfase uit per
> sessie, test-first volgens `AGENTS.md` / de `/tdd`-skill. Elke deelfase is **één PR met één doel**,
> in de volgorde van *Volgorde en samenloop*. Schrijf eerst de RED-tests die bij de deelfase staan,
> zie ze falen om de goede reden, en maak ze dan groen. Poort per PR: `npm test && npm run typecheck
> && npm run check`. Branch vanaf `main`. Merge nooit zelf; alleen Bastiaan merget. **Hangt af van:**
> P17 (gemerged en uitgerold op 2026-11-03).

## Context en doel

V1 (P17) haalde de studentenlaag weg. Het beheer is daarna nog steeds te groot: zeven pagina's plus
een knop "Bekijk als docent", een opslaan-knop op elke tabelregel, drie soorten toegang per docent
(tools, context, modellen) die elk anders werken, een land-as met één land, en CLI- en lokale
modellen die ook in productie worden aangeboden. Bastiaan heeft op 2026-11-03 gekozen
(BESLUIT-2026-11-03-14 t/m -17):

1. **Beheer van zeven naar vier pagina's** — Gebruikers, Tools en modellen, Onderwijscontext,
   Gebruik en feedback. "Bekijk als docent" verdwijnt.
2. **Automatisch opslaan** in de beheertabellen, met de bestaande melding ("Opgeslagen.").
   Bastiaan: *"Ik wil ook niet bij beheer op elke tabel regel een opslaan knop hebben. Of eentje
   onderop, of hij slaat automatisch op"* → automatisch.
3. **Geen toegang per docent meer** voor tools en context. Elke docent ziet wat de instelling aanzet.
4. **De land-as weg.** Alleen sector en domein blijven.
5. **Modellen: instelling plus overrule per docent.** Een eigen set van een docent **vervangt** de
   set van de instelling (mag ruimer zijn); geen eigen set = de instelling volgen.
6. **CLI- en lokale modellen alleen in ontwikkelmodus.**
7. **Een superbeheerder** (Bastiaan). Alleen hij maakt beheerders, haalt ze terug naar docent en
   verwijdert ze. Hij kan accounts ook direct aanmaken, wachtwoorden zetten en accounts op
   non-actief zetten. Uitnodigingen maken nooit beheerders.
8. **Opruimen:** de slapende tabellen `chat_sessions`, `messages`, `projects`, de kolommen van de
   weggehaalde poorten, en verouderde documentatie.

**Doel:** na P18 heeft `/admin` vier menu-items, slaat elke wijziging zichzelf op, heeft een docent
één enkele uitzondering (zijn modellen), en kan alleen de superbeheerder beheerders maken.

## Vaste besluiten

1. **Vier pagina's** (Engelse URL's, BESLUIT-2026-06-1):

   | Menu (nl / en) | URL | Inhoud | Komt uit |
   | --- | --- | --- | --- |
   | Gebruikers / Users | `/admin/users` | uitnodigen, uitnodigingen, gebruikerslijst, **modellen per docent**, (superbeheerder) accounts | `admin.invites.tsx` + het docentdeel van `admin.models.tsx` |
   | Tools en modellen / Tools and models | `/admin/tools` | tools aan/uit, modellen van de instelling | `admin.tools.tsx` + het instellingsdeel van `admin.models.tsx` |
   | Onderwijscontext / Teaching context | `/admin/context` | sectoren en domeinen van de instelling | `admin.context.tsx` (zonder land en zonder docenten) |
   | Gebruik en feedback / Usage and feedback | `/admin/usage` | gebruik per dag en per tool, feedback | `admin.usage.tsx` + `admin.feedback.tsx` |

   **Overzicht verdwijnt.** `/admin` stuurt door naar `/admin/users` (de landingspagina). De vier
   tellers (gebruikers, docenten, beheerders, actieve tools) zijn elders al zichtbaar: de
   gebruikerslijst en de toolstabel. Zo blijft het bij vier menu-items.
2. **"Bekijk als docent" weg.** Na besluit 3 ziet een beheerder precies dezelfde tools als een docent
   (alleen de instelling bepaalt het), dus de schakelaar laat niets meer zien wat de beheerder niet
   al ziet. Een oud `viewAs`-cookie in een browser wordt nergens meer gelezen; dat is onschadelijk.
3. **Tools en context: alleen de instelling.** `users.allowed_tool_slugs` (en de toolkeuze bij een
   uitnodiging) en de contextoverrule uit P12 (`contextCustomAccess:`,
   `assignedCountries:`/`assignedSectors:`/`assignedDomains:`) verdwijnen. Elke docent en beheerder
   ziet de tools, sectoren en domeinen die de instelling aanzet. BESLUIT-2026-07-06-3 vervalt.
4. **Land-as weg, packs blijven landneutraal.** Weg: alles wat een beheerder of docent van het land
   ziet of instelt (`enabledCountries`, `getAvailableCountries`, de landkeuze in de editor, de
   foutcode `country-not-available`). **Blijft:** het veld `profile.country` (altijd `"NL"`, gezet
   door `parseForm`/`migrateLegacyProfile`) en de sleutel `country` in de pakketdata
   (`DOMAINS_BY_SECTOR`, `FRAMEWORK_REGISTRY`, `resolveFramework`, `getDomainsForTrack`). Dat is de
   seam voor een later land (BESLUIT-2026-05-29-1, -11-02-3): data, geen engine, geen UI. De engine
   blijft EQF (BESLUIT-2026-07-05-1); `format.ts` verandert niet.
5. **Modellen: overrule, geen doorsnede** (BESLUIT-2026-11-03-16, maakt -7 definitief):
   - **Instelling:** `enabledModels` (null = de hele kiesbare catalogus), zoals nu.
   - **Docent:** `assignedModels:<userId>`. **Gezet** = deze set **vervangt** de instelling, ook als
     hij ruimer is. **Niet gezet** = de instelling volgen. Een beheerder heeft geen eigen set.
   - Een eigen set die na filteren (kiesbaar, in deze modus toegestaan) **leeg** is, telt als niet
     gezet: de docent volgt de instelling. Pas als ook dat leeg is, geldt de bestaande noodval
     `DEFAULT_MODEL` (met log).
   - Bestaande rijen hoeven niet om: P13 sloeg alleen deelverzamelingen van de instelling op (en
     `null` bij "alles"), dus vandaag geeft overrule hetzelfde resultaat.
6. **Ontwikkelmodus = `process.env.NODE_ENV !== "production"`.** Eén functie,
   `localModelsEnabled()` in `app/server/env.server.ts`, leest dat bij elke aanroep (zodat
   `vi.stubEnv` werkt). Buiten ontwikkelmodus worden CLI- en lokale modellen (`local: true`: de vier
   CLI-agents en elk ontdekt `ollama::`/`lmstudio::`-id) niet aangeboden, niet ontdekt en niet
   uitgevoerd. Dit volgt de bestaande regel in `app/lib/ai/adapters/cli.ts` (`runCli` weigert al in
   productie). **De pilot draait op Bastiaans Mac met `npm run dev`** (`NODE_ENV=development`), dus
   lokale modellen blijven daar werken. `react-router-serve` (`npm start`, de Docker-image) zet
   `NODE_ENV=production`. Geen nieuwe omgevingsvariabele.
7. **Superbeheerder** (BESLUIT-2026-11-03-17). In de code heet hij **owner**, om verwarring met de
   *super user* van het toekomstige controlevlak in `docs/Tenancy-and-Admin.md` te voorkomen. In de
   UI: "Superbeheerder" / "Super admin".
   - **Geen derde rol.** Het is één sleutel in `instance_settings`: `ownerUserId` = het id van één
     beheerder. Eén eigenaar per instantie, zonder migratie. `isOwner(user)` = `user.role ===
     "admin"` én het id klopt. Een sleutel naar een verwijderd of gedegradeerd account telt als
     "geen eigenaar".
   - Zetten: `npm run set-owner -- --email <e-mail>` (nieuw script). Het weigert als het account niet
     bestaat of geen beheerder is.
   - **Bevoegdheden** (de server controleert, de UI verbergt):

     | Actie op `/admin/users` | Beheerder | Superbeheerder |
     | --- | --- | --- |
     | Docent uitnodigen, uitnodiging intrekken | ja | ja |
     | Modellen per docent | ja | ja |
     | Bij een **docent**: e-mail wijzigen, herstel-link, verwijderen | ja (zoals nu) | ja |
     | Bij een **beheerder**: e-mail wijzigen, herstel-link, verwijderen | **nee** | ja |
     | Rol wijzigen (docent ↔ beheerder) | **nee** | ja |
     | Account direct aanmaken (docent of beheerder) | nee | ja |
     | Wachtwoord direct instellen | nee | ja |
     | Op non-actief zetten / weer activeren | nee | ja |
     | Iets op het eigen account | nee (via `/account`) | nee (via `/account`) |

     Weigering: `{ error: "ownerOnly" }` met een foutmelding, niets veranderd.
   - **Uitnodigingen maken nooit beheerders** (BESLUIT-2026-07-03-2): de UI mintte al alleen
     docenten, maar `scripts/invite.ts --role admin` en `consumeInvite`/`invite.tsx` lieten een
     beheerdersuitnodiging nog toe. Dat gat gaat dicht.
   - De superbeheerder kan zijn **eigen account niet verwijderen** op `/account` (eerst eigendom
     overdragen met `set-owner`), en zichzelf niet op non-actief zetten.
8. **Account direct aanmaken** (alleen superbeheerder): naam, e-mail (verplicht: inloggen gaat met
   e-mail), rol docent of beheerder, en één van twee manieren:
   - **Link** (standaard): het account bestaat meteen, zonder bruikbaar wachtwoord; de
     superbeheerder krijgt een eenmalige link om een wachtwoord te kiezen. Dat is de bestaande
     herstel-flow (`createPasswordReset` → `/reset/:token`), met 7 dagen geldigheid. Hij kopieert de
     link en geeft hem zelf door.
   - **Zelf een beginwachtwoord**: minimaal 10 tekens (de bestaande regel), gehasht met
     `hashPassword`, daarna nooit meer getoond.

   Er wordt **geen e-mail verstuurd**: de app heeft geen maildienst. Echte mail vraagt een
   mailprovider, dus een nieuwe dependency of betaalde dienst; dat valt buiten P18 tot Bastiaan er
   een goedkeurt (`voorkeuren.md`). Er wordt nergens een wachtwoord in leesbare vorm opgeslagen of
   getoond.
9. **Non-actief** (alleen superbeheerder): de kolom `users.disabled_at` komt **terug**. Eerlijk
   gezegd: 17.3 (migratie `0008_stormy_bloodaxe`) liet hem vallen, omdat hij toen alleen het
   verwijderverzoek van studenten diende. Nu dient hij docenten en beheerders: een tijdelijke stop
   zonder data te verliezen. Een non-actief account kan niet inloggen, `getUser` geeft `null` (alle
   sessies houden op), de data blijft. Op non-actief zetten verhoogt ook `sessionVersion`, zodat
   weer activeren oude cookies niet terugbrengt.
10. **Wachtwoorden door de superbeheerder**: herstel-link (bestaat al) en direct een nieuw wachtwoord
    instellen. Beide lopen via `updateUserPassword`, dat `sessionVersion` verhoogt: de gebruiker is
    daarna overal uitgelogd.
11. **Automatisch opslaan** (zie 18.5): elke wijziging in een beheertabel gaat meteen naar de
    server via een `useFetcher`, zonder paginanavigatie. De focus blijft waar hij was. De toast is
    het **enige** dat iets meldt ("Opgeslagen." / "Saved." of een fout), geen extra live regio
    (P15-regel in `AGENTS.md`). Weigert de server, dan springt het besturingselement terug naar de
    opgeslagen waarde en verschijnt een fouttoast. **Opslaan-knoppen verdwijnen; actieknoppen
    blijven** (uitnodiging maken, intrekken, herstel-link, account aanmaken, wachtwoord instellen,
    non-actief, verwijderen).

## Wat blijft (niet aanraken)

- De 15 tools, hun prompts, `Tool`-type, titels en de startpagina (zie *Samenloop met P19.1*).
- Het modelmenu in de tools (`pickableModels`, `initialPickerModel`), de stream-weigeringen, quota.
- De herstel-flow (`/reset/:token`), `sessionVersion` en `reissueSessionCookie` (BESLUIT-2026-11-03-13).
- Hard verwijderen (`deleteUserCascade`) en de eigen accountpagina, behalve de eigenaarsregel.
- `profile.country` en de pakketdata per land (vast besluit 4).

---

## Volgorde en samenloop

| PR | Titel | Model | Hangt af van |
| --- | --- | --- | --- |
| 18.1 | "Bekijk als docent" weg | Sonnet, gemiddeld | — |
| 18.2 | Geen toegang per docent voor tools en context; land-as weg | Sonnet, gemiddeld | — |
| 18.3 | Modellen: overrule per docent; CLI/lokaal alleen in ontwikkelmodus | Sonnet, hoog | 18.2 |
| 18.4 | Beheer naar vier pagina's | Sonnet, gemiddeld | 18.3 |
| 18.5 | Automatisch opslaan | Sonnet, hoog | 18.4 |
| 18.6 | Superbeheerder: beheerders maken en beheren; uitnodigingen nooit beheerder | Sonnet, hoog + review Opus, hoog | 18.5 |
| 18.7 | Superbeheerder: account aanmaken, wachtwoord instellen, non-actief (migratie) | Sonnet, hoog + review Opus, hoog | 18.6 |
| 18.8 | Opruimen: slapende tabellen en kolommen (destructieve migratie) en docs | Sonnet, gemiddeld + review Opus, hoog | 18.2, 18.7 |

- **18.1 en 18.2 kunnen tegelijk** (WIP 2): 18.1 raakt `roleView`/`set-view`/`root`/`AppShell`/
  `index`/`home`/`tool`, 18.2 raakt `availability` (contextdeel), `users.server`, `admin.context`,
  `admin.invites` en de contexteditor. Ze delen alleen de commentaarregel boven de
  beschikbaarheidspoort in `home.tsx`/`tool.tsx`; wie later merget, neemt die van `main`.
- Daarna **strikt na elkaar**: 18.3 en 18.2 delen `availability.server.ts`; 18.4 verplaatst de
  beheerbestanden; 18.5, 18.6 en 18.7 bouwen op die nieuwe bestanden. Zo wordt elk scherm één keer
  gebouwd.
- **Migraties:** 18.7 (kolom erbij, niet destructief) en 18.8 (destructief). Nummers volgen de
  journal (`0009_…`, `0010_…`, of hoger als P20 eerder landt). Tests zoeken entries via
  `drizzle/meta/_journal.json`, nooit via een vast nummer.
- **Samenloop met P19.1** (V3, parallelle werker op `claude/project-thread-vpdrvw`): P19.1 hernoemt
  tools (taak eerst, boektitel als ondertitel). P18 verandert **geen** tooltitels, geen `Tool`-type
  en geen kaarten op de startpagina. Beheertests mogen **geen tooltitels hardcoderen**: lees de naam
  uit het register (`loc(getToolBySlug("…")!.name, "nl")` of `ALL_TOOLS[i].name`), zodat de hernoeming
  ze niet breekt. Bestaande beheertests die je in P18 aanraakt, zet je zo om.

---

## 18.1 — "Bekijk als docent" weg (PR 1)

**Doel:** geen rolwissel meer. Een beheerder is altijd beheerder. **Branch:** `p18-1-remove-view-as`.

### Weg

| Wat | Bestand / symbool |
| --- | --- |
| Rolwissel-module | `app/server/roleView.server.ts` (geheel) |
| Resource route | `app/routes/set-view.tsx` + `route("set-view", …)` en het commentaar erboven in `app/routes.ts` |
| Root loader | `app/root.tsx`: de import van `getEffectiveRole`, `realRole`; `role` wordt `user.role` |
| Shell | `app/components/AppShell.tsx`: de functie `RoleSwitch`, het blok `user?.realRole === "admin" && <RoleSwitch …>`, `realRole` in het type op regel ~28, de import `UserCog` als die daarna ongebruikt is; het commentaar bij het admin-nav-item ("hidden while viewing as a teacher") |
| Loaders | `app/routes/index.tsx`, `app/routes/home.tsx`, `app/routes/tool.tsx`: `getEffectiveRole` en `viewer`; geef `user` direct door. Pas de commentaren aan |
| Commentaar | `app/routes/admin.tsx`: de zin over "viewing as teacher" in het layoutcommentaar |
| i18n (nl + en) | `nav.viewAsTeacher`, `nav.backToAdmin` |

### Tests

- **RED, nieuw:** `tests/p18-removed.test.ts` (node, `node:fs`, zoals `tests/p17-removed.test.ts`):
  - `it("routes.ts registers no set-view route")`.
  - `it("the view-as modules are gone")`: `existsSync` is `false` voor `app/server/roleView.server.ts`
    en `app/routes/set-view.tsx`.
  - `it("the i18n catalogues have no view-as keys")`: `nl.nav` en `en.nav` missen `viewAsTeacher`
    en `backToAdmin`.
- **RED, gewijzigd:** `tests/components/AppShell.test.tsx`: vervang `"offers a real admin the 'view
  as teacher' switch…"` en `"shows 'back to admin'…"` door `it("offers an admin no view-as
  switch")` (geen knop met naam `Bekijk als docent` / `View as teacher`). Houd de axe-check van
  `"has no a11y violations with the admin role switch shown"`, hernoemd naar `…for an admin`.
- **Verwijderen:** `tests/api/set-view.test.ts`, `tests/lib/roleView.test.ts`.
- **Aanpassen:** `tests/api/index-redirect.test.ts`: het commentaar over `getEffectiveRole`; het
  geval `"sends a student to /tools"` gaat weg (de rol bestaat niet meer). De fixtures met
  `realRole` in `AppShell.test.tsx` verliezen dat veld.

### Klaar als

- [ ] RED-tests eerst rood, nu groen; poort groen.
- [ ] `grep -rn "getEffectiveRole\|viewAs\|set-view\|realRole\|RoleSwitch" app tests` geeft niets.
- [ ] Screenshots van de kopbalk als beheerder: NL en EN, desktop en mobiel (geen schakelaar).

---

## 18.2 — Geen toegang per docent voor tools en context; land-as weg (PR 2)

**Doel:** elke docent ziet de tools, sectoren en domeinen die de instelling aanzet; niemand ziet of
kiest nog een land. Het schema blijft ongewijzigd (kolommen en sleutels gaan in 18.8).
**Branch:** `p18-2-remove-per-teacher-access`.

### Server

- `app/server/availability.server.ts`:
  - `AvailabilityContext.teacherAllowlist`, de import `getUserToolAllowlist` en de allowlist-tak in
    `passes()` weg. `passes()` = boot-geldig ∧ ingeschakeld. Houd de parameter `user` in
    `getAvailableTools`/`isToolAvailable` (alle aanroepers geven hem al mee). Werk het
    kopcommentaar bij: één poort plus boot-geldigheid.
  - Weg: `axisSelection`, `getAvailableCountries`, de imports van `COUNTRIES`,
    `getEnabledCountries`, `getUserAssigned{Countries,Sectors,Domains}`,
    `getUserContextCustomAccess`. `getAvailableSectors(user)` = `resolveAxis(SECTORS, await
    getEnabledSectors(), …)`; `getAvailableDomainSlugs(user)` = `getEnabledDomains()`.
    `getAvailableDomains` blijft. `DEFAULT_COUNTRY` blijft voor `getDomainsForTrack`.
- `app/server/repositories/users.server.ts` — weg: `getUserToolAllowlist`, `setUserToolAllowlist`,
  `getUserAssignedCountries`, `getUserAssignedSectors`, `getUserAssignedDomains`,
  `setUserAssignedCountries`, `setUserAssignedSectors`, `setUserAssignedDomains`,
  `getUserContextCustomAccess`, `setUserContextCustomAccess`. Uit `CreateUserInput` en
  `CreateInviteInput` gaat `allowedToolSlugs`; `createUser`/`createInvite` schrijven
  `allowedToolSlugs: null` (schema blijft tot 18.8). Uit `InviteWithContext` en
  `listInvitesWithContext` gaat `allowedToolSlugs`. **Blijven:** `getAssignedList`,
  `setAssignedList`, `getUserAssignedModels`, `setUserAssignedModels` (modellen, 18.3).
- `app/server/repositories/settings.server.ts`: `getEnabledCountries`, `setEnabledCountries` en
  `ENABLED_COUNTRIES_KEY` weg; kopcommentaar bijwerken.
- `app/routes/invite.tsx`: het kopiëren van `consumed.allowedToolSlugs` naar het account weg.

### Beheer

- `app/routes/admin.context.tsx`: alleen nog het instellingsformulier met **sectoren en domeinen**.
  Weg: landen (`COUNTRIES`, `COUNTRY_LABELS`, `isCountryCode`, `countryLabelFor`, `CheckAxis` voor
  landen), de hele docentsectie (`TeacherAccessForm`, `teachers` in de loader, `listUsers`, de
  intent `teacher`), de props `countries`/`teachers`. Lockout: minstens één sector
  (`error: "instance-empty"`). Kopcommentaar herschrijven.
- `app/routes/admin.invites.tsx`: de toolkeuze bij het uitnodigen weg (`toolMode`, `tools`,
  `restrict`/`setRestrict`, `getAvailableTools`-preview in loader en action, `HelpText`/`loc` als
  ongebruikt).

### Contexteditor

- `app/routes/context-profiles.tsx`: `getAvailableCountries` en `availableCountries` uit loader,
  action en component.
- `app/lib/context/parseForm.ts`: de optie `availableCountries`, de controle erop en de foutcode
  `"country-not-available"` weg. `country` wordt altijd `DEFAULT_COUNTRY` (het formulier stuurt geen
  land meer); `effCountry` idem.
- `app/components/context/ContextProfileEditor.tsx`: prop `availableCountries`, state `country`, de
  `CountrySelect` en het verborgen veld `country`. Geef `DEFAULT_COUNTRY` door waar `country` een
  prop is.
- `app/components/context/ContextFields.tsx`: `CountrySelect` (en de import `COUNTRY_LABELS`) weg.
  De props `country = "NL"` op de domein- en kaderkiezers blijven (packseam).

### i18n (nl + en)

- **Weg:** `settings.country`, `admin.context.countriesLegend`, `admin.context.teacherLegend`,
  `teacherPick`, `teacherHint`, `activateLabel`, `inheritsNote`, `teacherNone`, `domainsLegend`,
  `domainsHint` (het instellingsdeel gebruikt `instanceDomainsLegend`/`instanceDomainsHint`/
  `domainsNone`, die blijven), `admin.invites.toolsLegend`, `toolsHint`, `allToolsOption`,
  `restrictOption`.
- **Nieuwe tekst:**
  - `admin.context.intro`: "Kies welke onderwijssectoren en domeinen/profielen docenten in hun
    onderwijscontext kunnen kiezen." / "Choose which sectors and domains/profiles teachers can pick
    in their teaching context."
  - `admin.context.atLeastOne`: "Kies minstens één sector." / "Choose at least one sector."
  - `admin.overview.desc.context` (tot 18.4): "Bepaal welke sectoren en domeinen docenten kunnen
    kiezen." / "Choose which sectors and domains teachers can pick."
  - `admin.invites.mintIntro`: zonder de toolbeperking.

### Help

- `app/content/help/topics/context-profiles.{nl,en}.md`: "land" uit stap 1 en uit de kop
  "Land → onderwijstype → niveau" (wordt "Onderwijstype → niveau" / "Type of education → level"); de
  sectie "Voor beheerders: standaarden en aangepaste toegang" wordt "Voor beheerders: standaarden":
  sectoren en domeinen, geen landen, geen aangepaste toegang.

### Tests

- **RED, nieuw of gewijzigd:**
  - `tests/lib/availability.test.ts`: vervang het blok `per-teacher allow-list (Phase 4)` door
    `it("a teacher sees every instance-enabled tool; a stored allow-list is ignored")`. Zet de oude
    kolom klaar met `getDb().update(users).set({ allowedToolSlugs: JSON.stringify([slug]) })`
    (de setter bestaat niet meer). RED: vandaag filtert de allowlist.
  - `tests/lib/context-availability.test.ts` (herschrijven, de mocks van de per-docentgetters weg):
    `it("a teacher follows the instance sectors and domains")`,
    `it("a stored custom-access flag and assignment are ignored")` (sleutels klaarzetten met een
    directe insert in `instance_settings`; RED),
    `it("null instance settings = the whole catalogue")`, en het lockout-geval houden.
  - `tests/api/context-availability-integration.test.ts`: dezelfde twee kernregels op echte opslag;
    de override-gevallen vervallen.
  - `tests/p18-removed.test.ts` (uitbreiden):
    `it("availability exports no country axis")`: `"getAvailableCountries" in
    await import("~/server/availability.server")` is `false`;
    `it("users.server exports no per-teacher tool or context access")`: geen van de tien namen
    hierboven staat in de module.
  - `tests/parseForm.test.ts`: `"refuses a country/sector outside the caller's available set"` wordt
    `it("refuses a sector outside the available set")`; nieuw
    `it("always stores country NL, even when the form sends another")`.
  - `tests/components/ContextProfileEditor.test.tsx`: `"hides the country picker…"` wordt
    `it("has no country field at all")` (geen label `Land`/`Country`, geen veld `name="country"`).
  - `tests/components/admin-context.test.tsx`: `it("offers no country axis")`,
    `it("offers no per-teacher section")`; de blokken `activate custom access (P12)`,
    `per-teacher assignment` en `per-teacher domains (P10.3)` vervallen. Houd de axe-check.
  - `tests/components/admin-invites.test.tsx`: `"reveals the tool allow-list only when 'restrict'…"`
    wordt `it("offers no tool restriction when inviting")`.
  - `tests/api/admin-routes.test.ts`: `"mints a teacher invite carrying the chosen tool
    allow-list"` wordt `it("mints a plain teacher invite (no tool list)")`; het blok
    `admin.context action — activation + per-teacher assignment (P12)` vervalt;
    `"refuses when either axis is empty (a country but no sector)"` wordt
    `it("refuses an empty sector selection")`.
  - `tests/api/invite-flow.test.ts`: het blok `teacher tool allow-list (Phase 4)` wordt
    `it("a legacy invite with a tool list creates an unrestricted teacher")` (directe insert).
- **Verwijderen:** in `tests/api/users-repo.test.ts` de gevallen over country/sector/domain-
  toewijzing en `context custom-access flag (P12)`; in `tests/api/settings-repo.test.ts` de
  landgevallen; in `tests/api/context-profiles-route.test.ts` het landdeel van `"passes the
  available country + sector sets…"`.

### Docs (zelfde PR)

- `AGENTS.md`, *Access & Availability*: **Effective availability** = één poort (instelling); de
  bullet **Context-editor axes … OVERRIDE model (P12)** wordt één regel: "Context-editor axes
  (sector/domain) follow the instance settings (`enabledSectors`/`enabledDomains`); no per-teacher
  access (P18)."
- `wiki/Context-Model.md`: de sectie over beschikbaarheid (regels ~36 en ~62–95) herschrijven naar
  "instelling bepaalt"; de land-as als *dataseam*, niet als keuze.
- `wiki/Roadmap.md` regel ~51: geen *custom access* meer.
- `docs/Tenancy-and-Admin.md` regel 15: geen allowlist per docent.
- `docs/fabriek/besluiten.md`: niets (BESLUIT-2026-11-03-15 staat er al).

### Klaar als

- [ ] RED-tests eerst rood, nu groen; poort groen.
- [ ] `grep -rn "allowedToolSlugs\|ToolAllowlist\|ContextCustomAccess\|AssignedCountries\|AssignedSectors\|AssignedDomains\|EnabledCountries\|getAvailableCountries\|CountrySelect" app`
      geeft alleen nog `schema.server.ts` en de `null`-opvulling in `users.server.ts`.
- [ ] Handmatig: een docent met een oude allowlist ziet alle aangezette tools; de editor toont geen
      land; een nieuw profiel krijgt `country: "NL"`.
- [ ] Screenshots: `/admin/context`, het uitnodigingsformulier en de contexteditor, NL en EN,
      desktop en mobiel.
- [ ] PR-beschrijving, *Wat Bastiaan moet beslissen*: de wijziging in `AGENTS.md`; en de
      controle-query uit *Risico's* punt 2 vóór het uitrollen.

---

## 18.3 — Modellen: overrule per docent; CLI/lokaal alleen in ontwikkelmodus (PR 3)

**Doel:** een eigen modelset van een docent vervangt de instelling (ook ruimer); zonder eigen set
volgt hij de instelling. Buiten ontwikkelmodus bestaan CLI- en lokale modellen niet voor de app.
**Branch:** `p18-3-model-override-dev-only-local`.

### Server

- `app/server/env.server.ts`: nieuw `export function localModelsEnabled(): boolean { return
  process.env.NODE_ENV !== "production"; }`, met één regel commentaar (vast besluit 6).
- `app/server/availability.server.ts` (modeldeel herschrijven, kopcommentaar mee):
  - `isAllowedHere(id)` (privé): resolveerbaar ∧ `clientSelectable` ∧ (`!resolveModelInfo(id).local`
    ∨ `localModelsEnabled()`).
  - `selectableCatalogIds()`: filtert de catalogus ook met `isAllowedHere` (CLI-agents vallen eruit
    in productie).
  - `teacherOwnSet(user)` (vervangt `userModelRestriction`): voor een docent de toegewezen ids
    gefilterd met `isAllowedHere`; **leeg na filteren = `null`** (vast besluit 5). Voor een
    beheerder of zonder gebruiker: `null`.
  - `getSelectableModelIds(user)`: `own = teacherOwnSet(user)`; is die er, dan = de catalogusids in
    `own` (géén doorsnede met `enabledModels`); anders = `selectableCatalogIds()`. Leeg én `own`
    bevat geen catalogusid (bijv. alleen een lokaal model) → lege set terug, geen noodval (de
    bugfix uit P14 blijft). Leeg in de andere gevallen → `DEFAULT_MODEL` + log
    `availability_no_selectable_models` (zoals nu).
  - `isModelSelectableForUser(user, id)`: `isAllowedHere(id)` en dan: eigen set → `own.has(id)`;
    anders `enabledModels` null/leeg of bevat `id`.
  - `restrictionGrantsUsableModel` vervalt (vervangen door de regel "leeg na filteren = `null`").
  - `effectiveDefaultModel`: zelfde volgorde, met `teacherOwnSet` in plaats van
    `userModelRestriction`.
  - `narrowLocalModels`: ongewijzigd (loopt via `isModelSelectableForUser`).
- `app/routes/tool.tsx`: roep `discoverLocalModels()` alleen aan als `localModelsEnabled()`; anders
  `localModels = []`. Dat bespaart in productie ook de time-out van 1,5 s per toolpagina.
- `app/routes/admin.models.tsx`:
  - `fullCatalog()`: zonder CLI en zonder ontdekte modellen als `!localModelsEnabled()`.
  - Docentdeel (`intent=teacher`): velden `mode` (`inherit` | `own`) en `models`. `inherit` →
    `setUserAssignedModels(id, null)`. `own` → de geselecteerde ids gefilterd op `fullCatalog()`
    (**niet** op de instelling); leeg → `{ error: true }` (zelfde melding `atLeastOne`), niets
    opgeslagen; anders precies die set opslaan (geen "alles = null"-samenvouwing meer).
  - Loader: per docent `mode` (`own` als er een set is) en `models`; de checkboxen lopen over de
    **hele** catalogus (`fullCatalog()`), niet over de instellingsset.
  - UI per docent: een `fieldset` met twee radioknoppen "Volgt de instelling" / "Eigen keuze" en
    daaronder de checkboxen (uitgeschakeld bij "Volgt de instelling"). Kopcommentaar herschrijven.
- `app/server/repositories/users.server.ts`, `deleteUserCascade`: verwijder ook de sleutel
  `assignedModels:<id>` uit `instance_settings` (nu blijft hij achter).

### i18n (nl + en)

- **Nieuw:** `admin.models.teacherInherit` ("Volgt de instelling" / "Follows the instance"),
  `admin.models.teacherOwn` ("Eigen keuze" / "Own selection").
- **Nieuwe tekst:** `admin.models.intro` (zonder "lokale en CLI-modellen zijn gratis maar kies je
  hier"), `admin.models.teacherIntro` ("Een docent volgt de modellen van de instelling, of krijgt een
  eigen keuze. Een eigen keuze vervangt de instelling en mag ruimer zijn." / EN gelijk),
  `admin.models.localGroupHint` ("Alleen zichtbaar in ontwikkelmodus (`npm run dev`). …").

### Tests

- **RED, nieuw of gewijzigd** in `tests/lib/availability.test.ts`:
  - `it("a teacher's own set replaces the instance set, also when wider")`:
    `setEnabledModels([haiku])`, `setUserAssignedModels(t, [sonnet, haiku])` → beide kiesbaar.
  - `it("a teacher without an own set follows the instance")`.
  - `it("an admin always gets the instance set")`.
  - `it("an own set of only unknown ids falls back to the instance set, not DEFAULT_MODEL")`.
  - `it("hides CLI and local models in production")`: `vi.stubEnv("NODE_ENV", "production")` →
    `isModelSelectableForUser(undefined, "claude-code")` en `(…, "ollama::x")` zijn `false`;
    `getSelectableModelIds()` bevat geen CLI-id. `vi.unstubAllEnvs()` in `afterEach`.
  - `it("offers CLI and local models outside production")`.
  - Herschrijven: `"a teacher's assignment narrows the base (intersect)…"`,
    `"an out-of-base teacher assignment falls back to the default…"` (wordt: wordt gehonoreerd) en
    `"[P14] a teacher assignment narrows a local/CLI id (intersect)…"` naar overrule.
- `tests/api/stream.test.ts`:
  - **RED:** `it("[P18] a teacher's own set may include a model the instance disabled")`: het
    gevraagde model wordt gebruikt.
  - **RED:** `it("[P18] a CLI model is refused in production and falls back to the tool default")`.
  - `"[P13] a per-teacher assignment blocks a model outside it"` en de `[bugfix]`-test blijven.
- `tests/api/admin-routes.test.ts`, blok `per-teacher assignment (P13)` herschrijven:
  `it("mode=inherit clears the teacher's set")`,
  `it("mode=own stores exactly the chosen set, also outside the instance set")` (RED),
  `it("mode=own with nothing chosen is refused and stores nothing")` (RED),
  `it("drops unknown ids")`; nieuw `it("the loader lists no CLI or local models in production")`.
- `tests/components/admin-models.test.tsx`: `it("offers inherit/own per teacher; checkboxes are
  disabled while inheriting")`, `it("lists the whole catalogue for a teacher, not only the instance
  set")`. Houd de axe-check.
- **Nieuw:** `tests/api/tool-loader.test.ts`: `it("does not discover local models in production")`
  (`vi.mock("~/lib/ai/discover.server")`, de spy wordt niet aangeroepen).
- `tests/api/delete-account.test.ts`: **RED** `it("removes the user's assignedModels key")`.

### Docs (zelfde PR)

- `AGENTS.md`: de bullet **Model availability uses INTERSECT…** en de P14-subbullet worden één
  bullet "Model availability uses OVERRIDE (P18)": instelling `enabledModels`; een docent met
  `assignedModels:<id>` krijgt precies die set (mag ruimer); leeg/ongeldig = instelling; één
  noodval; CLI/lokaal alleen als `localModelsEnabled()`. Ook de zin "Unlike the P12 context axes
  (override), models only ever narrow" eruit. Werk de zin in *Provider abstraction* niet bij (die
  klopt nog).
- `wiki/Architecture.md` regel ~74.
- `app/content/help/topics/account.{nl,en}.md` regel ~12: "De beheerder bepaalt welke modellen voor
  jou beschikbaar zijn." (zonder "lokale en CLI-modellen").

### Klaar als

- [ ] RED-tests eerst rood, nu groen; poort groen.
- [ ] `grep -rn "intersect\|INTERSECT\|userModelRestriction\|restrictionGrantsUsableModel" app AGENTS.md`
      geeft niets meer over modellen.
- [ ] Handmatig op de Mac (`npm run dev`): Ollama-modellen en CLI-agents staan in het menu en
      werken. Met `npm run build && npm start`: ze staan nergens, ook niet in beheer.
- [ ] Screenshots van het docentdeel van `/admin/models`, NL en EN, desktop en mobiel.

---

## 18.4 — Beheer naar vier pagina's (PR 4)

**Doel:** vier menu-items, geen overzichtspagina. Nog met opslaan-knoppen; die gaan in 18.5.
**Branch:** `p18-4-admin-four-pages`.

### Routes en bestanden

- `app/routes.ts`, kinderen van `admin`: `index("routes/admin._index.tsx")`,
  `route("users", "routes/admin.users.tsx")`, `route("tools", …)`, `route("context", …)`,
  `route("usage", …)`. Weg: `models`, `invites`, `feedback`.
- `git mv app/routes/admin.invites.tsx app/routes/admin.users.tsx` (route-types worden
  `./+types/admin.users`). Het docentdeel van `admin.models.tsx` (loader `teachers`, intent
  `teacher`, `TeacherModelForm`, de radio uit 18.3) gaat hierheen als sectie **"Modellen per
  docent"**, onder de gebruikerslijst. Intent-naam: `teacherModels`.
- `app/routes/admin.tools.tsx`: krijgt het instellingsdeel van `admin.models.tsx` (`fullCatalog`,
  de groepen Frontier / CLI / Lokaal, intent `models`). De bestaande toolrij krijgt intent `tool`.
  Loader geeft `{ rows, models }`.
- `app/routes/admin.usage.tsx`: krijgt de feedbacksectie uit `admin.feedback.tsx` (loader
  `listFeedbackWithContext`, de filter op tool blijft client-side). Twee `h2`'s: "Gebruik" en
  "Feedback van testers".
- Weg: `app/routes/admin.models.tsx`, `app/routes/admin.feedback.tsx`.
- `app/routes/admin._index.tsx`: alleen nog een loader: `await requireRole(request, "admin"); throw
  redirect("/admin/users");` en een component die `null` geeft.
- `app/routes/index.tsx`: een beheerder gaat direct naar `/admin/users`.
- `app/routes/admin.tsx`: `SECTIONS` = vier items (`users` met icoon `Users`, `tools`
  `SlidersHorizontal`, `context` `GraduationCap`, `usage` `Activity`); ongebruikte iconen weg.

### i18n (nl + en)

- `admin.console.nav`: **weg** `overview`, `models`, `invites`, `feedback`; **nieuw** `users`
  ("Gebruikers" / "Users"); **nieuwe tekst** `tools` ("Tools en modellen" / "Tools and models"),
  `usage` ("Gebruik en feedback" / "Usage and feedback"). `context` blijft.
- **Weg:** de hele namespace `admin.overview`.
- De namespaces `admin.invites`, `admin.models`, `admin.feedback` **blijven** onder hun naam
  (interne sleutels; hernoemen is churn zonder winst).
- `admin.console.subtitle` mag blijven.

### Tests

- **RED, nieuw:** `tests/components/admin-layout.test.tsx`:
  `it("shows exactly four sections in order")` (linknamen Gebruikers, Tools en modellen,
  Onderwijscontext, Gebruik en feedback; hrefs `/admin/users`, `/admin/tools`, `/admin/context`,
  `/admin/usage`) en een axe-check.
- **RED, uitbreiden:** `tests/p18-removed.test.ts`:
  `it("routes.ts registers exactly the four admin pages")`,
  `it("the old admin pages are gone")` (`admin.models.tsx`, `admin.invites.tsx`,
  `admin.feedback.tsx`), `it("the i18n catalogues have no admin.overview")`.
- **RED:** `tests/api/index-redirect.test.ts`: een beheerder gaat naar `/admin/users`;
  nieuw `it("/admin redirects an admin to /admin/users")` (loader van `admin._index`).
- **Verplaatsen:** `tests/components/admin-invites.test.tsx` → `admin-users.test.tsx` (plus de
  docentgevallen uit `admin-models.test.tsx`); de instellingsgevallen uit `admin-models.test.tsx`
  → `admin-tools.test.tsx`; `admin-feedback.test.tsx` → render via `admin.usage` en voeg samen met
  `admin-usage.test.tsx`. Elke pagina houdt één axe-check.
- **Aanpassen:** `tests/api/admin-access.test.ts` (de lijst wordt `admin._index`, `admin.users`,
  `admin.tools`, `admin.context`, `admin.usage`), `tests/api/admin-routes.test.ts` (imports en
  intents), `tests/routes/toastWiring.test.tsx` als die een oude route noemt.
- Tooltitels in deze tests uit het register (zie *Samenloop met P19.1*).

### Docs (zelfde PR)

- `AGENTS.md`: `admin.models.tsx` → `admin.tools.tsx` / `admin.users.tsx`; `/admin/invites` →
  `/admin/users`.
- `wiki/Authentication.md` regel ~64, `wiki/Deployment.md` regel ~98 (`/admin/feedback` →
  `/admin/usage`), `docs/Tenancy-and-Admin.md` regels 15 en 26.

### Klaar als

- [ ] RED-tests eerst rood, nu groen; poort groen.
- [ ] Handmatig: `/admin` opent Gebruikers; elke oude functie staat op een van de vier pagina's.
- [ ] Screenshots van alle vier pagina's, NL en EN, desktop en mobiel.

---

## 18.5 — Automatisch opslaan (PR 5)

**Doel:** geen opslaan-knop meer in beheer. Elke wijziging slaat zichzelf op, met één melding.
**Branch:** `p18-5-admin-autosave`.

### Bouwsteen

Nieuw: `app/components/admin/AutoSaveForm.tsx`, een diepe module met een smalle interface:

```tsx
<AutoSaveForm intent="tool" hidden={{ slug }} errorMessage={(code) => …} aria-label={…}>
  {/* gewone, ongecontroleerde inputs met defaultChecked / defaultValue */}
</AutoSaveForm>
```

- Binnenin: `useFetcher()` en `fetcher.Form method="post"` met `ref`.
- **Wanneer opslaan:** `onChange` op het formulier → bij een `checkbox`, `radio` of `select`
  meteen `fetcher.submit(form)`. Een tekst- of e-mailveld slaat op bij `blur` als de waarde
  veranderd is, en bij Enter (`onSubmit` → `preventDefault` + `fetcher.submit`).
- **Melding:** `useActionToast(fetcher.data, …)` uit `app/components/Toast.tsx`: succes =
  `t.admin.console.saved`, fout = `errorMessage(code)` of `t.error.generic`. Geen pending-toast (bij
  elke klik is dat ruis). Geen inline `role="status"`/`role="alert"`/`aria-live` (P15).
- **Fout = terugspringen:** als `fetcher.state` weer `idle` is en `fetcher.data` een `error` heeft,
  `formRef.current?.reset()`. Na de revalidatie zijn de `default…`-waarden de opgeslagen waarden,
  dus het element toont weer de waarheid van de server.
- **Focus:** geen navigatie en geen nieuwe `key`, dus de focus blijft op het element. Gebruik geen
  `key` die van de opgeslagen waarde afhangt.
- Een sneltoets of snel klikken stuurt meerdere verzoeken; elk verzoek stuurt de hele stand van zijn
  formulier, dus het laatste wint.

### Toepassen

| Pagina | Wat slaat zichzelf op | Formulier |
| --- | --- | --- |
| Tools en modellen | aan/uit per tool | één `AutoSaveForm` per rij (`intent=tool`) |
| Tools en modellen | modellen van de instelling | één `AutoSaveForm` voor de hele lijst (`intent=models`); lockout → fout + terugspringen |
| Onderwijscontext | sectoren en domeinen | één `AutoSaveForm` (`intent=instance`); lockout → fout + terugspringen |
| Gebruikers | e-mail van een gebruiker | één per rij (`intent=setEmail`), opslaan bij blur/Enter |
| Gebruikers | rol (tot 18.6 voor elke beheerder) | één per rij (`intent=role`) |
| Gebruikers | modellen per docent (radio + checkboxen) | één per docent (`intent=teacherModels`) |

- Weg uit de pagina's: elke `<Button type="submit">` die alleen opslaat, de lege kolomkop
  `t.admin.tools.save` in de toolstabel, de inline rode foutregels `actionData?.error && <p…>` op
  Tools/Modellen/Context (de toast meldt het), en `useFormToast` op pagina's waar daarna geen
  `<Form>` meer navigeert. `useFormToast` blijft op Gebruikers voor de actieknoppen.
- i18n **weg:** `admin.tools.save`, `admin.models.save`, `admin.context.save`,
  `admin.invites.save`, `admin.invites.apply`.

### Tests

- **RED, nieuw:** `tests/components/AutoSaveForm.test.tsx` (createRoutesStub met een action):
  - `it("saves a checkbox change without a submit button and shows one 'Opgeslagen.' toast")`
    (render binnen `ToastProvider`; precies één toast).
  - `it("keeps focus on the changed control")` (`document.activeElement` is de checkbox).
  - `it("saves a text field on blur and on Enter, not on every keystroke")` (tel de action-aanroepen).
  - `it("reverts the control and shows an error toast when the action refuses")`.
  - `it("adds no live region of its own")` (geen `role="status"`/`aria-live` binnen het formulier).
  - axe-check.
- **RED, gewijzigd:** `tests/components/admin-tools.test.tsx`, `admin-context.test.tsx`,
  `admin-users.test.tsx`: `it("has no save buttons")` (geen knop met naam `Opslaan`/`Save`/
  `Toepassen`/`Apply`); het oude geval `"confirms a save (mutation) via the per-row form"` wordt een
  autosave-geval. Houd de axe-checks.
- `tests/api/admin-routes.test.ts`: de actions zelf veranderen niet, behalve de intentnamen; pas aan
  waar nodig.

### Docs (zelfde PR)

- `AGENTS.md`, *Feedback/announce layer (P15)*: één zin: "Admin tables autosave through
  `AutoSaveForm` (fetcher + `useActionToast`, revert on error); no per-row save buttons (P18)."

### Klaar als

- [ ] RED-tests eerst rood, nu groen; poort groen.
- [ ] `grep -rn "t.admin.\(tools\|models\|context\|invites\).save\|invites.apply" app` geeft niets.
- [ ] Handmatig met toetsenbord en VoiceOver: een checkbox omzetten → één keer "Opgeslagen."
      voorgelezen, focus blijft; het laatste model uitvinken → foutmelding en het vinkje staat er weer.
- [ ] Screenshots van de vier pagina's met een zichtbare toast, NL en EN, desktop en mobiel.

---

## 18.6 — Superbeheerder: beheerders maken en beheren (PR 6)

**Doel:** alleen de superbeheerder maakt, degradeert en verwijdert beheerders; uitnodigingen kunnen
nooit een beheerder maken. Geen migratie. **Branch:** `p18-6-owner`.

### Server

- `app/server/repositories/settings.server.ts`: `getOwnerUserId(): Promise<string | null>` en
  `setOwnerUserId(id: string | null)`, sleutel `ownerUserId` (een JSON-string in `value_json`).
- `app/server/auth.server.ts`: `export async function isOwner(user: Pick<User, "id" | "role">):
  Promise<boolean>` = `user.role === "admin" && (await getOwnerUserId()) === user.id`.
- `app/routes/admin.users.tsx`:
  - Loader: `isOwner` van de ingelogde beheerder en `ownerId` (voor het label "Superbeheerder" in de
    lijst, voor iedere beheerder zichtbaar).
  - Action: een kleine helper `mayManage(actor, target)` = doel is docent, of actor is eigenaar.
    - `role`: alleen de eigenaar (`{ error: "ownerOnly" }` anders); nooit zichzelf (bestaat al).
    - `deleteUser`, `resetPassword`, `setEmail`: weigeren met `ownerOnly` als `!mayManage`.
    - `mint`: blijft `role: "teacher"`.
  - UI: de rolkeuze alleen voor de eigenaar; bij een beheerdersrij zien gewone beheerders geen
    e-mailveld, geen herstel-link en geen verwijderknop (alleen "—"); een badge "Superbeheerder"
    naast de naam van de eigenaar.
- Uitnodigingen nooit beheerder:
  - `app/server/repositories/users.server.ts`, `consumeInvite`: de guard wordt
    `eq(invites.role, "teacher")` (niet `inArray(…, ROLES)`).
  - `app/routes/invite.tsx`, `isRedeemable`: alleen `invite.role === "teacher"`; ook
    `createUser({ role: "teacher" })`. Een open beheerdersuitnodiging is daarmee ongeldig.
  - `scripts/invite.ts`: `--role` vervalt; het script mint altijd een docentuitnodiging. Geeft
    iemand `--role` mee met een andere waarde dan `teacher`, dan stopt het met: "Uitnodigingen maken
    alleen docenten. Een beheerder maak je met npm run create-admin of via promotie door de
    superbeheerder."
- Nieuw script `scripts/set-owner.ts` + `package.json` → `"set-owner": "tsx scripts/set-owner.ts"`:
  `--email` verplicht; zoekt het account, weigert als het niet bestaat of geen `admin` is, schrijft
  `setOwnerUserId`, print één regel. Relatieve imports, zoals `create-admin.ts`.
- `app/routes/account.tsx`: de eigenaar kan zijn eigen account niet verwijderen. Action: `if (await
  isOwner(user)) return { error: m.account.ownerCannotDelete }`; UI: in plaats van het
  verwijderblok de zin `account.ownerCannotDelete`.

### i18n (nl + en)

- **Nieuw:** `admin.invites.ownerBadge` ("Superbeheerder" / "Super admin"),
  `admin.invites.ownerOnlyError` ("Alleen de superbeheerder kan dit." / "Only the super admin can
  do this."), `account.ownerCannotDelete` ("Je bent de superbeheerder. Draag dat eerst over (npm run
  set-owner) voordat je je account verwijdert." / EN gelijk).
- **Nieuwe tekst:** `admin.invites.usersIntro` (beheerders beheren docenten; de superbeheerder ook
  beheerders), `admin.invites.mintIntro` ("…Een beheerder maakt alleen de superbeheerder.").

### Tests

- **RED, nieuw:** `tests/api/owner.test.ts`: round-trip van `ownerUserId`;
  `it("isOwner is true only for the admin whose id is stored")`;
  `it("a stored id of a teacher or a deleted user is no owner")`; `it("unset = no owner")`.
- **RED** in `tests/api/admin-routes.test.ts` (blok `admin.users action — owner`):
  - `it("a regular admin cannot change any role")` → `ownerOnly`, rol ongewijzigd.
  - `it("the owner promotes a teacher and demotes an admin")`.
  - `it("a regular admin cannot delete, reset or re-email another admin")`.
  - `it("a regular admin still deletes, resets and re-emails a teacher")`.
  - `it("the owner deletes an admin")`.
  - Het bestaande `"promotes an existing user in place…"` wordt een eigenaarsgeval.
- **RED:** `tests/api/invite-flow.test.ts`: `it("an admin invite is invalid and creates no
  account")` (directe insert met `role: "admin"`). `tests/api/users-repo.test.ts`:
  `it("consumeInvite refuses an admin invite")`.
- **RED:** `tests/p18-removed.test.ts`: `it("scripts/invite.ts can only mint teacher invites")`
  (de tekst importeert geen `ROLES` en bevat `role: "teacher"`).
- **RED:** `tests/api/account-route.test.ts`: `it("refuses to delete the owner's account")`.
- `tests/components/admin-users.test.tsx`: `it("shows the role select only to the owner")`,
  `it("hides admin-row actions from a regular admin")`, `it("marks the owner with a badge")`; axe.
- `tests/components/Account.test.tsx`: `it("shows the owner a transfer note instead of delete")`.

### Docs (zelfde PR)

- `docs/Tenancy-and-Admin.md`: rollentabel en "Admins are never minted by an invite link" bijwerken:
  promotie alleen door de superbeheerder (`ownerUserId`, `npm run set-owner`); het verschil met de
  *super user* van het controlevlak.
- `wiki/Authentication.md`: een sectie "Superbeheerder".
- `AGENTS.md`, *Access & Availability*: een bullet **Owner (P18)** met de bevoegdhedentabel in
  één zin.

### Uitrol op de Mac van Bastiaan

Na de merge, met de app gestopt of draaiend (de sleutel wordt per verzoek gelezen):

```bash
npm run set-owner -- --email <jouw e-mailadres>
```

Tot dat gebeurt is er **geen** superbeheerder en kan niemand rollen wijzigen. Zet dit in de
PR-beschrijving onder *Wat Bastiaan moet doen*. Zet nooit een echt e-mailadres in de repo.

### Klaar als

- [ ] RED-tests eerst rood, nu groen; poort groen.
- [ ] `npm run invite -- --role admin` stopt met de melding; `npm run invite` maakt een docentlink.
- [ ] Handmatig met twee beheerders: de gewone ziet geen rolkeuze en geen acties op de andere
      beheerder; de eigenaar wel.
- [ ] Screenshots van Gebruikers als eigenaar en als gewone beheerder, NL en EN, desktop en mobiel.

---

## 18.7 — Superbeheerder: account aanmaken, wachtwoord instellen, non-actief (PR 7)

**Doel:** de superbeheerder maakt accounts direct (met link of beginwachtwoord), zet een wachtwoord
en zet accounts op non-actief en terug. Eén niet-destructieve migratie.
**Branch:** `p18-7-owner-accounts`.

### Schema en migratie

- `app/server/schema.server.ts`, `users`: `disabledAt: integer("disabled_at", { mode:
  "timestamp_ms" })` (nullable), met commentaar: "P18: owner-set deactivation; null = active.
  (An earlier student-only column of the same name was dropped in 0008.)"
- `npm run db:generate` → één `ALTER TABLE users ADD COLUMN disabled_at integer;`. Controleer de SQL:
  geen tabelherbouw.

### Server

- `app/server/password.server.ts`: `export const NO_PASSWORD = "none";` met commentaar: een record
  dat `verifyPassword` altijd afwijst (geen drie delen).
- `app/server/repositories/users.server.ts`:
  - `createUser` vult `disabledAt: null`.
  - `setUserDisabled(id: string, disabled: boolean)`: zet `disabledAt` (`new Date()` of `null`);
    bij uitzetten ook `sessionVersion + 1` in hetzelfde statement. Pas het commentaar bij
    `updateUserPassword` aan: dit is de tweede plek die de teller verhoogt.
  - `createPasswordReset` krijgt al `ttlHours`; gebruik `7 * 24` voor een nieuw account.
- `app/server/auth.server.ts`, `getUser`: `if (row.disabledAt) return null;` (na de rolcontrole).
- `app/routes/login.tsx`: na een geldig wachtwoord: `if (row.disabledAt) return { error:
  m.auth.accountDisabled }`. (Pas na de wachtwoordcontrole, dus geen opsomming van accounts.)
- `app/routes/admin.users.tsx`, nieuwe intents (alle alleen eigenaar → anders `ownerOnly`; nooit op
  zichzelf → `selfAction`):
  - `createAccount`: `name` (verplicht), `email` (verplicht, `z.string().email()`, niet in gebruik →
    `emailTaken`), `role` (`isRole`), `passwordMode` (`link` | `password`). `link` →
    `createUser({ passwordHash: NO_PASSWORD })` + `createPasswordReset(id, 168)` → geeft
    `{ setPasswordLink }` terug. `password` → minimaal 10 tekens en gelijk aan `confirm`
    (`m.auth.passwordTooShort`/`passwordMismatch`) → `createUser({ passwordHash:
    hashPassword(pw) })` → `{ accountCreated: true }`. Het wachtwoord gaat nooit terug naar de
    client.
  - `setPassword`: `userId`, `password`, `confirm` → `updateUserPassword` (verhoogt de teller).
  - `deactivate` / `reactivate`: `setUserDisabled`.
  - De bestaande `resetPassword` blijft (voor docenten ook voor gewone beheerders, 18.6).
- Loader: `disabled: Boolean(u.disabledAt)` per gebruiker.

### UI (`admin.users.tsx`, alleen zichtbaar voor de eigenaar)

- Een sectie **"Account aanmaken"** boven de uitnodigingen: naam, e-mail, rol (docent/beheerder),
  een `fieldset` met twee radioknoppen ("Link om zelf een wachtwoord te kiezen" (standaard) / "Ik
  kies een beginwachtwoord"), bij de tweede twee wachtwoordvelden (`autoComplete="new-password"`).
  Na `link`: dezelfde kopieerbare-linkkaart als de herstel-link, met een eigen kop.
- Per gebruiker (niet zichzelf): "Wachtwoord instellen" (een kleine dialoog met twee velden, zoals
  `ConfirmDialog`), "Op non-actief zetten" / "Weer activeren" (een gewone actieknop, geen
  bevestiging nodig: het is omkeerbaar). Een badge "Non-actief" in de lijst, voor iedere
  beheerder zichtbaar.

### i18n (nl + en)

- **Nieuw:** `auth.accountDisabled` ("Dit account staat op non-actief. Neem contact op met de
  beheerder." / "This account is deactivated. Contact your administrator."),
  `admin.invites.createHeading` ("Account aanmaken" / "Create an account"), `createIntro`,
  `createName`, `createEmail`, `createRole`, `createModeLegend`, `createModeLink`,
  `createModePassword`, `createPassword`, `createConfirm`, `createSubmit`,
  `setPasswordLinkHeading` ("Link om een wachtwoord te kiezen"), `setPasswordLinkHint` ("Geef deze
  link zelf door. Hij werkt één keer en 7 dagen lang."), `setPassword` ("Wachtwoord instellen"),
  `setPasswordTitle`, `deactivate` ("Op non-actief zetten" / "Deactivate"), `reactivate` ("Weer
  activeren" / "Reactivate"), `statusDisabled` ("Non-actief" / "Deactivated"), `selfActionError`.

### Tests

- **RED, nieuw:** `tests/api/migration-p18.test.ts` (zoals `migration-p17.test.ts`: alle
  journal-entries in een `:memory:`-database): `it("adds users.disabled_at")`.
- **RED** `tests/api/auth.test.ts`: `it("a deactivated user is logged out everywhere")`,
  `it("login refuses a deactivated account with accountDisabled after a correct password")`,
  `it("login with a wrong password on a deactivated account stays generic")`,
  `it("reactivating restores login but not old cookies")`.
- **RED** `tests/api/admin-routes.test.ts` (blok `admin.users action — owner accounts`):
  - `it("the owner creates an account with a set-password link; no password works before it is used")`.
  - `it("the owner creates an account with an initial password; it is stored hashed")`
    (`passwordHash` begint met `scrypt:` en bevat het wachtwoord niet; inloggen werkt).
  - `it("refuses a taken email, a short password and an unknown role")`.
  - `it("the owner sets a password: old cookies stop, the new password works")`.
  - `it("the owner deactivates and reactivates a user, never themself")`.
  - `it("a regular admin can do none of these (ownerOnly), and nothing changes")`.
- `tests/components/admin-users.test.tsx`: `it("shows the create form only to the owner")`,
  `it("shows the password fields only when 'initial password' is chosen")`,
  `it("marks a deactivated user")`; axe met het formulier open.
- `tests/components/login.test.tsx`: de nieuwe melding wordt getoond.

### Docs (zelfde PR)

- `wiki/Authentication.md`: de sectie **"Password reset — not built (by design)"** is verouderd
  (er is een herstel-link sinds P4). Vervang hem door "Wachtwoorden en accounts": herstel-link,
  direct aanmaken, wachtwoord instellen, non-actief; geen e-mail (een maildienst is een nieuwe
  dienst, alleen met akkoord van Bastiaan).
- `AGENTS.md`: de bullet **Sessions (P17)**: `sessionVersion` stijgt bij een nieuw wachtwoord **en**
  bij op non-actief zetten; `getUser` weigert ook `disabledAt`. De bullet **Account removal (P17)**:
  "There is no removal request and no `disabledAt` state any more" vervangen door de nieuwe stand.
- `wiki/Deployment.md`: niets nodig (niet destructief); noem in de PR dat de migratie bij de start
  draait.

### Klaar als

- [ ] RED-tests eerst rood, nu groen; poort groen.
- [ ] `grep -rn "passwordHash" app/routes` toont nergens een wachtwoord dat terug naar de client gaat.
- [ ] Handmatig: een account maken met link, de link openen, wachtwoord kiezen, inloggen; een account
      op non-actief zetten terwijl het ingelogd is → bij de volgende klik uitgelogd; weer activeren →
      opnieuw inloggen werkt.
- [ ] Screenshots: het aanmaakformulier (beide manieren), de linkkaart, de badge "Non-actief", NL en
      EN, desktop en mobiel.

---

## 18.8 — Opruimen: slapende tabellen, kolommen en docs (PR 8)

**Doel:** de tabellen `chat_sessions`, `messages`, `projects`, de kolommen van de weggehaalde poorten
en de verouderde instellingssleutels verdwijnen; de documentatie klopt weer. Destructieve migratie op
de live database. **Branch:** `p18-8-drop-dormant-tables`.

### Wat leest ze nog (gecontroleerd op `main`, 2026-11-03)

- `projects`: nooit in geschreven (`git log -S "insert(projects)"` is leeg). Alleen schema en het
  type `ProjectRow`. De pagina Projecten leest `generations`.
- `chat_sessions`/`messages`: alleen `deleteUserCascade` en `tests/api/delete-account.test.ts`. Er
  werd in geschreven van 2026-07-05 (P6/P7) tot 17.1. In hetzelfde verzoek schreef `api.stream`
  het transcript ook naar `generations` (`upsertChatGeneration`, sinds dezelfde commit), dus het
  werk van de docent staat daar. Toch: tel vooraf (zie *Risico's* punt 1).
- `generations.project_id`: geen aanroeper geeft `projectId` mee.
- `users.allowed_tool_slugs`, `invites.allowed_tool_slugs`: niet meer gelezen na 18.2.

### Schema (`app/server/schema.server.ts`)

- Weg: tabellen `projects`, `chatSessions`, `messages` en de types `ProjectRow`, `ChatSessionRow`,
  `MessageRow`; kolommen `users.allowedToolSlugs`, `invites.allowedToolSlugs`,
  `generations.projectId`.
- Daarna: de `null`-opvulling uit `createUser`/`createInvite` (18.2), `projectId` uit
  `app/server/repositories/generations.server.ts` (input en `existing?.projectId`), en het
  chatdeel uit `deleteUserCascade` (plus de imports `chatSessions`, `messages`, `inArray` als
  ongebruikt). Werk het doc-commentaar van `deleteUserCascade` bij.

### Migratie

1. `npm run db:generate`. Controleer: alleen `DROP TABLE` en `ALTER TABLE … DROP COLUMN`, geen
   herbouw van `users`/`invites`/`generations`.
2. Zet **bovenaan** dezelfde `.sql`, elke regel met `--> statement-breakpoint`:

   ```sql
   -- P18 (BESLUIT-2026-11-03-15, -17): drop retired per-teacher access keys and open admin invites.
   DELETE FROM `instance_settings` WHERE `key` = 'enabledCountries' OR `key` LIKE 'assignedCountries:%' OR `key` LIKE 'assignedSectors:%' OR `key` LIKE 'assignedDomains:%' OR `key` LIKE 'contextCustomAccess:%';
   DELETE FROM `invites` WHERE `role` <> 'teacher' AND `used_by_user_id` IS NULL;
   ```

   `assignedModels:%`, `enabledModels`, `enabledSectors`, `enabledDomains` en `ownerUserId` blijven.
3. Raak `drizzle/meta/*_snapshot.json` niet met de hand aan.

### Tests

- **RED, uitbreiden:** `tests/api/migration-p18.test.ts`: voer de entries uit tot en met de
  18.7-migratie, zet klaar: een docent met een generatie, een `chat_sessions`-rij met `messages`, een
  `projects`-rij, `allowed_tool_slugs` op docent en uitnodiging, de vijf soorten oude sleutels,
  `assignedModels:<id>`, `enabledModels`, `ownerUserId`, een open docent- en een open
  beheerdersuitnodiging. Voer dan de latere entries uit.
  - `it("drops chat_sessions, messages and projects")`.
  - `it("drops the retired columns")` (`PRAGMA table_info`).
  - `it("removes the retired settings keys and keeps the live ones")`.
  - `it("removes open admin invites and keeps the open teacher invite")`.
  - `it("keeps every generation of the teacher")`.
- **Aanpassen:** `tests/api/delete-account.test.ts` (het chatcascadegeval weg) en elke test die nog
  `allowedToolSlugs` in een rij-literal zet (`npm run typecheck` vindt ze). De directe inserts uit
  18.2 (`allowedToolSlugs` klaarzetten om te bewijzen dat hij genegeerd wordt) gaan weg; de
  bestandscontroles in `tests/p18-removed.test.ts` blijven als bewaking.

### Docs (waarheidsronde, zelfde PR)

- `AGENTS.md`: *Repositories & the DB seam* zonder de verdwenen tabellen; zoek met grep naar
  `P12`, `P13`, `P14`, `intersect`, `custom access`, `allowed_tool_slugs`, `chat_sessions`,
  `/admin/invites` en werk elke rest bij. Ook *Key Files* en *Quick Ref* waar nodig.
- `wiki/Architecture.md`, `wiki/Context-Model.md`, `wiki/Roadmap.md`, `wiki/Authentication.md`,
  `docs/Tenancy-and-Admin.md`: één keer nalezen op resten van P12/P13/P14, het land als keuze,
  "Bekijk als docent" en de oude pagina's.
- `wiki/Deployment.md`: de sectie "Back-up vóór een destructieve migratie" (uit 17.3) noemt deze
  migratie als voorbeeld.
- `docs/implementation/README.md`: P18 ✅ met de merge-commit; het bord.

### Klaar als

- [ ] De migratietest faalde eerst en is nu groen; poort groen.
- [ ] `grep -rni "chatSessions\|chat_sessions\|projects\b.*sqliteTable\|allowedToolSlugs\|projectId" app`
      geeft niets meer.
- [ ] Lokaal geprobeerd op een **kopie** van een database in de stand vóór deze migratie (geen
      pilotdata in de repo): de app start, een docent ziet zijn werk in Projecten.
- [ ] PR-beschrijving, *Wat Bastiaan moet beslissen*: het moment van uitrollen, de back-up vooraf,
      hoe lang die bewaard blijft, en de uitkomst van de telling uit *Risico's* punt 1.

---

## Risico's

1. **Destructieve migratie (18.8) op de live database** (`data/limeonit.db` op Bastiaans Mac; de app
   migreert automatisch bij de start). Zelfde checklist als 17.3:
   - **Vooraf:** stop de app (`npm run dev` afbreken). Tel:
     `SELECT COUNT(*) FROM chat_sessions; SELECT COUNT(*) FROM messages; SELECT COUNT(*) FROM
     projects; SELECT role, COUNT(*) FROM users GROUP BY role;`. Maak een back-up:
     `sqlite3 data/limeonit.db ".backup data/limeonit-voor-p18.db"` (of kopieer `limeonit.db`
     **plus** `-wal` en `-shm`). Die naam valt onder `/data/*.db` in `.gitignore`, dus hij komt
     nooit in git.
   - **Daarna:** start de app, tel opnieuw (`generations` gelijk, gebruikers gelijk), een docent
     logt in en ziet zijn werk.
   - **Terugdraaien** = de app stoppen, de back-up terugzetten, de vorige commit uitchecken.
   - De back-up bevat oude chattranscripten. Verwijder hem na een door Bastiaan gekozen termijn.
2. **Docenten met een oude uitzondering (18.2).** Wie een tool-allowlist had, ziet daarna **meer**
   tools; wie aangepaste contexttoegang had die **ruimer** was dan de instelling, ziet daarna
   **minder** sectoren of domeinen. Een bestaand profiel blijft werken in de tools, maar opnieuw
   opslaan kan dan weigeren. Controleer vóór het uitrollen:
   `SELECT COUNT(*) FROM users WHERE allowed_tool_slugs IS NOT NULL;` en
   `SELECT key, value_json FROM instance_settings WHERE key LIKE 'contextCustomAccess:%' OR key LIKE
   'assigned%';`. Is er iets, zet dan eerst de instelling ruim genoeg op `/admin/context`.
3. **Geen eigenaar tussen merge en `set-owner` (18.6).** Dan kan niemand rollen wijzigen. Kort
   houden: `set-owner` meteen na de merge draaien.
4. **Lokale modellen weg bij `npm start`.** Draait de pilot ooit met `npm start` of Docker, dan zijn
   Ollama en de CLI-agents weg. Dat is de bedoeling (vast besluit 6). Een docent met **alleen** een
   lokaal model in zijn eigen set valt dan terug op de instelling.
5. **Autosave en snel klikken (18.5).** Meerdere verzoeken achter elkaar; het laatste wint, omdat
   elk verzoek de hele stand van zijn formulier stuurt. Meerdere toasts kunnen kort na elkaar
   verschijnen; dat is aanvaardbaar.
6. **Gewone beheerders verliezen iets (18.6).** Vandaag kan elke beheerder een andere beheerder
   een herstel-link sturen, zijn e-mail wijzigen of hem verwijderen. Dat wordt alleen-eigenaar,
   omdat het anders een omweg is om een beheerdersaccount (ook dat van de eigenaar) over te nemen.
   Bij docenten blijft alles zoals het is.
7. **Samenloop met P19.1.** Zie boven: geen tooltitels in beheertests.

## Buiten bereik

- V3 / P19: toolnamen (ook de vindbaarheid van 'Beoordelingsassistent — stage & afstuderen'), de
  badges "Student" / "Voor studenten", het hoofdmenu.
- E-mail versturen (uitnodigingen, wachtwoordlinks): vraagt een maildienst, dus een nieuwe
  dependency of betaalde dienst; alleen met akkoord van Bastiaan.
- Meerdere eigenaars, eigendom overdragen via de UI, een auditlog van beheeracties.
- Flash-toasts na een redirect (P16).
- Een tweede land of een land-UI. De seam blijft (vast besluit 4).

## Acceptatie

`npm test && npm run typecheck && npm run check` zijn groen na elk PR.

Handmatig nalopen na 18.8, op de Mac met `npm run dev`:

1. `/admin` opent **Gebruikers**; het menu heeft vier items; er is geen "Bekijk als docent".
2. Een tool uitzetten op **Tools en modellen**: één melding "Opgeslagen.", geen knop; de tool is weg
   voor iedereen.
3. Een docent krijgt op **Gebruikers** een eigen modelset met een model dat de instelling uit heeft:
   hij kan het kiezen; terug naar "Volgt de instelling": weg.
4. Ollama en de CLI-agents staan in het menu met `npm run dev`, niet met `npm start`.
5. **Onderwijscontext** toont alleen sectoren en domeinen; de contexteditor toont geen land.
6. Als superbeheerder: een account maken met link en met beginwachtwoord, een docent promoveren tot
   beheerder, een account op non-actief zetten (de gebruiker is direct uitgelogd) en weer activeren.
   Als gewone beheerder: geen rolkeuze, geen acties op beheerders, geen aanmaakformulier.
7. `npm run invite -- --role admin` weigert. Een oude beheerdersuitnodiging is ongeldig.
