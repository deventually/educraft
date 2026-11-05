# Fase 21 — Rolagenten: beoordeling op verzoek

> **Zo voer je deze brief uit:** open hem in een verse sessie en voer hem uit, test-first volgens
> `AGENTS.md` / de `/tdd`-skill. Elke deelstap is een eigen PR vanaf `main`; de poort
> (`npm test && npm run typecheck && npm run check`) is groen vóór de PR. **Hangt af van P20**
> (cursussen, `checkAlignment`, `course_links`). Keuzes van Bastiaan: BESLUIT-2026-11-05-3.

> **Stand (2026-11-05):** uitgevoerd in #81, #85, #102, #103, #104, #105 en de PR van 21.7/21.8.
> Afwijkingen: migratie 0018 (niet 0015); de Toetsdeskundige draait sinds 21.7 op
> `agent-assessment@v2` (leest ook gekoppelde toetsvragen en pakket-tags); de eindmeting van v2
> staat nog open. Deze brief is nu geschiedenis.

## In gewone taal

P21 geeft de docent twee kritische collega's die op verzoek een cursus nakijken: een
**Toetsdeskundige** en een **Ontwerper**. De docent klikt "Laat beoordelen", krijgt een korte lijst
adviezen en zegt per advies "Akkoord" of "Niet akkoord" (met een optionele reden). Er verandert
nooit iets aan de cursus zonder de docent. Wie wil, laat in dezelfde ronde ook gekoppeld werk
nakijken (eerst alleen toetsvragen); dat is een keuze per keer, nooit automatisch.

## Vaste besluiten

- **Adviseren, nooit aanpassen** (BESLUIT-2026-11-02-4). Een pet levert bevindingen; de docent
  beslist en dat besluit wordt gelogd.
- **Eerst op verzoek.** Geplande beoordeling komt met P22.
- **Twee petten in v1:** Toetsdeskundige en Ontwerper. Een derde pet pas als de pilot erom vraagt.
- **Twee soorten meldingen.** De vaste P20-controles zijn feiten: ze krijgen **geen** knoppen en
  verdwijnen als de cursus klopt. Alleen pet-bevindingen (meningen) krijgen Akkoord / Niet akkoord.
- **Akkoord = alleen vastleggen.** De bevinding klapt in; geen takenlijst (dat is P22-terrein). Een
  **verworpen** bevinding komt bij de volgende beoordeling van dezelfde cursus niet terug.
- **Pakket-tags voor elk pakket** in `DOMAIN_PACKS`, niet alleen HBO-i. Het is data; de engine
  blijft sectorneutraal. Meten doen we met ICT (HBO-i).
- **Modellen:** de pet draait op het model dat de docent kiest uit de modellen die hem worden
  aangeboden (de bestaande regels van P18.3); geen extra limiet.
- **Gekoppeld werk nakijken is optioneel per beoordeling** (een vinkje, standaard uit), en komt als
  laatste deelstap. Eerst alleen generaties van *Toetsvragen en toetsmatrijs* (P24.3).
- **Alleen geverifieerde kaders**, nooit verzonnen. Geen studentdata: een cursus bevat die niet.

## Het patroon

De portfoliocoach van P25 (`app/lib/portfolio/coach.ts` + `app/server/portfolioCoach.server.ts`)
doet al wat hier nodig is: de pure helft bouwt de invoer en controleert het antwoord; de
serverhelft roept de provider aan. Volg dat patroon. Een bevinding die verwijst naar een onbekende
leeruitkomst, activiteit of toets valt in code weg, niet alleen via de prompt.

## Deelstappen

### 21.1 — Petten als data (puur, geen LLM)

- `app/lib/agents/`: `types.ts`, `registry.ts`, `validate.ts`, `schema.ts`, `input.ts`, `filter.ts`.
- Een pet is data: `{ id, role: LocalizedText, promptId, watches: ("course" | "generation")[] }`.
  `validateAgents` controleert de vorm; 21.2 voegt toe dat de prompt bestaat, 21.4 draait het bij
  opstart. Geen `if (agent.id === …)`.
- Het model antwoordt `{ "findings": [{ severity, target?, message, suggestion }] }` met korte
  sleutels (L1, A1, T1), met Zod gecontroleerd; tekst begrensd, hooguit 15 bevindingen.
- `buildReviewMessage({ course, alignment, rejected }, locale)`: de cursus onder korte sleutels (leeruitkomsten met
  Bloom en pakket-tags, activiteiten, toetsen, studielast), de P20-bevindingen (zodat de pet die niet
  herhaalt) en de eerder verworpen bevindingen (zodat hij die niet terugbrengt).
- `parseAgentReview(raw, course, rejected)`: zet sleutels terug naar echte id's; weg met bevindingen
  met een onbekende sleutel, dubbelen en eerder verworpen bevindingen. `extractJson` is nu gedeeld
  met de portfoliocoach (`app/lib/ai/extractJson.ts`).
- **RED:** `tests/agents/registry.test.ts`, `input.test.ts`, `filter.test.ts`.

### 21.2 — Twee pet-prompts en de meting

- `agent-assessment@v1` (toetsmatrijs, Bloom-spreiding, formulering van leeruitkomsten, cesuur,
  weging) en `agent-design@v1` (constructive alignment, activerend onderwijs, studielast tegen EC),
  NL en EN, volgens `app/lib/prompts/TEMPLATE.md`. JSON-uitvoer volgens het schema van 21.1.
