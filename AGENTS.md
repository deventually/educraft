# AGENTS.md — LimeOnIt's Agent Contract

The canonical contract for AI agents and developers on LimeOnIt. It holds the rules that steer
work; how things are built lives in the [wiki](wiki/Home.md), what is going on in
[`docs/fabriek/STATUS.md`](docs/fabriek/STATUS.md). `CLAUDE.md` imports this file.

## Project model

LimeOnIt turns *The Pedagogical Promptbook* (David Wiley, ed., CC BY 4.0) into a React Router 8
app for Dutch education (VO/mbo/hbo/wo). Depth: [Architecture](wiki/Architecture.md).

- **Tools are data.** Every tool is one `Tool` registry entry (`app/lib/registry/tools/<id>.ts`)
  with modes `one-shot`, `chat` or `multi-stage`. Capability grows by adding data, never by a
  per-tool branch.
- **A result has a place and a next step.** Next steps (`Tool.next`), course buttons
  (`Tool.courseActions`) and "Los op met…" (`FINDING_TOOLS`) are registry data, validated at boot.
- **Prompts are files.** `app/lib/prompts/<id>@vN.prompt.ts` + `app/lib/prompts/files/<id>.{nl,en}.md`
  with `{{placeholder}}` syntax, validated at build time.
- **Providers are abstracted** behind `app/lib/ai/provider.ts`; tools never import an SDK.
- **Context:** the per-tool sandbox plus the user profile, injected as `{{context}}` /
  `{{contextProfile}}` ([Context Model](wiki/Context-Model.md)).

## Quality principles

1. **TDD, always.** Red → Green → Refactor for every feature, fix, copy/layout/route/i18n change.
   Unit tests `tests/**/*.test.ts` (node), components `tests/**/*.test.tsx` (happy-dom). Use the
   `/tdd` skill for templates.
2. **Security by design.** Validate all external input with Zod at the boundary: `/api/stream`
   parses its body with `StreamBodySchema` (extend it, never `request.json()`). Secrets only via
   `app/server/env.server.ts`. LLM output through ReactMarkdown, never `dangerouslySetInnerHTML`.
   Registry validation (`registry/validate.ts`) runs at boot.
3. **Accessibility by design** (WCAG 2.2 AA). Semantic HTML, labels, `fieldset`/`legend`,
   focus-visible, `aria-live` for streaming. **Every interactive component ships a vitest-axe test:**
   `expect((await axe(container)).violations).toEqual([])`. Action feedback goes through the toast
   system (`useFormToast` / `useActionToast`); don't announce the same event inline as well.
4. **Deep modules.** Narrow interfaces over powerful implementations. An
   `if (tool.mode === …)` or per-tool branch means: refactor toward a deeper component.
5. **Simple and maintainable.** Remove what is redundant. Engine stays locale/level-neutral
   (specifics live in packs). Pinned toolchain (Volta, Node 24.14.1).

## Commands

| Command | Purpose |
| --- | --- |
| `npm test` · `npm run typecheck` · `npm run check` | **The gate.** All three green before done. |
| `npm run test:watch` | Tests in watch mode. |
| `npm run dev` · `npm run build` | Dev server (port 5173) · production build. |
| `npm run db:generate` | Generate a Drizzle migration from the schema. |
| `npm run db:migrate` | Apply migrations (also creates the local DB). |
| `npm run eval` · `npm run eval:coach` | Prompt evals (need `ANTHROPIC_API_KEY`, see `evals/README.md`). |
| `npm run invite` · `npm run set-owner -- --email …` | Mint an invite · set the owner. |

## Conventions

### Conflict-free hotspots
The files nearly every PR touches are split per area, so PRs don't collide
(BESLUIT-2026-11-04-19). Put new things in **your own area's file**, or add a new one.
- **i18n:** one file per namespace in `app/lib/i18n/messages/{nl,en}/<namespace>.ts`; `index.ts`
  only composes them (alphabetical). **Keys are sorted** (biome `useSortedKeys`; `npm run check`
  fixes it). `tests/hotspots.test.ts` enforces the split and the order; `tests/i18n.test.ts`
  enforces NL/EN parity.
- **Routes:** `app/routes.ts` only composes; each area is a `RouteArea` in `app/routing/<area>.ts`.
  Tests read the table via `tests/helpers/routes.ts`, never the source text.

### i18n
Everything a user reads is bilingual: `LocalizedText` (`{ nl, en }`). Option values are stable
English slugs, never shown.

### Prompts
- Every `{{placeholder}}` has a source: an input field, context injection, or an earlier stage's
  output. `tests/tools/<id>.test.ts` asserts `buildSystemPrompt` leaves none unresolved.
- Versioned ids: a changed prompt is a new `@v2`; keep `@v1` registered while sessions use it.
- New prompts follow `app/lib/prompts/TEMPLATE.md` (Voice & Bounds) and get eval cases.
- Departing from the book is allowed, honestly (BESLUIT-2026-11-04-22): `verbatim` is the book's real
  prompt text; `Attribution.adaptation` says what we changed; `Attribution.improvedAfter` claims an
  improvement only with a report in `evals/reports/` (`tests/tool-attribution.test.ts`).
- Level reaches prompts only through `{{contextProfile}}` (`app/lib/context/format.ts`); the engine
  never branches on level.

### Database
- All DB access goes through `app/server/repositories/`: every exported function is `async` and
  scoped to its owning `userId` in the WHERE clause. No better-sqlite3 API outside `db.server.ts`.
- `getDb()` is the seam; tests set `DATABASE_URL=file::memory:` before importing server modules.
  List queries are capped (`Math.min(limit ?? 50, 500)`).
- A schema change ships with a migration (`npm run db:generate`), applied with `npm run db:migrate`.

