# Fase 20 — Cursussen en de rode draad

> **Zo voer je deze brief uit:** open hem in een verse sessie en voer hem precies uit, test-first
> volgens `AGENTS.md` / de `/tdd`-skill. Doe de interne fasen op volgorde (20.1 → 20.5); laat elke
> fase door `npm test && npm run typecheck && npm run check` komen voordat je verdergaat, en commit
> de fase. **Hangt af van** P1 (gebruikers + scoping), P8 (contextprofielen), P15 (toasts). Branch
> vanaf `main`.

## Context en doel

LimeOnIt wordt een **assistent voor de docent** (productbesluit, november 2026). Dit is de eerste
fase van dat spoor: docentgereedschap komt eerst, en AI-ondersteunde cursussimulaties zoals
"Webshop Bob" komen later als aparte add-on. De latere assistentfuncties zijn rolagenten die je werk
beoordelen (P21) en een wekelijks ritme met briefings (P22). Beide hebben **één gedeeld object nodig
om op te werken**, en dat is er nu niet: elke generatie is een losstaand resultaat in `/projects`,
zonder te weten bij welke cursus, leeruitkomst of toets ze hoort.

P20 voegt dat object toe, een **Cursus**, samen met de deterministische helft van "wijk niet af van
het noodzakelijke":

```
learning outcome ──taught by──▶ activity (lesson / assignment)
        └──────assessed by──▶ assessment (formative / summative) at a Bloom level
generation ──linked to──▶ course (optionally to one activity / assessment)
```

Uit die graaf kunnen pure functies een **dekkingsmatrix** en **bevindingen** afleiden:

- een leeruitkomst die geen enkele activiteit onderwijst;
- een leeruitkomst die geen enkele summatieve toets toetst;
- een leeruitkomst die wordt getoetst voordat ze wordt onderwezen;
- een toets die onder het Bloom-niveau van de leeruitkomst toetst;
- een activiteit die geen enkele leeruitkomst dient.

In P20 komt geen LLM voor. Deze controles zijn goedkoop en testbaar, en ze vormen de basis waarop de
P21-agenten bouwen.

## Vaste besluiten (bevestigd door de gebruiker)

1. **Eerst hbo.** Teksten en terminologie richten zich op hbo ("leeruitkomst",
   "onderwijsactiviteit", "toets"). De *engine* blijft sectorneutraal: niets in `app/lib/courses/`
   weet van hbo, en andere sectoren hergebruiken hem ongewijzigd.
2. **Adviseren, nooit aanpassen.** Bevindingen zijn adviezen. Niets past de cursus van de docent
   automatisch aan, en de docent beslist.
3. **Noodzakelijke = pakketbasis + docentlaag.** P20 levert de docentlaag (de eigen leeruitkomsten
   van de docent) plus de universele Bloom-as. Het taggen van leeruitkomsten met **pakket**-kaders
   (HBO-i beroepstaak / architectuurlaag / beheersingsniveau uit `DOMAIN_PACKS`) is P21.
4. **Bloom = de herziene taxonomie** (Anderson & Krathwohl, 2001): `remember · understand · apply ·
   analyze · evaluate · create`, opgeslagen als Engelse slugs en tweetalig gelabeld. Dit is een
   geverifieerd kader, geen verzonnen kader.
5. **Opslag:** een nieuwe tabel `courses` met de structuur in een Zod-gevalideerde `dataJson`-kolom
   (het `context_profiles`-patroon: als geheel bewerkt, klein, geen joins per rij), plus een tabel
   `course_links` voor generatiekoppelingen. **Eén migratie.** De slapende tabel `projects` en
   `generations.projectId` blijven onaangeroerd. Ze worden nu niet gebruikt; laat ze liggen voor een
   latere opruiming in plaats van het woord "project" te overladen.
6. **Alleen docenten en beheerders.** Studenten zien in P20 nooit cursussen.

## Het model (`app/lib/courses/types.ts`)

```ts
export const BLOOM_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"] as const;
export type BloomLevel = (typeof BLOOM_LEVELS)[number];

export interface LearningOutcome { id: string; text: string; bloom?: BloomLevel }
export interface Activity {
  id: string; title: string; week?: number;            // relative week 1..n (no dates in P20)
  kind: "lesson" | "assignment"; outcomeIds: string[];
}
export interface AssessmentCoverage { outcomeId: string; bloom?: BloomLevel }
export interface Assessment {
  id: string; title: string; week?: number;
  kind: "formative" | "summative"; weight?: number;    // % of the final grade, summative only
  coverage: AssessmentCoverage[];
}
export interface CourseData { outcomes: LearningOutcome[]; activities: Activity[]; assessments: Assessment[] }
```