- De Toetsdeskundige kijkt naar de **cursus als geheel**, niet naar losse vragen: dat doen
  *Toetsvragen en toetsmatrijs* (P24.3) en de P26-controles al.
- Eval-casussen (`evals/agent-assessment/`, `evals/agent-design/`): cursussen met een **bekende
  fout** (vage leeruitkomst, Bloom-scheefgroei, alleen hoorcolleges bij een *create*-leeruitkomst,
  studielast ver boven EC × 28) en één goede cursus waarop de pet niets mag verzinnen. Harde checks:
  de bekende fout gevonden; elke bevinding wijst naar een echt item; geen kader dat niet in de
  invoer staat.
- Klaar bij BESLUIT-2026-11-04-24 (elke case ≥ 4,5); tussenrondes met 1 run, via de Batch API
  (BESLUIT-2026-11-04-25).

### 21.3 — Opslag

- `agent_reviews`: `id`, `userId`, `courseId`, `agentId`, `model`, `findingsJson`,
  `courseUpdatedAt` (om "verouderd" te tonen), `createdAt`.
- `review_decisions`: `id`, `userId`, `reviewId`, `findingId`, `decision` (`accepted` |
  `rejected`), `reason` (≤ 500), `createdAt`; unieke index op (`reviewId`, `findingId`).
- Eén migratie (de eerste na 0014 van P20.2). Repo `app/server/repositories/agentReviews.server.ts`: async,
  per `userId`, lijsten begrensd. Opgeruimd bij `deleteCourse` en `deleteUserCascade`.
- **RED:** `tests/api/agent-reviews-repo.test.ts` (rondreis, andermans cursus onzichtbaar, besluit
  op andermans review geweigerd, cascades, limiet).

### 21.4 — "Laat beoordelen" (server)

- Intent `review` op `/courses/:id`: draait elke pet met `watches` `"course"`, parset met Zod,
  filtert (21.1), slaat op (21.3). Model volgens de bestaande beschikbaarheidsregels; een
  ongeldig of mislukt antwoord van één pet geeft een gelokaliseerde melding voor die pet, de andere
  pet wordt nog bewaard. Intent `decide` (akkoord/niet akkoord + reden).
- **RED:** `tests/api/course-review.test.ts` met een nep-provider: opslaan, rommel-JSON → melding,
  onbekende `targetId` gefilterd, vreemde cursus → 404, niet-toegestaan model geweigerd.

### 21.5 — Beoordelingspaneel (UI)

- Een sectie "Beoordeling" op `/courses/:id` (losse component naast de P20-secties): knop "Laat
  beoordelen", bevindingen per pet met het item waar ze over gaan, Akkoord / Niet akkoord met een
  optionele reden, ingeklapte afgehandelde bevindingen, en een melding als de cursus na de
  beoordeling is gewijzigd. Werkt zonder JS; toast bij klaar (`useFormToast`), geen extra
  live-region.
- i18n-namespace `agents` in `messages/{nl,en}/agents.ts`. Kort helponderwerp.
- **RED:** `tests/components/course-review-panel.test.tsx` (lege staat, bevindingen, besluit,
  verouderd, axe nul overtredingen). Screenshots NL/EN, desktop en mobiel.

### 21.6 — Pakket-tags bij leeruitkomsten

- Optioneel veld `packTags?: Record<string, PackFieldValue>` op `LearningOutcome`, uitgebreid in
  `CourseDataSchema` (geen migratie; oude data blijft geldig). Velden en opties komen uit het
  pakket van het contextprofiel van de cursus (`DOMAIN_PACKS`); geen pakket → geen tags.
- In de cursuseditor per leeruitkomst te kiezen; gaat mee in `buildAgentInput`, zodat een pet kan
  zeggen "beheersingsniveau 3, maar de toets vraagt niveau 1". Een import (P26.3) laat tags leeg en
  overschrijft ze niet.
- **RED:** schema (onbekende sleutel/optie geweigerd), editor-intent, input bevat de tags, axe.

### 21.7 — Gekoppeld werk mee laten nakijken (optioneel per keer)

- Een vinkje "Ook gekoppeld werk nakijken" bij "Laat beoordelen", standaard uit. Alleen
  generaties van `test-items` die via `course_links` aan de cursus hangen (andere tools later, elk
  met eigen eval-casussen). De Toetsdeskundige krijgt dan ook de tekst van die generatie (begrensd)
  en het item waar ze aan hangt.
- Eval-casussen: een toets die een leeruitkomst op een te laag niveau toetst.
- **RED:** zonder vinkje geen generatietekst in de invoer; met vinkje alleen eigen, gekoppelde
  `test-items`-generaties.

### 21.8 — Documentatie

`AGENTS.md` (korte alinea rolagenten onder Conventions), `wiki/`, deze brief en de README-rij,
`STATUS.md`. Mag mee in de laatste PR.

## Volgorde

| Golf | Stappen | Wacht op |
| --- | --- | --- |
| 1 | 21.1 | P20.1 (gemerged) · kan nu |
| 2 | 21.2 en 21.3, naast elkaar | 21.1 · P20.2 (gemerged, migratie 0014) |
| 3 | 21.4 → 21.5 → 21.6 → 21.7 → 21.8 | 21.2 en 21.3 · P20.3 |

Nooit meer dan twee werkers tegelijk.

## Buiten bereik

Autonome wijzigingen; geplande beoordelingen (P22); studentgerichte agenten; de Cases-add-on;
nakijken van andere generaties dan toetsvragen; een derde pet.