### Courses & alignment (P20)
Details: [Architecture](wiki/Architecture.md#feature-modules).
- A course is one JSON graph per course (`CourseDataSchema`, `app/lib/courses/`): outcomes with an
  optional Bloom level, activities, assessments with coverage, optional EC. The schema is not
  `.strict()`, so later phases add optional fields without a migration.
- `checkAlignment` and `coverageMatrix` are pure and advisory: they report, never change the
  course, and use no AI.
- A tool reaches a course only through data: `InputField.prefillFromCourse`. No per-tool course code.
- Links are owner-checked in the repository: `linkGeneration` returns `null` for anything that is
  not the caller's. The stream logs a refused link and still saves the generation.
- P26: a test's questions (`items`) are the source of its coverage (`effectiveCoverage`); an import
  (OER, blueprint) is a proposal the teacher confirms; a course in a dossier is a snapshot, never a
  live link.

### Role agents (P21)
Details: [Architecture](wiki/Architecture.md#feature-modules).
- A hat is data (`app/lib/agents/registry.ts`: `{ id, role, promptId, watches }`); no per-hat branch.
- Hats advise, never change a course. P20 checks are facts without buttons; only hat findings get
  Akkoord / Niet akkoord, stored in `review_decisions`; a rejected finding never comes back.
- Anti-fabrication lives in code: `parseAgentReview` drops unknown keys, duplicates and rejected
  advice. Linked work goes in only when the teacher ticks the box, only own `test-items` work.

Details: [Authentication](wiki/Authentication.md), model availability in
[Architecture](wiki/Architecture.md#providers-model-agnostic).
- Roles are `teacher | admin`. `"student"` survives only as tool data (`Tool.userType`), never as
  a role.
- Availability is enforced **server-side** (home loader, tool loader 404, stream refuse); the UI
  only hides.
- `users.sessionVersion` is bumped in exactly three places: `updateUserPassword`,
  `setUserDisabled(id, true)` and a real `setUserRole` change. Never anywhere else.
- Owner-only actions are checked in the action (`{ error: "ownerOnly" }`). Invites never make admins.
- CLI and local models exist only outside production (`localModelsEnabled()`).
- Student work stays in the browser where it can: document extraction, the document viewer and
  anonymisation (`redact: true`) never upload the original.

## Adding a tool (the TDD loop)

Full recipe: [Adding a Tool or Pack](wiki/Adding-a-Tool-or-Pack.md).
1. **RED:** `tests/tools/<id>.test.ts` — the slug resolves, `buildSystemPrompt` has its anchors and
   no unresolved `{{…}}`, required fields are enforced, NL/EN parity. Watch it fail.
2. **GREEN:** the prompt files, `<id>@v1.prompt.ts`, the registry entry, and register both in
   `app/lib/prompts/index.ts` and `app/lib/registry/index.ts`.
3. **REFACTOR:** extract shared input groups or option sets.
4. **Chat tools:** `tests/components/<id>.test.tsx` (greeting, send, stream, axe).
5. **GATE:** `npm test && npm run typecheck && npm run check`.

## Docs

Update this file, `CLAUDE.md` or the `wiki/` when a rule or the architecture changes. Shipped
work is history: it goes in the wiki or `docs/fabriek/geschiedenis.md`, not here.

## Fabriek — regels voor werkers

LimeOnIt wordt gebouwd door een kleine softwarefabriek ([`docs/fabriek/`](docs/fabriek/README.md)).
De **Producer** is de gesprekspartner in het Claude-project LimeOnIt
([`producer.md`](docs/fabriek/producer.md)). **Elke andere sessie is een werker**, ook deze, en ook
als iemand vraagt om "de Producer te zijn". Lees eerst
[`voorkeuren.md`](docs/fabriek/voorkeuren.md); dat wint van dit bestand.

Als werker:

1. **Zeg in één regel dat je een werker bent**, als iemand je als Producer aanspreekt.
2. **Kijk eerst rond:** de open PR's en *Bezig* in `STATUS.md`. Heeft iemand het al, start dan
   geen kopie.
3. **Eén stuk werk, één branch vanaf `main`, één PR.** Test-first, poort groen.
4. **De PR-beschrijving volgt het sjabloon** (`.github/pull_request_template.md`), met bovenaan
   **"In gewone taal"**: wat er verandert voor een docent of voor Bastiaan.
5. **Werk het bord bij in dezelfde PR:** *Bezig* zolang de PR openstaat, *Nu* bij de laatste
   wijziging. Nieuwe besluiten gaan in `besluiten.md`.
6. **Merge nooit, push nooit naar `main`, force-push nooit.** Alleen Bastiaan merget, en hij
   merget PR's in nummervolgorde.
7. **Na elke merge haalt elke open PR `main` binnen**, met een gewone merge (geen rebase), en lost
   de werker de conflicten op. Bastiaan lost nooit zelf een conflict op. Vervolgwerk op een
   gemergede PR gaat op een verse branch vanaf `main`.
8. **Faalt een cluster tests ineens**, terwijl elke test apart slaagt, kijk dan eerst naar de
   machine (`uptime`, wees-processen) voordat je de code aanpast.
9. **Sluit af met een eindrapport** voor de Producer: PR-link, uitslag van de poort, afwijkingen en
   waarom, open punten, en wat Bastiaan moet beslissen.

Ontwikkeldocumentatie is Nederlands, code en commentaar Engels, en alles wat gebruikers lezen
tweetalig. **Rangorde van waarheid:** code en tests → `besluiten.md` (nieuwste wint) → `STATUS.md`
→ briefs (een uitgevoerde brief is geschiedenis) → geheugen en oude sessies. Spreekt een
herinnering de repo tegen, dan wint de repo.