- `CourseDataSchema` (Zod) is de grens: tekst ≤ 1 000 tekens, titels ≤ 200, ≤ 30 leeruitkomsten,
  ≤ 100 activiteiten, ≤ 30 toetsen, week 1–60, gewicht 0–100. Verwijzingen naar onbekende
  leeruitkomst-id's worden door een refinement **geweigerd**, zodat de opgeslagen graaf altijd
  consistent is.
- Item-id's zijn UUID's die in de JSON zelf leven. Koppelingen verwijzen ernaar, zodat ze herordenen
  en hernoemen overleven.

## 20.1 — Puur domein (`app/lib/courses/`)

- `types.ts`, `schema.ts` (`CourseDataSchema`, `emptyCourseData()`), `bloom.ts` (`BLOOM_LEVELS`,
  `bloomRank(level)`, tweetalige labels als `LocalizedText`).
- `edit.ts`: pure, onveranderlijke bewerkingen die de route-acties aanroepen:
  - `addOutcome`, `updateOutcome`, `removeOutcome`. Het verwijderen van een leeruitkomst **haalt ook
    elke verwijzing ernaar weg** uit activiteiten en toetsdekking.
  - Dezelfde bewerkingen voor activiteiten en toetsen.
- `alignment.ts`:
  - `coverageMatrix(data)` → rijen = leeruitkomsten, kolommen = activiteiten en dan toetsen, en elke
    cel = `{ covered: boolean; bloom?: BloomLevel }`.
  - `checkAlignment(data): AlignmentFinding[]`, waarbij
    `AlignmentFinding = { code; severity: "warning" | "info"; outcomeId?; itemId? }` en `code` een
    van de volgende is, in een vaste volgorde (volgorde van leeruitkomsten, dan van items):

    | code | ernst | regel |
    | --- | --- | --- |
    | `outcome-not-taught` | warning | geen enkele activiteit noemt de leeruitkomst |
    | `outcome-not-assessed` | warning | geen enkele **summatieve** toets dekt de leeruitkomst |
    | `assessed-before-taught` | warning | de week van een summatieve toets < de vroegste week van een activiteit die die leeruitkomst onderwijst (alleen als beide weken zijn ingesteld) |
    | `bloom-below-outcome` | warning | een dekkings-`bloom` rangschikt onder de `bloom` van de leeruitkomst (alleen als beide zijn ingesteld) |
    | `activity-without-outcome` | info | een activiteit noemt geen leeruitkomsten |
    | `weights-not-100` | info | minstens één summatief gewicht is ingesteld en de summatieve gewichten tellen niet op tot 100 |

- **Testplan (RED):**
  - `tests/courses/schema.test.ts`: geldige data wordt geparsed; limieten worden afgedwongen; een
    hangende `outcomeId` wordt geweigerd; `emptyCourseData()` wordt geparsed.
  - `tests/courses/edit.test.ts`: elke bewerking is onveranderlijk; `removeOutcome` haalt
    verwijzingen weg.
  - `tests/courses/alignment.test.ts`: één gericht geval per bevindingscode, plus het negatieve geval
    (op elkaar afgestemde data → `[]`), de matrixvorm en de vaste volgorde.

## 20.2 — Persistentie

- **Schema** (`schema.server.ts`):
  - `courses`: `id`, `userId` (notNull), `name`, `contextProfileId` (nullable), `dataJson`,
    `createdAt`, `updatedAt`.
  - `course_links`: `id`, `userId`, `courseId`, `generationId`, `itemId` (nullable: een activiteit-
    of toets-id), `createdAt`; `uniqueIndex(courseId, generationId)`.
  - Draai `npm run db:generate` om migratie 0008 te maken.
- **Repository** `app/server/repositories/courses.server.ts`. Elke functie is async en wordt per
  `userId` afgebakend, volgens de huisregel.
  - `listCourses` (met limiet), `getCourse`, `createCourse`, `updateCourse` (parset `dataJson`
    opnieuw met `CourseDataSchema`; ongeldige invoer gooit een fout, er wordt niets geschreven),
    `deleteCourse` (verwijdert ook de koppelingen, in één transactie).
  - `linkGeneration(userId, courseId, generationId, itemId?)`: controleert dat de aanroeper
    **zowel** de cursus **als** de generatie bezit, en dat `itemId` (indien opgegeven) in de cursus
    bestaat; doet een upsert op de unieke index. Ook `unlinkGeneration`, `listLinksForCourse`,
    `listCourseLinksForUser` (voor `/projects`-badges).
