# Fase 19 — Vereenvoudiging V3: de docentkant

> **Zo voer je deze brief uit:** open hem in een verse sessie en voer **één** deelfase uit per
> sessie, test-first volgens `AGENTS.md` / de `/tdd`-skill. Elke deelfase is **één PR met één doel**,
> in de volgorde van *Volgorde en samenloop*. Schrijf eerst de RED-tests die bij de deelfase staan,
> zie ze falen om de goede reden, en maak ze dan groen. Poort per PR: `npm test && npm run typecheck
> && npm run check`. Branch vanaf `main`. Merge nooit zelf; alleen Bastiaan merget. **Hangt af van:**
> P17 (gemerged). 19.5 en 19.6 hangen ook af van **P18.1, 18.2 en 18.4** (zie *Volgorde en
> samenloop*). **Lees eerst *Wat Bastiaan moet beslissen*:** zijn drie keuzes zijn vastgelegd (BESLUIT-2026-11-04-1 t/m -3).

## Context en doel

V1 (P17) haalde de studentenlaag weg, V2 (P18) maakt het beheer eenvoudiger. V3 doet hetzelfde voor
wat een **docent** ziet. Bastiaan wil: *"Haal weg wat overbodig is. Als we het op een eenvoudigere en
efficiëntere en doeltreffendere manier kunnen bouwen, dan ben ik daar een voorstander van."*
(BESLUIT-2026-11-03-6). Het doel van V3 is door hem goedgekeurd:

1. **Toolnamen: taak eerst, boeknaam als ondertitel** — stap 19.1, **klaar** (BESLUIT-2026-11-03-18).
2. **Het menu:** minder items, duidelijke woorden.
3. **De toolpagina:** eerst de taak; de techniek (model, "redeneren", technische opties) achter één
   uitklapknop **"Geavanceerd"**.
4. **Een kort contextformulier:** alleen de velden die er het meest toe doen; de rest optioneel en
   ingeklapt.