- **Cascades:** `deleteUserCascade` ruimt ook `courses` en `course_links` op; `deleteGeneration`
  verwijdert ook de koppelingen van die generatie.
- **Testplan (RED):** `tests/api/courses-repo.test.ts` dekt:
  - CRUD-rondreis;
  - de cursus van een andere gebruiker is onzichtbaar en niet bij te werken;
  - het koppelen van andermans generatie of cursus wordt geweigerd;
  - een onbekende `itemId` wordt geweigerd;
  - opnieuw koppelen doet een upsert;
  - `deleteCourse` en `deleteGeneration` laten koppelingen vallen;
  - `deleteUserCascade` ruimt beide tabellen op;
  - de lijstlimiet houdt stand.

## 20.3 — Cursus-UI (`/courses`, `/courses/:id`)

- **Routes** (Engelse slugs): voeg `courses` en `courses/:id` toe aan `routes.ts`. Gebruik
  `requireRole("teacher", "admin")`; een student krijgt een 404. Een navigatie-item ("Cursussen" /
  "Courses") voor niet-studenten komt naast Projects in `AppShell` (desktop + mobiel + footer).
- **`/courses`:** een lijst (naam, aantal leeruitkomsten, aantal openstaande bevindingen) plus een
  aanmaakformulier (naam en een optioneel contextprofiel). Verwijderen loopt via `ConfirmDialog`.
  Sluit `useFormToast` aan.
- **`/courses/:id`:**
  - **Secties:** Leeruitkomsten · Onderwijsactiviteiten · Toetsen · Dekkingsmatrix · Aandachtspunten
    · Gekoppeld werk.
  - **Bewerken:** een gewone `<Form method="post">` per item met een `intent` (`add-outcome`,
    `update-outcome`, `remove-outcome`, … voor alle drie de collecties, plus `rename`). De actie
    laadt de cursus, past de bewerking uit 20.1 toe en slaat op via de repo (Zod-gevalideerd).
    Foute invoer geeft een gelokaliseerde foutmelding en nooit een stacktrace. Toetsdekking is een
    selectievakje per leeruitkomst plus een optionele Bloom-`<select>`. Het werkt zonder JS.
  - **Matrix:** een echte `<table>` met `<caption>`, `<th scope="col|row">`. Een gedekte cel toont
    "✓" plus het Bloom-label als tekst (nooit alleen kleur) en heeft een `sr-only`-beschrijving.
  - **Bevindingen:** een gewone lijst met een ernsticoon plus tekst, met i18n-sleutels
    `courses.findings.<code>`, geïnterpoleerd met de titel van de leeruitkomst of het item. Geen
    live-region: de toast kondigt opslaan aan (P15-regel).
- **i18n:** een `courses.*`-namespace in `messages/{nl,en}.ts` (pariteitstest). Bloom-labels zijn
  tweetalig.
- **Help:** een kort `app/content/help/courses`-onderwerp (wat een cursus is, hoe de controles
  werken, dat ze adviserend zijn). Link ernaar vanaf de pagina.
- **Testplan (RED):**
  - `tests/components/courses-index.test.tsx`: lijst, lege staat, aanmaakformulier; axe nul
    overtredingen.
  - `tests/components/course-editor.test.tsx`: secties renderen; de matrix heeft een caption en
    gescopete koppen; een bevinding rendert als tekst; axe nul overtredingen.
  - `tests/api/courses-route.test.ts`:
    - elke intent slaat op;
    - een vreemde cursus → 404;
    - een student → 404;
    - een ongeldige payload (hangende leeruitkomst-id, tekst boven de limiet) → fout, niets
      opgeslagen;
    - `remove-outcome` haalt verwijzingen weg.
  - `AppShell.test.tsx`: de navigatie toont Cursussen voor een docent, niet voor een student.

## 20.4 — Generaties aan cursussen koppelen

- **`/projects`:** per generatie een klein formulier "Koppel aan cursus" (cursus-`<select>` plus een
  optionele activiteit/toets-`<select>`) → `intent="link"` / `intent="unlink"`. Gekoppelde
  generaties tonen een cursusbadge. "Gekoppeld werk" op de cursuspagina somt gekoppelde generaties
  op, met een link terug naar `/projects`.
- **Toolpagina: cursuskiezer + voorinvulling van leeruitkomsten** (alleen docenten; data, geen
  controlestroom):
  - Voeg `InputField.prefillFromCourse?: { source: "learningOutcomes" }` toe aan
    `registry/types.ts`.
  - Markeer de leeruitkomstvelden van de docenttools:
    - `contextualization.learningObjectives`
    - `guided-reflection.leeruitkomsten`
    - `forum-autograder.learningObjectives`
    - `authentic-assessment.leeruitkomsten`
    - `cognitive-architect.learningObjective`
  - Voeg `coursePrefillValues(fields, course)` toe in `app/lib/forms/values.ts`, naar het model van
    `profilePrefillValues`: één leeruitkomst per regel, `- <text>`.
  - Voeg `useSandbox` `selectCourse(id)` toe. Het leidt de door de cursus gevoede velden opnieuw af
    met dezelfde reset-bij-wisselen-semantiek, en als de cursus een `contextProfileId` heeft,
    selecteert het ook dat profiel.
  - De `tool.tsx`-loader geeft de cursussen van de gebruiker door (id, name, contextProfileId,
    outcomes).
- **Auto-koppeling in de stream:**
  - Voeg `courseId: z.string().max(100).nullish()` toe aan `StreamBodySchema`.
  - Roep na `saveGeneration` / `upsertChatGeneration`, als `courseId` is gezet, `linkGeneration`
    aan. Eigendom wordt in de repo gecontroleerd. Een vreemde of onbekende id wordt **genegeerd en
    gelogd**, nooit een fout, en de generatie wordt nog steeds opgeslagen.
  - De client stuurt de gekozen cursus-id mee.
- **Testplan (RED):**
  - `tests/lib/values.test.ts` (of breid de bestaande uit): `coursePrefillValues`.
  - `tests/lib/useSandbox.test.tsx`: `selectCourse` vult voor in, wisselen reset, het selecteert het
    gekoppelde profiel.
  - `tests/api/stream.test.ts`:
    - een eigen `courseId` → een koppelingsrij;
    - een vreemde `courseId` → geen koppeling, maar de generatie wordt opgeslagen;
    - een ontbrekende → ongewijzigd.
  - `tests/components/Projects.test.tsx`: koppelbediening + badge; axe.
  - `tests/tools/*.test.ts` voor de vijf tools: het veld declareert `prefillFromCourse`.

## 20.5 — Documentatie

- `AGENTS.md`:
  - een korte alinea **Courses & alignment (P20)** onder Conventions: het model; controles zijn
    puur en adviserend; `prefillFromCourse` is de datahaak; koppelingen worden op eigenaar
    gecontroleerd;
  - een Key Files-item.
- De status van deze brief, de README-rij en een notitie in `wiki/Roadmap.md`: het
  docentassistentspoor P20 → P21 → P22.

## Buiten bereik

- **LLM-beoordeling / rolagenten** → P21. **Plannen, wekelijkse briefing, ICS, echte datums** → P22.
- Toetsmatrijs op itemniveau (individuele toetsvragen); pakket-tagging van leeruitkomsten (HBO-i) →
  P21.
- Cursussen delen of samen bezitten (sectie-/teamniveau); import uit OER/Osiris/PDF; export.
- Studentgerichte cursusweergaven; slepen en neerzetten om te herordenen (weeknummers bepalen de
  volgorde).
- Alles uit de uitgestelde **Cases-add-on** (simulaties in de stijl van Webshop Bob, avatars).

## Acceptatie

`npm test && npm run typecheck && npm run check` zijn groen na elke subfase.

Handmatige herhaling:
1. Een docent maakt "Software Engineering — jaar 2" aan met drie leeruitkomsten (één op *analyze*),
   vier lessen en één summatieve toets die twee leeruitkomsten dekt op *understand*.
2. De matrix toont de hiaten. De bevindingen noemen `outcome-not-assessed` voor de derde
   leeruitkomst en `bloom-below-outcome` voor die op *analyze*.
3. Authentic Assessment openen met die cursus geselecteerd vult de leeruitkomsten voor in.
4. De gegenereerde uitvoer verschijnt gekoppeld onder "Gekoppeld werk".
5. Een student kan `/courses` niet bereiken. Een tweede docent kan de cursus van de eerste docent
   niet zien of koppelen.