5. **Lege pagina's die sturen:** zeg wat de docent nu kan doen, met één duidelijke actie.
6. **Resten van P17:** de badges "Docent" / "Student", het filter "Voor studenten" en andere
   doelgroeplabels. De zes tutors zijn tools waarmee docenten **zelf** leren
   (BESLUIT-2026-11-03-4); een label "Student" klopt daar niet meer. P17 zette dit expliciet op V3
   (P17 *Vaste besluiten* 1, *Wat blijft*, *Risico's* 6 en *Buiten bereik*).
7. **Weg wat overbodig is:** een inventaris van de docentkant met concrete schrappingen (hieronder).

**Doel:** na P19 heeft het menu van een docent vier woorden die zeggen wat erachter zit, opent een
tool met de taak, staat de techniek achter "Geavanceerd", maakt een docent een onderwijscontext in
één korte pagina, en zegt elke lege pagina wat de volgende stap is. Nergens staat nog "Student" als
label op een tool.

## Vaste besluiten

1. **`Tool.userType` blijft tooldata.** Het zegt tot wie de tool spreekt en stuurt de
   niveau-instructie in de stream (`audience: "learner"` in `app/routes/api.stream.tsx`). Dat blijft
   precies zo. Alleen de **labels** in de docent-UI verdwijnen. `GOALS[…].audience` in
   `app/lib/registry/goals.ts` stuurt alleen kleur en badge op de startpagina en gaat weg.
2. **De tutorprompts blijven ongewijzigd.** Ze spreken de gebruiker aan als lerende, en dat is gewenst
   (P17 *Risico's* 6). Een prompt aanpassen vraagt een eval-meting, en de nulmeting is nog nooit
   gedraaid (`STATUS.md`, *Later*).
3. **"Geavanceerd" is één bouwsteen**, `app/components/AdvancedSettings.tsx`: een native
   `<details>`/`<summary>` (toetsenbord en uitklapstand zitten erin; geen eigen ARIA nodig). Hij is
   **standaard dicht**, onthoudt niets (geen `localStorage`), en de samenvattingsregel toont het
   gekozen model, zodat niets stil verstopt is. Er staat in: het model, en bij een model dat het
   ondersteunt de schakelaar "Redeneren vóór antwoord". **Taal van uitvoer is geen techniek** en
   blijft zichtbaar. Is er maar één model en geen redeneerschakelaar, dan valt "Geavanceerd" weg: er
   valt niets te kiezen.
4. **Lege toestanden zijn één bouwsteen**, `app/components/EmptyState.tsx`: icoon, kop, één zin en
   **één** actie (een link of een knop). Geen live regio: het is vaste inhoud, geen melding (de
   P15-regel in `AGENTS.md` blijft gelden).
5. **Het contextformulier wordt één pagina**, zonder de vier stappen en zonder de samenvattingsstap.
   Wat ingeklapt staat, zit in een native `<details>`: de velden blijven in het formulier en worden
   altijd meegestuurd. De veldnamen en `app/lib/context/parseForm.ts` veranderen **niet**; de server
   valideert zoals na P18.
6. **Het eerste contextprofiel wordt vanzelf standaard.** Chattools gebruiken alleen het
   standaardprofiel (`tool.tsx` geeft `ChatView` het profiel met `defaultProfileId`). Een docent die
   één profiel maakt en het vinkje vergeet, krijgt nu geen context in een tutor. Regel: heeft de
   docent nog geen standaardprofiel, dan wordt een nieuw profiel standaard.
7. **URL's blijven Engels** (BESLUIT-2026-06-1): `/projects` blijft `/projects`, ook als het menu
   "Mijn werk" zegt.
8. **Alle nieuwe tekst in NL en EN.** Ontwikkeldocumentatie Nederlands, code en commentaar Engels
   (BESLUIT-2026-11-03-1). De teksten in deze brief zijn voorstellen; Bastiaan ziet ze in de
   screenshots van de PR.

## Wat blijft (niet aanraken)

- De 15 tools, hun prompts, ids, slugs, `Tool.name`/`Tool.subtitle` uit 19.1, `userType` en de
  doelen-indeling (`TOOL_GOALS`).
- Op de toolpagina: de knop "Onderbouwing & bron" met theorie, bron, de originele prompt (CC BY) en
  de hulp; de AI-melding (`AiNotice`).
- `/account`, `/help`, `/legal`, `/cookies`, de taalknop, de toasts, de skip link en de
  route-aankondiger uit P15.
- Alles in `/admin` (dat is P18). Ook het `userType`-label in de toolstabel van beheer blijft: daar
  is het beheerinformatie.
- De contextdata: `ContextProfile`, `format.ts`, de packs, EQF.

---

## Inventaris: weg wat overbodig is

De docentkant op `main` (2026-11-03), met per onderdeel het voorstel. **Vast** = valt onder het
goedgekeurde doel. **Besloten (BESLUIT-2026-11-04-1 t/m -3)** = productkeuze, zie *Wat Bastiaan moet beslissen*.

| Waar | Wat er nu is | Voorstel | Status | Stap |
| --- | --- | --- | --- | --- |
| Startpagina `home.tsx` | Filter "Alle / Voor docenten / Voor studenten" | Weg | Vast (P17 → V3) | 19.2 |
| Startpagina | Badge "Docent" / "Student" bij elk doel, elke kaart en elke rij; goud voor tutors, paars voor de rest | Weg; één kleur | Vast | 19.2 |
| Startpagina | Doelen "Begeleiden & coachen" en "Samen denken & bevragen" beschrijven tutors die je *voor studenten inzet* | Tekst: de docent leert zelf | Vast | 19.2 |
| Startpagina | Typefilter "Alle types / Generators / Chatbots" | Weg; zoeken en de doelen volstaan | Besloten (BESLUIT-2026-11-04-1) | 19.2 |
| Startpagina | Knop raster/lijst (alleen bij zoekresultaten) | Weg; altijd raster | Besloten (BESLUIT-2026-11-04-1) | 19.2 |
| Startpagina | Theorieregel onderaan elke kaart, naast de boeknaam uit 19.1 (vaak dezelfde techniek twee keer) | Weg; theorie blijft doorzoekbaar en op de toolpagina | Besloten (BESLUIT-2026-11-04-1) | 19.2 |
| Startpagina en toolpagina | Labels "Generator" / "Chatbot" | Duidelijke woorden: "Formulier" / "Gesprek" | Vast | 19.2 |
| Toolpagina `tool.tsx` | Badge "Docent" / "Student" naast de titel | Weg | Vast | 19.2 |
| Over `about.tsx` | Toollijst gegroepeerd "Voor docenten / Voor studenten" | Toollijst weg (staat al op de startpagina) | Besloten (BESLUIT-2026-11-04-1) | 19.2 |
| Toolpagina | Modelkeuze altijd zichtbaar, boven het formulier | Achter "Geavanceerd", onder de taak | Vast | 19.3 |
| Chat (`ChatView`) | Model en "Redeneren" altijd zichtbaar in de zijkolom | Achter "Geavanceerd" | Vast | 19.3 |
| Chat | De invulkaart vóór het gesprek heet "Onderwijscontext", maar vraagt de toolvelden | Kop "Voordat je begint" | Vast (duidelijke woorden) | 19.3 |
| Mijn werk `projects._index.tsx` | Leeg: één grijze zin | Lege toestand met actie "Kies een tool" | Vast | 19.4 |
| Toolpagina en chat | Geen onderwijscontext: alleen "Geen context" in een lijst, of niets | Korte hint met link "Onderwijscontext instellen" | Vast | 19.4 |
| Menu `AppShell.tsx` | Tools · Projecten · Help · Onderwijscontext · Over (+ Beheer) | Tools · Mijn werk · Onderwijscontext · Help (+ Beheer); "Over" alleen onderaan | Besloten (BESLUIT-2026-11-04-2) | 19.5 |
| Contact `contact.tsx` | Pagina met "wordt nog verder ingevuld" en het e-mailadres dat de footer al toont | Pagina weg; de footer houdt de mailto-link | Besloten (BESLUIT-2026-11-04-2) | 19.5 |
| i18n | Ongebruikte sleutels `nav.viewingAsTeacher`, `home.comingSoon` | Weg | Vast | 19.5 |
| Onderwijscontext `context-profiles.tsx` | Vier stappen plus samenvatting, ± 15 velden | Eén korte pagina; de rest onder "Meer details" | Vast (velden: Besloten (BESLUIT-2026-11-04-3)) | 19.6 |
| Onderwijscontext | Leeg: één grijze zin, formulier pas na een klik | Lege toestand met één actie | Vast | 19.6 |
| Help, legal, cookies, account | — | Blijven | — | — |

Bewust **niet** weg: de footer (CC BY-vermelding en e-mailadres), "Onderbouwing & bron" (bron en
originele prompt horen bij de licentie en bij de AI Act-transparantie, BESLUIT-2026-07-03-4),
`/legal` en `/cookies` (privacy- en gebruiksvoorwaarden zijn nodig, ook al staat er nog weinig).

---

## Volgorde en samenloop

| PR | Titel | Model | Hangt af van |
| --- | --- | --- | --- |
| 19.1 | Toolnamen: taak eerst, boeknaam als ondertitel | — | ✅ gemerged (#18, `30e6b23`) |
| 19.2 | Geen doelgroeplabels meer; startpagina eenvoudiger | Sonnet, gemiddeld | — |
| 19.3 | Toolpagina: taak eerst, techniek achter "Geavanceerd" | Sonnet, gemiddeld | — |
| 19.4 | Lege pagina's die sturen | Sonnet, gemiddeld | 19.3 |
| 19.5 | Menu: minder items, duidelijke woorden | Sonnet, gemiddeld | **18.1, 18.2 en 18.4 gemerged**; 19.4; Besloten (BESLUIT-2026-11-04-2) |
| 19.6 | Kort contextformulier | Sonnet, hoog | **18.2 en 18.4 gemerged**; 19.4; Besloten (BESLUIT-2026-11-04-3) |

**Waarom deze volgorde.** De bouw-PR's van V2 (18.1 t/m 18.8) landen één voor één op `main`. Twee
daarvan raken dezelfde bestanden als V3:

- **18.2** haalt de land-as en de toegang per docent uit de contexteditor
  (`context-profiles.tsx`, `ContextProfileEditor.tsx`, `ContextFields.tsx`, `parseForm.ts`).
- **18.4** zet beheer om naar `/admin/users`, `/admin/tools`, `/admin/context` en `/admin/usage`; en
  **18.1** haalt "Bekijk als docent" (`RoleSwitch`) uit `AppShell.tsx`.

Daarom:

- **19.5 (raakt `AppShell.tsx`) en 19.6 (raakt `context-profiles.tsx`) starten pas als 18.2 en 18.4
  gemerged zijn** (en 18.1, die eerder landt). Controleer dat vóór je begint met
  `git log origin/main --oneline | grep -E "P18\.(1|2|4)|p18-(1|2|4)"`, of kijk in
  `docs/implementation/README.md`. Wijkt `main` af van de P18-brief, dan wint de code op `main`
  (*rangorde van waarheid* in `CLAUDE.md`); de intentie van deze stap blijft.
- **19.2, 19.3 en 19.4 kunnen nu al**, naast P18. Ze raken geen bestand dat P18 herschrijft:
  - 19.2 raakt in `home.tsx` en `tool.tsx` alleen de **componenten** (`Home`, `GoalSections`,
    `ToolCard`, `ToolRow`, `ToolHeader`). P18.1 en 18.3 wijzigen de **loaders** van die bestanden.
    Raak de loaders niet aan; geeft een rebase toch een conflict in de imports of de loader, neem dan
    die van `main`.
  - 19.3 en 19.4 raken `ToolControls.tsx`, `GeneratorView.tsx`, `ChatView.tsx`,
    `StageStepper.tsx` (alleen als nodig) en `projects._index.tsx`. P18 raakt die niet. 18.3 verandert
    welke modellen binnenkomen (de props), niet hoe ze getoond worden.
- **19.2 en 19.3 kunnen tegelijk** (andere bestanden), binnen de WIP-limiet van twee werkers uit
  `voorkeuren.md`. P18 heeft voorrang; de Producer kiest.
- **19.5 en 19.6 kunnen tegelijk.** Ze delen alleen `app/lib/i18n/messages/{nl,en}.ts`, in andere
  namespaces (`nav`/`projects`/`pages` tegenover `settings`). Wie later merget, neemt de andere
  namespace van `main` over.
- **Samenloop met P20.** P20 voegt een menu-item "Cursussen" toe naast "Projects" en koppelt werk
  vanuit `/projects`. Na 19.5 heet dat menu-item "Mijn werk"; de route blijft `/projects`. Wie P20
  uitvoert, zet "Cursussen" naast "Mijn werk" en past de AppShell-test van 19.5 aan (vijf items).

---

## 19.1 — Toolnamen: taak eerst, boeknaam als ondertitel (klaar)

Gemerged als PR #18 (`30e6b23`), besluit BESLUIT-2026-11-03-18. Elke tool heet naar de taak
(bijvoorbeeld 'Stageverslag of afstudeerwerk beoordelen'); de boek- of technieknaam staat klein
eronder (`Tool.subtitle`, `app/components/ToolTitle.tsx`). Slugs, ids en prompts bleven gelijk.
Tests: `tests/tool-names.test.ts`, `tests/components/ToolTitle.test.tsx`, het subtitelgeval in
`tests/components/Home.test.tsx`. Niets meer te doen.

---

## 19.2 — Geen doelgroeplabels meer; startpagina eenvoudiger (PR 2)

**Doel:** nergens in de docent-UI staat nog "Docent" of "Student" als label op een tool. De
startpagina heeft een zoekveld en de doelen, en niets wat dubbel is. **Branch:**
`p19-2-no-audience-labels`.

Punten met **Besloten (BESLUIT-2026-11-04-1)** zijn vastgelegd: Bastiaan koos de aanbeveling (BESLUIT-2026-11-04-1).

### Startpagina (`app/routes/home.tsx`, alleen componenten)

- Weg: `AudienceFilter`, de state `audience`, `counts`, de `Segmented` met `t.home.a11y.audience`, en
  de voorwaarde op `audience` in `results` en `isFiltered`.
- Weg: `Badge` (de functie) en elk gebruik ervan in `GoalSections`, `ToolCard` en `ToolRow`; de prop
  `showAudience`. Weg: `isStudent` in `GoalSections` en `ToolRow`; alles krijgt de paarse stijl
  (`bg-violet-50 text-violet-600`, hover `border-violet-200`).
- `toolAria`: zonder doelgroep → `` `${open}: ${naam}. ${soort}. ${tagline}` ``.
- De loader blijft **onaangeroerd** (zie *Samenloop*): `userType` mag in het loaderresultaat blijven
  staan; de component leest het alleen niet meer.
- **Besloten (BESLUIT-2026-11-04-1)** Weg: het typefilter (`TypeFilter`, state `type`, de tweede `Segmented`), en daarmee de
  hele `Segmented`-functie als hij ongebruikt is.
- **Besloten (BESLUIT-2026-11-04-1)** Weg: de raster/lijst-knop (`ResultView`, `resultView`, `chooseView`, het
  `localStorage`-item `ec-result-view`, `ViewButton`, `ToolRow`). Zoekresultaten tonen altijd het
  raster (`ToolGrid` + `ToolCard`).
- **Besloten (BESLUIT-2026-11-04-1)** Weg: de theorieregel onderaan `ToolCard` (het `BookOpen`-icoon met
  `tool.theory`). `theory` blijft in de zoektekst (`search`).

### Doelen (`app/lib/registry/goals.ts`)

- Weg: het veld `audience` uit `Goal` en uit de vijf doelen; de import van `UserType` als die
  ongebruikt raakt. Het kopcommentaar zegt niet meer "whose work this goal serves".
- Nieuwe tekst (NL / EN):
  - `coach.name`: "Zelf leren met een coach" / "Learn with a coach".
  - `coach.blurb`: "Oefen zelf met een AI-leermaatje dat je stap voor stap begeleidt, bijvoorbeeld
    voor je BDB of BKE." / "Practise with an AI study companion that guides you step by step, for
    example for a teaching qualification."
  - `discuss.blurb`: "Denk dieper na over je vak en je onderwijs, met een AI-gesprekspartner die
    doorvraagt." / "Think more deeply about your subject and your teaching, with an AI partner that
    keeps asking questions."
  - `discuss.name` en de andere drie doelen blijven.

### Toolpagina (`app/routes/tool.tsx`, alleen `ToolHeader`)

- Weg: de `<span>` met `t.badge.instructor` / `t.badge.student` naast de `h1`.

### Over (`app/routes/about.tsx`)

- **Besloten (BESLUIT-2026-11-04-1)** Weg: de sectie "Beschikbare tools" (`groups`, de `h2` met `t.about.toolsHeading`) en
  de `tools` in de loader; de loader houdt alleen `requireUser`.

### Woorden voor de soort tool

- `home.mode.generator`: "Formulier" / "Form"; `home.mode.chatbot`: "Gesprek" / "Chat".
- `home.a11y.generator`: "formulier" / "form"; `home.a11y.chatbot`: "gesprek" / "chat".

### i18n (nl + en)

- **Weg:** de hele namespace `badge`; `home.filterAll`, `home.instructor`, `home.student`,
  `home.a11y.audience`.
- **Besloten (BESLUIT-2026-11-04-1), weg:** `home.allTypes`, `home.generators`, `home.chatbots`, `home.a11y.type`,
  `home.a11y.resultView`, `home.a11y.grid`, `home.a11y.list`, `about.toolsHeading`.
- Controleer met `grep -rn "t\.badge\|home\.student\|home\.instructor" app` dat er niets overblijft.
  `admin.tools.audienceStudent` / `audienceInstructor` **blijven** (beheer, zie *Wat blijft*).

### Help (zelfde PR)

- `app/content/help/topics/getting-started.{nl,en}.md`, stap 1: "**Kies een tool.** Op de
  startpagina staan alle tools, per doel. Zoek op wat je wilt doen, bijvoorbeeld *rubric* of
  *motivatie*." / "**Choose a tool.** The start page lists every tool by goal. Search for what you
  want to do, for example *rubric* or *motivation*."

### Tests

- **RED, gewijzigd:** `tests/components/Home.test.tsx`:
  - `it("offers no audience filter")`: geen knop met naam `Voor studenten` of `Voor docenten`, geen
    groep met naam `Filter op publiek`.
  - `it("shows no audience badge on goals or cards")`: `queryByText("Student")` en
    `queryByText("Docent")` zijn `null`.
  - `it("keeps the audience out of a card's accessible name")`: de link naar MentorAI heeft een naam
    zonder `Student`.
  - `it("labels the kind of tool in plain words")`: de kaart van MentorAI toont `Gesprek`, die van
    Begeleide reflectie `Formulier`.
  - **Besloten (BESLUIT-2026-11-04-1)** `it("offers no type filter and no grid/list switch")`: geen knop `Chatbots`, geen
    knop `Lijst`.
  - **Besloten (BESLUIT-2026-11-04-1)** `it("does not repeat the theory under a card")`:
    `queryByText("Science of Learning", { exact: true })` is `null` (de fixture van Cognitive
    Architect heeft geen subtitel, dus die tekst staat alleen in de theorieregel).
  - Herschrijven: `"collapses to a flat result list when a filter is applied"` →
    `it("collapses to a flat result list when searching")`: typ `mentor`, verwacht `1 tool`, de knop
    `Terug naar doel-weergave` en de link naar MentorAI.
  - De axe-check blijft.
- **RED, nieuw:** `tests/components/ToolPage.test.tsx` (happy-dom): render de default export van
  `~/routes/tool` met `createRoutesStub` en een `loaderData` met `getToolBySlug("mentorai")!` en
  `getToolBySlug("guided-reflection")!` (lege `profiles`, `verbatim`, `localModels`,
  `catalogModels`, `helpOverlay: null`). `it("shows no audience badge next to the title")`
  (geen `Student`/`Docent`), en een axe-check (color-contrast uit, zoals in `Home.test.tsx`).
  Lees de titels uit het register, hardcode ze niet.
- **RED, gewijzigd:** `tests/goals.test.ts`: de controle op `goal.audience` in `"every goal has NL +
  EN name and blurb"` gaat eruit; `"a goal's audience matches every tool filed under it"` wordt
  `it("goals carry no audience")`: `"audience" in goal` is `false` voor elk doel.
- **RED, gewijzigd:** `tests/components/About.test.tsx`: `"groups tools by audience instead of
  phase"` wordt **Besloten (BESLUIT-2026-11-04-1)** `it("lists no tools (the start page does)")`. De
  axe-check blijft.
- **Ongewijzigd groen:** `tests/api/stream.test.ts` (de stream leest `userType` nog), `tests/i18n.test.ts`.

### Klaar als

- [ ] RED-tests eerst rood, nu groen; poort groen.
- [ ] `grep -rn "badge\.\|isStudent\|goal\.audience\|home\.student" app` geeft niets meer.
- [ ] `api.stream.tsx` regel met `tool.userType === "student" ? "learner" : "instructor"` is
      onveranderd.
- [ ] Screenshots van de startpagina (doelen en een zoekresultaat), een tutorpagina en `/about`: NL en
      EN, desktop en mobiel.
- [ ] PR-beschrijving, *Wat Bastiaan moet beslissen*: de teksten van de twee doelen; en dat de keuze van BESLUIT-2026-11-04-1 is gebouwd.

---

## 19.3 — Toolpagina: taak eerst, techniek achter "Geavanceerd" (PR 3)

**Doel:** een docent ziet op een toolpagina eerst wat hij moet invullen. Model en "redeneren" staan
achter één dichte knop "Geavanceerd", die zegt welk model gekozen is. **Branch:**
`p19-3-advanced-disclosure`.

### Bouwsteen

Nieuw: `app/components/AdvancedSettings.tsx`, een diepe module met een smalle interface:

```tsx
<AdvancedSettings current={selectedModelName}>
  {/* model-select, eventueel de redeneerschakelaar */}
</AdvancedSettings>
```

- Rendert `<details className=…><summary>{t.tool.advanced}<span>{current}</span></summary>…</details>`.
  Standaard dicht (geen `open`). De `current`-tekst staat in de `summary` met een rustige kleur, zodat
  een schermlezer "Geavanceerd, Claude Sonnet 5.5" hoort.
- Focusstijl op de `summary` (`focus-visible:ring-2 ring-violet-500`), een chevron die draait als hij
  open is (`group-open:rotate-180`, met `aria-hidden`).
- Geen eigen state, geen `localStorage`.

### Toolcontroles (`app/components/ToolControls.tsx`)

- De props blijven gelijk (`GeneratorView` en `StageStepper` hoeven niets door te geven).
- Zichtbaar: **Onderwijscontext** (als `usesContextProfile`) en **Taal van uitvoer**, in een raster
  van twee kolommen (`sm:grid-cols-2`).
- In `<AdvancedSettings current={naam van het gekozen model}>`: de modelselect.
- `models.length <= 1` → geen `AdvancedSettings` en geen modelselect. Het model staat dan al goed
  (`initialPickerModel` in de ouder).

### Formulier eerst (`app/components/GeneratorView.tsx`)

- Volgorde in de linkerkolom: `DynamicForm` → `ToolControls` → de knop Genereer → de foutmelding.
- Het voorinvullen uit het profiel (`useSandbox`, `selectProfile`) blijft werken: kiest de docent na
  het typen een ander profiel, dan worden alleen de velden met `prefillFromProfile` opnieuw afgeleid
  (zoals nu).
- `StageStepper.tsx`: de plek van `ToolControls` blijft boven de fasen (de keuze geldt voor alle
  fasen); het model gaat vanzelf achter "Geavanceerd" via `ToolControls`.

### Chat (`app/components/ChatView.tsx`)

- Zijkolom "Jouw instellingen": de samenvatting en de knop Aanpassen blijven bovenaan; **Taal van
  uitvoer** blijft zichtbaar; de modelselect (`chat-model`) en de redeneerschakelaar
  (`chat-thinking`) gaan samen in `<AdvancedSettings current={…}>`. Zelfde regel: één model en geen
  redeneren → geen "Geavanceerd".
- De invulkaart vóór het gesprek: de kop wordt `t.chat.setupHeading` in plaats van
  `t.tool.contextProfile` (die kaart vraagt de toolvelden, niet de onderwijscontext).

### i18n (nl + en)

- **Nieuw:** `tool.advanced` ("Geavanceerd" / "Advanced"), `chat.setupHeading` ("Voordat je begint" /
  "Before you start").
- **Nieuwe tekst:** `chat.sandboxHint`: "Vul dit één keer in. Daarna begint het gesprek." / "Fill
  this in once. Then the conversation starts."

### Tests

- **RED, nieuw:** `tests/components/AdvancedSettings.test.tsx`:
  - `it("is closed by default and names the current choice in its summary")`: de `details` heeft geen
    `open`; de `summary` bevat `Geavanceerd` en de `current`-tekst.
  - `it("reveals its content when the summary is clicked")`.
  - Axe-check dicht en open.
- **RED, gewijzigd:** `tests/components/ToolControls.test.tsx`:
  - `it("keeps the model picker inside a closed 'Geavanceerd' section")`: de combobox `Model` heeft
    een voorouder `details` zonder `open`.
  - `it("keeps the context and language pickers outside 'Geavanceerd'")`.
  - `it("shows no 'Geavanceerd' when only one model is offered")` (`catalogModels` met één model, geen
    `localModels`).
  - De bestaande gevallen die de modelselect gebruiken (`"reports the chosen model via onModel"` e.a.)
    klikken eerst op `Geavanceerd`. Zo hangen ze niet af van hoe happy-dom een dichte `details`
    behandelt.
  - De axe-check blijft, plus één met "Geavanceerd" open.
- **RED, gewijzigd:** `tests/components/GeneratorView.test.tsx`:
  `it("puts the task fields before the context and model controls")`: het eerste invoerveld van de
  tool staat in de documentvolgorde vóór de select `Onderwijscontext`
  (`compareDocumentPosition` → `DOCUMENT_POSITION_FOLLOWING`). Het ARCS-geval blijft groen.
- **RED, gewijzigd:** `tests/components/ChatView.test.tsx`:
  - `it("keeps model and reasoning inside 'Geavanceerd'; language stays visible")`.
  - `it("titles the one-time setup card 'Voordat je begint'")`.
  - De twee `[thinking]`-gevallen en `"offers the full model list…"` openen eerst "Geavanceerd".
- `tests/components/StageStepper.test.tsx`: alleen aanpassen als een geval de modelselect gebruikt.

### Docs (zelfde PR)

- `AGENTS.md`, *Provider abstraction*: "surfaced as a per-chat toggle in `ChatView`" wordt "surfaced
  as a per-chat toggle inside the 'Geavanceerd' disclosure (`AdvancedSettings`) in `ChatView`".
- `app/content/help/topics/getting-started.{nl,en}.md`, stap 3: één zin "Model en andere techniek
  vind je onder **Geavanceerd**." / "The model and other technical options are under **Advanced**."

### Klaar als

- [ ] RED-tests eerst rood, nu groen; poort groen.
- [ ] Handmatig (`npm run dev`): een generator, Cognitive Architect (vier fasen) en een tutor. Bij
      elk is "Geavanceerd" dicht en toont het het model; genereren en chatten werken; bij een
      Ollama-model met redeneren staat de schakelaar onder "Geavanceerd".
- [ ] Screenshots van een generator en een tutor, "Geavanceerd" dicht en open: NL en EN, desktop en
      mobiel.
- [ ] PR-beschrijving, *Wat Bastiaan moet beslissen*: de wijziging in `AGENTS.md`.

---

## 19.4 — Lege pagina's die sturen (PR 4)

**Doel:** een lege pagina zegt wat er hoort te staan en geeft één actie. **Branch:**
`p19-4-guiding-empty-states`.

"Geschiedenis" bestaat niet als aparte pagina: alle bewaarde resultaten staan op `/projects`. De lege
onderwijscontext komt in 19.6 (die stap herschrijft `context-profiles.tsx` toch). Lege tabellen in
beheer zijn P18.

### Bouwsteen

Nieuw: `app/components/EmptyState.tsx`:

```tsx
<EmptyState
  icon={<FolderOpen aria-hidden />}
  title={t.projects.emptyTitle}
  body={t.projects.emptyBody}
  action={{ to: "/tools", label: t.projects.emptyAction }}   // of { onClick, label }
/>
```

- Een `section` met een `h2` (de paginakop blijft de `h1`), één alinea en één actie: een `Link` in de
  stijl van de primaire knop, of een `Button` bij `onClick`. Gestippelde rand, zoals de lege
  resultaatkolom in `GeneratorView`.
- Geen `role="status"` en geen `aria-live` (vast besluit 4).

### Mijn werk (`app/routes/projects._index.tsx`)

- `generations.length === 0` → `<EmptyState>` met een link naar `/tools`, in plaats van de grijze
  zin `t.projects.empty`.

### Toolpagina zonder onderwijscontext

- `ToolControls.tsx`: is `usesContextProfile` waar en `profiles.length === 0`, dan staat onder de
  contextselect een korte hint met een link: `t.tool.noProfileHint` + `Link` naar
  `/context-profiles` met `t.tool.noProfileAction`. De select zelf blijft (met "Geen context").
- `ChatView.tsx`: is `tool.usesContextProfile` waar en `contextProfile` `null`, dan staat in de
  zijkolom onder de samenvatting dezelfde soort hint: `t.chat.noProfileHint` + link
  `t.tool.noProfileAction`.

### i18n (nl + en)

- **Nieuw:**
  - `projects.emptyTitle`: "Nog geen werk bewaard" / "Nothing saved yet".
  - `projects.emptyBody`: "Alles wat je met een tool maakt, komt hier vanzelf te staan. Je kunt het
    teruglezen, kopiëren, exporteren en verwijderen." / "Everything you make with a tool appears here
    automatically. You can read it again, copy, export and delete it."
  - `projects.emptyAction`: "Kies een tool" / "Choose a tool".
  - `tool.noProfileHint`: "Nog geen onderwijscontext. Daarmee past het resultaat beter bij je les." /
    "No teaching context yet. With one, the result fits your teaching better."
  - `tool.noProfileAction`: "Onderwijscontext instellen" / "Set up teaching context".
  - `chat.noProfileHint`: "Dit gesprek kent je onderwijscontext niet. Stel een standaardcontext in." /
    "This conversation doesn't know your teaching context. Set a default context."
- **Weg:** `projects.empty`.

### Tests

- **RED, nieuw:** `tests/components/EmptyState.test.tsx`: `it("renders a heading, one sentence and
  one action link")`, `it("renders a button action and calls onClick")`, `it("is not a live
  region")` (geen `role="status"`, geen `aria-live`), axe-check.
- **RED, gewijzigd:** `tests/components/Projects.test.tsx`:
  `it("guides an empty page to the tools")`: kop `Nog geen werk bewaard` en een link `Kies een tool`
  naar `/tools`. `"shows no delete control when there are no generations"` blijft. Nieuw: axe-check
  op de lege pagina.
- **RED, gewijzigd:** `tests/components/ToolControls.test.tsx`:
  `it("links to the context page when the teacher has no profile")` en
  `it("shows no hint once a profile exists")`.
- **RED, gewijzigd:** `tests/components/ChatView.test.tsx`:
  `it("hints at setting a default context when a context tool has none")` en
  `it("shows no context hint for a tool that does not use one")`.

### Klaar als

- [ ] RED-tests eerst rood, nu groen; poort groen.
- [ ] Handmatig met een nieuwe docent zonder werk en zonder profiel: `/projects` stuurt naar de tools;
      een generator en een tutor tonen de hint naar Onderwijscontext.
- [ ] Screenshots van de lege `/projects`, een generator en een tutor zonder context: NL en EN,
      desktop en mobiel.

---

## 19.5 — Menu: minder items, duidelijke woorden (PR 5)

> **Start pas als 18.1, 18.2 en 18.4 gemerged zijn**, en na 19.4. Lees `AppShell.tsx` op `main`:
> na 18.1 is `RoleSwitch` weg; na 18.4 wijst "Beheer" naar `/admin`, dat doorstuurt naar
> `/admin/users`. Dat blijft zo.

**Doel:** het menu van een docent heeft vier items: **Tools · Mijn werk · Onderwijscontext · Help**.
Een beheerder ziet daarvoor **Beheer**. **Branch:** `p19-5-simpler-menu`.

Punten met **Besloten (BESLUIT-2026-11-04-2)** zijn vastgelegd: Bastiaan koos het menu met vier items (BESLUIT-2026-11-04-2). Daarnaast gaan `nav.viewingAsTeacher` en `home.comingSoon` weg.

### Shell (`app/components/AppShell.tsx`)

- `nav` wordt: (beheerder) `/admin` Beheer, dan `/tools` Tools, `/projects` Mijn werk,
  `/context-profiles` Onderwijscontext, `/help` Help. **Besloten (BESLUIT-2026-11-04-2)** `/about` gaat uit het menu.
- Desktop en mobiel gebruiken dezelfde lijst (zoals nu).
- Footer, kolom *Bronnen*: Help en Over blijven. **Besloten (BESLUIT-2026-11-04-2)** De link naar `/contact` gaat weg; het
  e-mailadres links in de footer blijft (`SITE.contactEmail`, mailto).

### Pagina's

- **Besloten (BESLUIT-2026-11-04-2)** Weg: `app/routes/contact.tsx` en `route("contact", …)` in `app/routes.ts`.
- `app/routes/projects._index.tsx`: de kop leest al `t.nav.projects`, dus hij heet vanzelf "Mijn
  werk".

### i18n (nl + en)

- **Besloten (BESLUIT-2026-11-04-2), nieuwe tekst:** `nav.projects`: "Mijn werk" / "My work"; `projects.subtitle`: "Alles
  wat je met de tools hebt gemaakt." / "Everything you made with the tools."
- **Weg:** `nav.viewingAsTeacher` en `home.comingSoon` (beide ongebruikt; controleer met grep).
  **Besloten (BESLUIT-2026-11-04-2)** `footer.contact` en de namespace `pages.contact`.

### Help (zelfde PR)

- `getting-started.{nl,en}.md`, stap 4: "Resultaten verschijnen onder **Mijn werk**." / "Results
  appear under **My work**." Zoek met grep naar "Projecten" / "Projects" in `app/content/help` en
  werk elke rest bij.

### Tests

- **RED, gewijzigd:** `tests/components/AppShell.test.tsx`:
  - `it("shows exactly four menu items in order for a teacher")`: de links in de hoofdnavigatie zijn
    `Tools`, `Mijn werk`, `Onderwijscontext`, `Help`, met hrefs `/tools`, `/projects`,
    `/context-profiles`, `/help`.
  - `it("adds Beheer first for an admin")` (vervangt `"places the admin link first…"`).
  - `it("shows the same four items in the mobile menu")`.
  - `it("keeps Over in the footer, not in the menu")`.
  - `it("renders the menu in English")` (root-loaderdata met `locale: "en"`): `Tools`, `My work`,
    `Teaching context`, `Help`.
  - `"surfaces a direct contact email as a mailto link"` blijft; nieuw **Besloten (BESLUIT-2026-11-04-2)**
    `it("has no link to a contact page")`.
  - De axe-checks met het menu dicht en open blijven.
- **RED, nieuw:** `tests/p19-removed.test.ts` (node, `node:fs`, zoals `tests/p17-removed.test.ts`):
  **Besloten (BESLUIT-2026-11-04-2)** `it("routes.ts registers no contact page")`, `it("the contact route is gone")`;
  `it("the i18n catalogues have no unused nav or home keys")` (`viewingAsTeacher`, `comingSoon`).
- **Aanpassen:** `tests/components/LegalPages.test.tsx` (het contactgeval weg **Besloten (BESLUIT-2026-11-04-2)**),
  `tests/components/Projects.test.tsx` (kop `Mijn werk`).

### Klaar als

- [ ] RED-tests eerst rood, nu groen; poort groen.
- [ ] Handmatig als docent en als beheerder: menu op desktop en mobiel, footer.
- [ ] Screenshots van de kopbalk (docent en beheerder), het mobiele menu en de footer: NL en EN,
      desktop en mobiel.

---

## 19.6 — Kort contextformulier (PR 6)

> **Start pas als 18.2 en 18.4 gemerged zijn**, en na 19.4 (deze stap gebruikt `EmptyState`).
> Bouw op de stand **na P18**, niet op de code van vandaag: na 18.2 is er geen land meer in de
> editor (geen `availableCountries`, geen `CountrySelect`, `country` altijd `DEFAULT_COUNTRY`), geen
> toegang per docent (`getAvailableSectors(user)` en `getAvailableDomainSlugs(user)` volgen de
> instelling) en is de hulp over "aangepaste toegang" al weg. Lees de P18-brief, 18.2
> *Contexteditor*, en de bestanden op `main` vóór je begint.

**Doel:** een docent maakt een onderwijscontext op één korte pagina. Wat er het meest toe doet staat
open; de rest staat onder **"Meer details (optioneel)"**. **Branch:** `p19-6-short-context-form`.

### Welke velden open staan — Besloten (BESLUIT-2026-11-04-3)

Open, in deze volgorde (de bestaande componenten uit `ContextFields.tsx`):

1. **Naam** (`NameField`, verplicht: zo kies je later tussen profielen).
2. **Onderwijstype** (`OnderwijstypeSelect`): zet sector en leerweg en vult het NLQF-niveau voor.
3. **Opleiding** (`ProgrammeField`; verbergt zich in het vo, zoals nu via `showsProgramme`).
4. **Vak** (`CourseField`, label via `courseLabel`).
5. **Studiejaar** (`StudyYearField`, mbo en hbo) of **Fase** (`PhaseField`, vo).
6. Het vinkje **"Als standaard instellen"** (onder de velden, vóór de knop).

Onder **"Meer details (optioneel)"** (een native `<details>`, dicht):

- Niveau (`NationalLevelSelect`, met het afgeleide EQF-niveau en de bron). Het staat al goed door het
  onderwijstype.
- Domein of profiel (`DomainSelect`) met het domeinkader (`DomainFields`), volgens
  `showsDomainField` zoals nu.
- Beroepspraktijk, Technologie / methoden, Onderwijsconcept, Aanspreekvorm (mbo), Eigen velden.

Deze verdeling is vastgelegd in BESLUIT-2026-11-04-3.

### Editor (`app/components/context/ContextProfileEditor.tsx`)

- Weg: `TOTAL`, `step`/`setStep`, `goNext`, `goBack`, `canNext`, `titles`, de stappenbalk (`ol`),
  `buildSummary`, `summary` en de samenvattingsstap. Eén `Form` met de open velden, de `details` en
  onderaan **Annuleren** en **Opslaan** (`intent` = `create` of `update`, zoals nu; uitgeschakeld
  zolang de naam leeg is).
- De `summary` van "Meer details": `t.settings.moreDetails`, en bij bewerken met ingevulde details
  ook `fmt(t.settings.moreDetailsFilled, { count })`. Tel: een domein, elk ingevuld vrij veld
  (beroepspraktijk, technologie, onderwijsconcept, aanspreekvorm), elk ingevuld kaderveld en elk eigen
  veld. Het niveau telt niet mee: dat staat altijd ingevuld door het onderwijstype. Een kleine pure
  functie `countFilledDetails(profile: ContextProfile): number` in een nieuw bestand
  `app/lib/context/details.ts` (geen React), met een eigen unittest.
- De state en de relevantieregels (`onOnderwijstype`, `onPhase`, `showsDomainField`,
  `packValues`) blijven. De velden in de dichte `details` blijven in de DOM en worden dus
  meegestuurd (vast besluit 5).
- Kopcommentaar herschrijven: één pagina, kort, de rest optioneel.

### Pagina (`app/routes/context-profiles.tsx`)

- Geen profielen → een `EmptyState` (titel, één zin, knop) in plaats van `t.settings.empty`. De knop
  opent het formulier (`setEditor({})`). Daaronder geen tweede kaart "Nieuw contextprofiel".
- Wel profielen → de lijst zoals nu, met daaronder de knop "Nieuw contextprofiel".
- `settings.intro` krijgt nieuwe tekst (hieronder).

### Eerste profiel standaard (`app/server/repositories/profiles.server.ts`)

- `createProfile(userId, input, isDefault)`: heeft de gebruiker nog **geen** standaardprofiel
  (`getDefaultProfile(userId)` is `null`), dan wordt het nieuwe profiel standaard, ook als
  `isDefault` `false` is. Scoping op `userId` blijft (`AGENTS.md`, *Repositories*).

### i18n (nl + en)

- **Nieuw:**
  - `settings.emptyTitle`: "Nog geen onderwijscontext" / "No teaching context yet".
  - `settings.emptyBody`: "Vul een paar velden in, zoals je onderwijstype en opleiding. Daarna past
    het resultaat van elke tool beter bij je les." / "Fill in a few fields, such as your type of
    education and programme. After that, every tool's result fits your teaching better."
  - `settings.emptyAction`: "Onderwijscontext instellen" / "Set up teaching context".
  - `settings.moreDetails`: "Meer details (optioneel)" / "More details (optional)".
  - `settings.moreDetailsFilled`: "{count} ingevuld" / "{count} filled in".
- **Nieuwe tekst:** `settings.intro`: "Vertel één keer waar je lesgeeft. Elke tool houdt daar
  rekening mee." / "Tell us once where you teach. Every tool takes it into account."
- **Weg:** `settings.empty`, `settings.stepOf`, `settings.step1Title` t/m `step4Title`,
  `settings.next`, `settings.back`, `settings.recap`. `settings.finish` blijft als knoptekst bij een
  nieuw profiel. Zoek met grep of `settings.competencies`, `settings.notes`, `settings.ph.competencies`
  en `settings.ph.notes` nog gebruikt worden (de velden zijn verouderd); zo niet, ook weg.

### Help (zelfde PR)

- `app/content/help/topics/context-profiles.{nl,en}.md`: de sectie "Eén editor, vier stappen" wordt
  "Eén korte pagina" / "One short page": de vijf open velden, wat er onder **Meer details** staat, en
  dat je eerste profiel vanzelf standaard wordt. De rest van de tekst (zoals 18.2 hem achterliet)
  blijft.

### Tests

- **RED, herschrijven:** `tests/components/ContextProfileEditor.test.tsx`:
  - `it("is one page without steps")`: geen tekst `Stap 1 van 4`, geen knop `Volgende`; één
    submitknop.
  - `it("shows name, onderwijstype, programme, course and study year up front")` (na het kiezen van
    hbo-bachelor): deze labels staan **niet** in een `details`.
  - `it("puts level, domain and the free fields under a closed 'Meer details'")`: de labels
    `Niveau (NLQF)`, `Domein / vak`, `Beroepspraktijk / werkveld`, `Onderwijsconcept / didactische
    aanpak` en `Eigen velden` hebben een voorouder `details` zonder `open`.
  - `it("submits the level prefilled from the onderwijstype while 'Meer details' is closed")`:
    `new FormData(form).get("nationalLevel")` is het standaardniveau van de gekozen leerweg.
  - `it("counts the filled details in the summary when editing")`.
  - De bestaande relevantiegevallen (vo-fase, profiel pas in de bovenbouw, Opleiding verborgen bij
    havo, Beroepspraktijk verborgen bij havo/vwo, Vak in het vo, aanspreekvorm alleen mbo, het
    hbo-i-kader, de eerlijke melding zonder kader, de domeinfilter, voorinvullen bij bewerken, het
    behouden van een oud domein) **blijven**. Ze openen eerst "Meer details" waar nodig, en ze
    navigeren niet meer door stappen.
  - Axe: met "Meer details" dicht, open, en open met een domeinkader.
  - `"starts at step 1 of 4…"`, `"gates advancing past step 1 on a name"` en `"has no violations on
    the recap step"` vervallen.
- **RED, nieuw:** `tests/lib/context-filled-details.test.ts` (node): `countFilledDetails` telt 0 voor
  een profiel met alleen de open velden, en telt domein, vrije velden, kadervelden en eigen velden.
- **RED, gewijzigd:** `tests/components/ContextSettings.test.tsx`:
  - `"shows an empty-state hint when there is no profile yet"` →
    `it("guides a teacher without a profile to one clear action")`: kop `Nog geen onderwijscontext`
    en één knop `Onderwijscontext instellen`; een klik opent het korte formulier.
  - `"opens the editor directly at step 1 when creating a new profile"` →
    `it("opens the short form when creating a new profile")`.
  - Axe op de lege pagina.
- **RED, nieuw:** `tests/api/profiles-repo.test.ts`:
  `it("makes the first profile the default, even without the flag")` en
  `it("keeps the existing default when another profile is created without the flag")`.
- **Ongewijzigd groen:** `tests/parseForm.test.ts`, `tests/api/context-profiles-route.test.ts` (de
  veldnamen veranderen niet).

### Klaar als

- [ ] RED-tests eerst rood, nu groen; poort groen.
- [ ] Handmatig: een nieuwe docent maakt een hbo-profiel met alleen de open velden; het wordt
      standaard; een tutor gebruikt het. Een bestaand profiel met een domeinkader bewerken: "Meer
      details" toont het aantal, en na opslaan is niets verloren.
- [ ] Screenshots van de lege pagina, het korte formulier (dicht en open) en een vo-profiel: NL en EN,
      desktop en mobiel.
- [ ] PR-beschrijving, *Wat Bastiaan moet beslissen*: dat de verdeling van BESLUIT-2026-11-04-3 is gebouwd.

---

## Risico's

1. **Samenloop met P18.** Zie *Volgorde en samenloop*. De grootste kans op een conflict zit in
   `home.tsx`/`tool.tsx` (19.2 tegenover 18.1/18.3) en in de i18n-bestanden. Regel: raak in 19.2 geen
   loader aan; bij een conflict in een loader wint `main`.
2. **Een klik meer voor wie vaak van model wisselt.** Dat is de bedoeling: de meeste docenten kiezen
   nooit een model. De samenvatting van "Geavanceerd" noemt het gekozen model, dus niets wisselt stil.
3. **Ingeklapte velden met een waarde.** Een docent kan bij bewerken vergeten dat er details zijn. De
   samenvatting telt ze ("3 ingevuld"), en de velden worden altijd meegestuurd; de test
   `"submits the level … while 'Meer details' is closed"` bewaakt dat.
4. **Het eerste profiel wordt standaard.** Een docent die bewust geen standaard wilde, krijgt er nu
   één. Dat is beter dan een tutor zonder context; hij kan het vinkje later weghalen. Bestaande
   profielen veranderen niet.
5. **"Mijn werk" en P20.** P20 noemt de pagina "Projects" en voegt "Cursussen" toe; de route blijft
   `/projects`. Zie *Samenloop met P20*.
6. **Nieuwe teksten zijn voorstellen.** De doelen-teksten (19.2) en de woorden "Formulier" /
   "Gesprek" zijn nieuw. Bastiaan ziet ze in de screenshots; een andere keuze is een kleine wijziging
   in dezelfde PR.

## Buiten bereik

- De tutorprompts (vast besluit 2) en het evaluatie-harnas.
- Een eigen contextkeuze in de chat. Een tutor gebruikt nu alleen het standaardprofiel (19.4 wijst
  daar alleen op).
- "Geavanceerd" per toolveld (een vlag op `InputField` voor lange toolformulieren). Kan later, als
  data, als een tool erom vraagt.
- Alles in `/admin`, ook lege tabellen en het `userType`-label daar: P18.
- `/help` toont ook tools die de instelling uitzette (`help._index.tsx` gebruikt `getEnabledTools()`,
  niet `getAvailableTools(user)`). Een losse fix, alleen op verzoek.
- Cursussen (P20), spraak, de studentenlaag.

## Acceptatie

`npm test && npm run typecheck && npm run check` zijn groen na elk PR.

Handmatig nalopen na 19.6, als nieuwe docent op de Mac met `npm run dev`:

1. Het menu toont **Tools · Mijn werk · Onderwijscontext · Help** (desktop en mobiel); "Over" staat
   onderaan.
2. De startpagina toont de doelen en een zoekveld; nergens staat "Docent", "Student" of "Voor
   studenten". De tutors staan onder "Zelf leren met een coach" en "Samen denken & bevragen".
3. **Mijn werk** is leeg en stuurt naar de tools.
4. Een tool openen: eerst de velden van de taak; "Geavanceerd" is dicht en noemt het model; een hint
   wijst naar Onderwijscontext.
5. **Onderwijscontext** is leeg en heeft één knop. Het korte formulier met vijf velden opslaan: het
   profiel is standaard; dezelfde tool toont geen hint meer en een tutor gebruikt het profiel.
6. Hetzelfde in het Engels (taalknop EN).

## Wat Bastiaan moet beslissen

Bastiaan beantwoordde de drie productkeuzes met "1 ja 2 ja 3 ja": de aanbeveling is gekozen. De
keuzes staan in `docs/fabriek/besluiten.md` als BESLUIT-2026-11-04-1 t/m -3. De stappen hierboven
bouwen die keuzes.

1. **Startpagina en Over: weg wat dubbel is.** Besloten (BESLUIT-2026-11-04-1): weg zijn het
   typefilter ("Generators / Chatbots"), de knop raster/lijst, de theorieregel op elke kaart en de
   toollijst op "Over" (die staat al op de startpagina). Zoeken en de vijf doelen vinden elke tool.
2. **Menu: vier items, met "Mijn werk" en zonder contactpagina.** Besloten (BESLUIT-2026-11-04-2):
   het docentmenu is Tools · Mijn werk · Onderwijscontext · Help; "Over" staat alleen onderaan; de
   contactpagina gaat weg. "Projecten" heet "Mijn werk" (de route blijft `/projects`).
3. **Velden in het korte contextformulier.** Besloten (BESLUIT-2026-11-04-3): open staan Naam,
   Onderwijstype, Opleiding, Vak en Studiejaar (in het vo: Fase). Niveau, domein en kader, en de vrije
   velden staan onder "Meer details".
