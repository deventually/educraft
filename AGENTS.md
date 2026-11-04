# AGENTS.md — LimeOnIt's Agent Contract

This is the canonical contract for AI agents and developers working on LimeOnIt. Adherence is enforced via tests, tooling, and the TDD loop below. One source of truth — see `CLAUDE.md` for how this auto-loads.

## Project Model

**LimeOnIt** turns *The Pedagogical Promptbook* (David Wiley, ed., CC BY 4.0) into a React Router 7 app for Dutch education (VO/mbo/hbo/wo).

- **Tools as data:** Every pedagogical tool from the book conforms to one shape (a `Tool` registry entry) regardless of mode. No control-flow branching for each tool — capability grows by data addition, not engine churn.
- **Prompt pipeline:** Prompts are externalized per language (NL/EN) as `.md` files with `{{placeholder}}` syntax. Each tool lives in `app/lib/prompts/<id>.prompt.ts` (registered) with language variants in `app/lib/prompts/files/<id>.{nl,en}.md`. Placeholders are validated at build time.
- **Provider abstraction:** The AI layer (`app/lib/ai/provider.ts`) abstracts Claude/OpenAI/local models behind one interface. Tools never import specific SDKs. Anthropic/LM Studio/OpenAI-compat go through the AI SDK adapter (`adapters/aisdk.ts`); **Ollama uses a native adapter (`adapters/ollama.ts`, `/api/chat`)** because the AI SDK's `/v1` path ignores Ollama's `think` switch. Reasoning ("thinking") models can be told not to reason via `GenerateOptions.thinking` (`false` = direct answer, far faster for chat; `undefined` = model default) — surfaced as a per-chat toggle inside the "Geavanceerd" disclosure (`AdvancedSettings`) in `ChatView`, shown only for models whose `/api/show` capabilities include `thinking` (`PickerModel.supportsThinking`, detected in `discover.server.ts`). The stream carries it as the optional `thinking` body field.
- **Interaction modes:**
  - **one-shot:** fill inputs → generate → stream result.
  - **chat:** one-time sandbox inputs + multi-turn conversation (greeting, starters, send/stop/regenerate).
  - **multi-stage:** chained outputs (e.g., Cognitive Architect: design → lessons → assessments → feedback).
- **Context model:** See `wiki/Context-Model.md` — the "Task Sandbox" (per-tool inputs) + a user profile injected into every prompt as `{{context}}`.

## Quality Principles → Enforcement

New behavior starts as a failing test. These principles hold without repetition:

### 1. Test-Driven Development (TDD)
**The rule:** Red → Green → Refactor. Every new feature, fix, or tool starts with a test under `tests/`.

**Enforcement:**
- Unit/pipeline: `tests/**/*.test.ts` (node environment) — registry, prompts, `buildSystemPrompt`, i18n parity, tool data.
- Component + a11y: `tests/**/*.test.tsx` (happy-dom environment) — every interactive UI component ships a `vitest-axe` test asserting zero violations.
- Run via `npm test` or `npm run test:watch`.

### 2. Security-by-Design
**The rule:** All external input validated with Zod at the boundary. Secrets via `env.server` only. LLM output via ReactMarkdown (no `dangerouslySetInnerHTML`). Image uploads constrained by MIME allow-list + size cap.

**Enforcement:**
- The `/api/stream` boundary parses the whole request body with `StreamBodySchema` (Zod) — every field length/count-capped (plain fields 20k chars; `kind: "document"` fields 300k, checked by `fieldCapError` once the tool is known, with an actionable error); a bad body returns a localized SSE error, never a stack trace. Extend that schema, never `request.json()` directly.
- Extend `app/server/env.server.ts` for server secrets.
- Extend `app/lib/registry/validate.ts` for runtime validation; it runs at boot (`registry/boot.server.ts`) — dev throws, prod logs + excludes the bad tool.
- Tool prompt "boundaries" sections (the book's *Voice & Bounds*) act as guardrails.
- Review: `npm run check` (biome).

### 3. Accessibility-by-Design
**The rule:** Semantic HTML, label/`htmlFor`, `fieldset`/`legend`, focus-visible, live regions for streaming (`aria-live="polite"`), skip link. **Every interactive component ships a vitest-axe test.**

**Enforcement:**
- Component test per UI element under `tests/components/**/*.test.tsx`.
- Assert zero violations with vitest-axe: `expect((await axe(container)).violations).toEqual([])` (import `axe` from `vitest-axe`).
- `npm test` runs all `.test.tsx` tests; do not merge without green axe.
- **Feedback/announce layer (P15).** The skip link, route-change announcer, and focus-to-main live in `AppShell` (`<a href="#top">` `sr-only focus:not-sr-only` → `<main id="top" tabIndex={-1}>`; a polite `RouteAnnouncer` reads `document.title` after each client navigation). Action feedback goes through the global **toast** system (`app/components/Toast.tsx`, mounted in `root.tsx`): a route calls `useFormToast(actionData, { result, pending? })` once — a pending toast on submit that updates in place to a success/error result. **Do not** also announce the same event inline: strip `role="status"`/`role="alert"`/`aria-live` from transient confirmations on a wired route so only the toast announces (keep persistent content like generated links). Admin tables autosave through `AutoSaveForm` (fetcher + `useActionToast`, revert on error); no per-row save buttons (P18). `useToast()` no-ops without a provider, so route-component tests render untouched.

### 4. Deep Modules (Ousterhout)
**The rule:** Narrow interfaces over powerful implementations. The runtime already embodies this; new infra (chat engine, image pipeline) expose a small surface (`streamPost`, one `api.stream` action, `ChatView`) hiding complexity.

**Enforcement:**
- New tools add **data, not control flow**. If you're adding an `if (tool.mode === 'chat')` branch, refactor toward deeper components instead.
- Code review points: is this a deep module? Does the interface hide complexity?

### 5. Maintainable / Extensible / Sustainable
**The rule:** Single source of truth for docs (AGENTS.md), tools-as-data, engine stays locale/level-neutral (country/sector specifics live in *packs*), versioned prompt ids (`@v1`) for safe evolution, pinned toolchain (Volta Node 24.14.1).

**Enforcement:**
- Docs: update AGENTS.md, CLAUDE.md, `wiki/` when architecture or conventions change.
- Tools: register in `app/lib/registry/tools/` and `app/lib/prompts/` only; no inline prompts.
- Versioning: new prompt → `<id>@v2.prompt.ts`; old `@v1` kept until no active session uses it.
- Toolchain: use Volta pinned version; `npm install` respects `volta.node` in `package.json`.

## Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests (node + DOM environments). |
| `npm run test:watch` | Watch mode; re-run on file change. |
| `npm run typecheck` | TypeScript + React Router type generation. |
| `npm run lint` | Check code style (biome). |
| `npm run check` | Full check: types + lint. |
| `npm run dev` | Start the dev server (React Router). |
| `npm run build` | Production build. |
| `npm run db:generate` | Generate Drizzle schema migrations. |
| `npm run db:migrate` | Apply migrations. |
| `npm run db:push` | Push schema to database. |

## Conventions

### Internationalization (i18n)
- **Displayed strings:** wrap in `LocalizedText` (`{ nl: "...", en: "..." }`).
- **Option values:** stable English slugs (e.g., `value: "essay"`), never user-facing.
- **Labels:** always bilingual; option `label: LocalizedText`, field `label: LocalizedText`.
- **Parity:** `tests/i18n.test.ts` enforces NL/EN coverage in `app/lib/i18n/messages/{nl,en}/`.
- **One file per namespace:** each top-level namespace (`home`, `admin`, `portfolio`, …) lives in `app/lib/i18n/messages/{nl,en}/<namespace>.ts`; `nl/index.ts` and `en/index.ts` only compose them (alphabetical). Add strings to your own area's file, or add a new namespace file + one line in each index. `tests/hotspots.test.ts` enforces the split.

### Routes
- `app/routes.ts` only composes; the routes live per area in `app/routing/<area>.ts` (a `RouteArea` with `shell` routes inside the AppShell layout and `standalone` routes outside it). A new area = a new file + one import and one line in `routes.ts`. Tests read the evaluated table via `tests/helpers/routes.ts` (`flatRoutes`, `routeTable`), never the source text of `routes.ts`.

### Prompts & Placeholders
- **Every `{{placeholder}}` must have a source.** Either:
  - Tool input field (e.g., `{{studentResponse}}` from an InputField named `studentResponse`).
  - Context injection (e.g., `{{context}}` built by `buildSystemPrompt`).
  - Stage dependency (e.g., `{{coordinatesDocument}}` from an earlier stage's output).
  - Validate in `tests/tools/<id>.test.ts` — `buildSystemPrompt` should resolve all placeholders.
- **Versioned ids:** new prompt → `app/lib/prompts/<id>@v1.prompt.ts`; future edits → `@v2`, etc.

### Engine Neutrality
- The engine (`app/lib/registry/`, `app/routes/api.stream.tsx`, `app/lib/ai/provider.ts`) stays **locale/level-neutral.**
- Country/sector/level specifics live in **packs** (see `wiki/Internationalization.md`).
- A new tool's prompt can be Dutch-first, but the engine routes it via the same `streamChat` interface.

### Access & Availability (roles, instance settings)
- **Roles:** `teacher | admin` (`ROLES`/`isRole` in `app/lib/registry/access.ts`; P17 removed the student role and cohorts). Every signed-in teacher or admin sees every tool unless a gate below narrows it — there is no role × tool audience check. The string `"student"` survives only as **tool data** (`Tool.userType`: who a tool speaks to, which drives the `audience: "learner"` level directive and the home-page filter), never as a role. A legacy `users.role = "student"` row (pre-P17 data, until the 17.3 migration) counts as logged out (`getUser`/`login`), and a student/cohort invite is invalid (`invite.tsx`).
- **Effective availability:** `app/server/availability.server.ts` applies one gate on top of the registry's boot-validity check — instance settings (admin `tool_settings.enabled`) — in `isToolAvailable`/`getAvailableTools`. There is no per-teacher tool gate (P18): every teacher and admin sees what the instance enables; the legacy `users.allowed_tool_slugs` column is ignored (dropped in 18.8). Enforced server-side in the home loader, the tool loader (404), and the stream action (refuse). Empty settings = `tool.enabled` for everyone.
- **Sessions (P17):** the cookie carries `{ userId, sessionVersion }`. Logging in does **not** invalidate other sessions — one person may be signed in on several devices at once. `users.sessionVersion` is bumped in **exactly three places**: `updateUserPassword` (reset link in `reset.$token.tsx`, password change on `/account`, the owner setting a password), `setUserDisabled(id, true)` (the owner deactivating an account, P18.7) and `setUserRole` when the role actually changes (teacher ↔ admin, P18.9; a same-role set is a no-op; nobody changes their own role, so no cookie reissue). `getUser` rejects a cookie whose version is behind, so a new password logs out every other device (the device that made the change gets a re-issued cookie, `reissueSessionCookie`), a role change logs that user out everywhere (an old teacher session must not silently become an admin one), and a deactivation logs the user out everywhere for good — reactivating does not bring old cookies back. `getUser` also returns `null` for a row with `disabledAt`. Never bump it anywhere else.
- **Model availability uses OVERRIDE (P18; instance → teacher).** The instance sets `enabledModels` (`null` = the whole selectable catalog). A **teacher** with `assignedModels:<userId>` gets exactly that set **instead** — it replaces the instance and may be wider; no own set = follow the instance; an **admin** has no own set and always gets the instance set. An own set that is empty after filtering (only unknown ids, or only CLI/local ids in production) counts as not set; one lockout fallback to `DEFAULT_MODEL` (with a log) remains for an empty instance set. `getSelectableModelIds(user)`/`getSelectableModels(user)` enumerate the catalog; `isModelSelectableForUser(user, id)` is the membership walk that also governs volatile discovered ids like `ollama::…`; the pickers narrow the discovered half via `narrowLocalModels(user, discovered)`. Enforced in the stream + offered in the tool loader. Admin write UI: the instance set in `admin.tools.tsx` (intent `models`), the per-teacher override in `admin.users.tsx` (intent `teacherModels`, "follows the instance" or "own selection"; the checkboxes run over the whole catalog, built by `app/server/modelCatalog.server.ts`). Per-teacher = `instance_settings` (no migration); `deleteUserCascade` removes the key.
  - **CLI agents and local (Ollama/LM Studio) models exist only outside production** — `localModelsEnabled()` in `app/server/env.server.ts` (`NODE_ENV !== "production"`, read per call). In production they are not offered, not discovered (the tool loader skips discovery) and not executed (`isModelSelectableForUser` refuses them). The pilot runs on `npm run dev`, so they work there.
- **Owner / super admin (P18.6):** one admin is the owner: `instance_settings.ownerUserId`, set with `npm run set-owner -- --email …` (refuses a non-admin), read through `isOwner(user)` in `auth.server.ts` (`role === "admin"` and the stored id matches; a key pointing at a demoted or deleted account is "no owner"). Only the owner changes roles (teacher ↔ admin) and does e-mail / reset link / delete on an **admin**; a regular admin does those on teachers only (`mayManage` in `admin.users.tsx`; refusal = `{ error: "ownerOnly" }`, checked in the action, the UI only hides). Both manage invites and per-teacher models; nobody changes their own role or deletes themselves on `/admin/users`, and the owner cannot delete their account on `/account`. **Invites never make admins** (`consumeInvite` and `invite.tsx` accept `role = "teacher"` only; `scripts/invite.ts` has no `--role`). Until `set-owner` has run there is no owner and nobody can change a role.
- **Owner accounts (P18.7):** only the owner (`ownerOnly` for everyone else, checked first, whatever the target) uses the `admin.users.tsx` intents `createAccount` (name, e-mail, role, `passwordMode` `link` → `NO_PASSWORD` + a 7-day reset link shown as a copyable card, or `password` ≥ 10 chars → `hashPassword`), `setPassword` (`updateUserPassword`, logs the user out everywhere), `deactivate`/`reactivate` (`setUserDisabled`). Never on the owner's own row (`selfPassword`/`selfDeactivate`). No e-mail is sent (no mail provider is approved): links are copied by hand, and no password ever goes back to the client.
- **Account removal (P17):** everyone (teacher and admin) deletes their own account on `/account` — immediate, permanent (`deleteUserCascade`), after typing the confirmation word. There is no removal request. `users.disabled_at` is back (P18.7, migration `0009`), but with a new meaning: the owner's reversible **deactivation** of a teacher or admin (login refused with `auth.accountDisabled` only after a correct password; `getUser` null; data kept; a deactivated user's reset link is invalid and unspent until reactivation). An admin deletes other users from `/admin/users`.
- **Admin console (P18.4):** four pages, no overview — `/admin/users` (invites, user list, models per teacher), `/admin/tools` (tools + instance models), `/admin/context`, `/admin/usage` (usage + tester feedback). `/admin` redirects to `/admin/users`; the old `/admin/invites`, `/admin/models` and `/admin/feedback` no longer exist.
- **Context-editor axes (sector/domain) follow the instance settings** (`enabledSectors`/`enabledDomains`, via `getAvailableSectors`/`getAvailableDomains`/`getAvailableDomainSlugs`); no per-teacher access and no country axis (P18). The country survives only as a data seam (`profile.country` is always `"NL"`; pack data stays keyed by country). Admin write UI: `admin.context.tsx`. Leftover `contextCustomAccess:`/`assigned{Countries,Sectors,Domains}:` keys are ignored.

### Repositories & the DB seam
- All DB access goes through repositories under `app/server/repositories/`; **every exported DB function is `async`** (portability insurance) and **scoped to its owning `userId`** in the WHERE clause. No better-sqlite3 API outside `db.server.ts`.
- Schema is lean after P18.8: no `projects`, `chat_sessions`, `messages` tables and no `allowed_tool_slugs`/`project_id` columns; a teacher's work lives in `generations` (chat transcripts included).
- `getDb()` is the seam: tests point `DATABASE_URL=file::memory:` before importing any server module. List queries are capped (`Math.min(limit ?? 50, 500)`).

### Level adaptation (EQF) & prompt authoring
- Level reaches every context-injecting tool through `{{contextProfile}}` via `formatProfile` (`app/lib/context/format.ts`) — a country-neutral EQF 1–8 directive, reader-aware (`audience: "learner"` for the direct-address tutors, `"instructor"` otherwise). The engine never branches on level.
- **New prompts** follow `app/lib/prompts/TEMPLATE.md` (Voice & Bounds; multi-turn stability tokens) and are covered by the eval harness (`npm run eval`; needs `ANTHROPIC_API_KEY` — see `evals/README.md`).

## Per-Tool Recipe (The TDD Loop)

See `wiki/Adding-a-Tool-or-Pack.md` for the full depth. Sketch:

1. **RED** — write `tests/tools/<id>.test.ts` (node environment):
   - Assert `getToolBySlug("<id>")` resolves it.
   - Assert `buildSystemPrompt(tool, inputs)` contains anchors, no unresolved `{{…}}`.
   - Assert required fields enforced, NL/EN parity.
   - Run → fails (tool absent).

2. **GREEN** — author:
   - `app/lib/prompts/files/<id>.{nl,en}.md` (prompt text + placeholders).
   - `app/lib/prompts/<id>@v1.prompt.ts` (verbatim + `buildPrompt` export).
   - `app/lib/registry/tools/<id>.ts` (Tool shape: `id`, `title`, `inputs`, `mode`, etc.).
   - Register in `app/lib/prompts/index.ts` + `app/lib/registry/index.ts`.
   - Existing tests now cover it; run `npm test`.

3. **REFACTOR** — extract shared input groups/option sets if duplicated.

4. **(chat tools only)** — add `tests/components/<id>.test.tsx`:
   - Render greeting, send a message, stream a turn.
   - Assert `expect((await axe(container)).violations).toEqual([])` (vitest-axe).

5. **GATE** — `npm test` · `npm run typecheck` · `npm run check` all green.

Use the `/tdd` skill for ready-to-copy test templates.

## The Tool Roadmap (15 shipped)

**All 15 tools are shipped** — the 14 from *The Pedagogical Promptbook* plus one original (Stage Assessment). The build roadmap below is complete; further work tracks enhancements (help/docs, per-country packs), not new core tools.

| # | Chapter | Tool | Mode | Status |
|---|---------|------|------|--------|
| 1 | From Model to Mentor | MentorAI | chat | ✅ shipped |
| 2 | Contextualization | Contextualization | one-shot | ✅ shipped |
| 3 | Think-Pair-Share | Think-Pair-Share | chat | ✅ shipped |
| 4 | Guided Reflection | Guided Reflection | one-shot | ✅ shipped |
| 5 | Dialogic Encounters | Dialogic Encounters | chat | ✅ shipped |
| 6 | Forum Autograder | Forum Autograder | one-shot | ✅ shipped |
| 7 | Handwritten Math | Math Grading | one-shot + image | ✅ shipped |
| 8 | Authentic Assessment | Authentic Assessment | one-shot | ✅ shipped |
| 9 | ARCS Reactor | ARCS Reactor | one-shot | ✅ shipped |
| 10 | Bloom by Design | Bloom by Design | chat | ✅ shipped |
| 11 | Peer Tutoring | Peer Tutoring | chat | ✅ shipped |
| 12 | Automating Gagné | Cognitive Architect | multi-stage | ✅ shipped |
| 13 | Scaffolding | Scaffolding Feedback | chat | ✅ shipped |
| 14 | Oracle to Socratic | Socratic Partner | chat | ✅ shipped |
| 15 | — (original) | Stage Assessment | one-shot | ✅ shipped |

## Key Files

- **Audit & improvement program (July 2026):** `docs/Audit-2026-07.md` (findings), `docs/Improvement-Plan.md` (decisions & roadmap), `docs/implementation/P0…P5` (per-phase session briefs — execute in order, see `docs/implementation/README.md`).
- **New:** `AGENTS.md`, `CLAUDE.md`, `.claude/skills/tdd/SKILL.md`, `tests/setup.ts`, per-tool `tests/tools/*.test.ts`, `tests/components/*.test.tsx`.
- **Modified (S1 foundation):** `vitest.config.ts` (dual projects), `package.json` (dev deps).
- **Modified (later phases):** `api.stream.tsx` (chat + images), `tool.tsx` (mode branching), `DynamicForm.tsx` (image control + `document` upload control), `registry/types.ts` (ChatConfig i18n; `document` field kind), `prompts/index.ts`, `registry/index.ts`, `messages/{nl,en}/`.
- **Document upload (client-side):** `app/lib/documents/extract.ts` — `fileToText`/`extractTextFromBytes` lazily load `unpdf` (PDF) + `mammoth` (DOCX), extract text in the browser, and fill a `kind: "document"` textarea. No server endpoint; `buildSystemPrompt` and `api.stream` are unchanged (the value stays a plain string). Fixtures: `tests/fixtures/generate.mjs`.
- **Document viewer (P24, 24.0c):** `app/components/documents/DocumentViewer.tsx` shows the original of every `kind: "document"` field next to the text that goes to the AI (side by side in a wide container, two tabs when narrow), opened by `GeneratorView` via `DynamicForm`'s `onDocumentFiles` — data, no per-tool branch. Everything stays in the browser: `app/lib/documents/original.ts` (PDF pages through `unpdf`'s pdf.js, drawn lazily; DOCX through mammoth), `docxHtml.ts` (mammoth HTML → allow-listed `SafeNode` tree, rendered by `SafeNodes`, never `dangerouslySetInnerHTML`), `locate.ts` (pure: find a quote despite line breaks/hyphenation, no false hits; `extractQuotes` feeds "Toon in document"). The original is never uploaded or stored.
- **Anonymise before sending (P24, 24.0b):** a field with `redact: true` (data on `InputField`; now `stage-assessment` `document`/`companyEvaluation` and `forum-autograder` `discussionThread`) makes `GeneratorView` show `RedactReview` (`app/components/privacy/`) before `streamPost`: the teacher names student, student number, company (+ neutral description), supervisors and extra words; `app/lib/privacy/redact.ts` (pure) also catches e-mail, phone, postcode, IBAN and 6–8-digit numbers, marks every replacement with its code, lets the teacher undo one, and sends only codes. The code → name table lives in component memory; `restoreNames` puts the names back in what the teacher sees, while `generations` keeps the coded version. Server and `buildSystemPrompt` are unchanged.
- **BDB/BKE workplace (P25):** a separate part of the app at `/portfolio` (fifth menu item "BDB/BKE"). Domain in `app/lib/portfolio/` (pure: `types`, `schema` with `LIMITS`, immutable `edit`, deterministic `progress`, public `skeleton`); every `<Form intent>` goes through `applyIntent` (`intents.ts`, Zod per intent, never throws); routes stay thin via `app/server/portfolio.server.ts` (`loadDossier` = role gate + owner-scoped load, 404 otherwise; `saveIntent`). Storage: `portfolio_dossiers` (one JSON graph per dossier, re-parsed on every write). Only the teacher sets a criterion status. **Coach (P25.5):** `app/lib/portfolio/coach.ts` (pure: the user message with the teacher's material as tagged data under keys K1…, and `parseCoachReview`, which refuses a missing/duplicate/unknown criterion, drops a quote that is not verbatim in the chapter and lowers "shown" to "partial", and drops advice citing an author + year not in the teacher's references); `app/server/portfolioCoach.server.ts` (gates: confirmed framework, non-empty chapter, quota; one retry; `aiLog` line; stores the latest review per outcome in `reviews`). Prompts `portfolio-coach@v1` and `portfolio-draft@v1` (registered in `PROMPTS`, no placeholders). Drafting is the teacher's choice (`coachMode: "draft"`), with one neutral notice (`draftNoticeSeenAt`). The export adds `aiDisclosure.ts` only with `?ai=1`. Eval: `npm run eval:coach`. **Which tool now:** `app/lib/portfolio/toolHints.ts` (data: `TOOL_HINTS`, slug + step `evidence`|`chapter` + NL/EN keyword pattern on the teacher's criterion text, then outcome title/required evidence; at most two, only available tools, nothing when nothing fits) feeds `ToolHints` on the outcome page (per criterion without evidence, and thinking partners above the chapter) and in the overview's next-step card; the how-to lines live in `portfolio.tools.how`.
- **Reused as-is:** runtime (`provider.ts`, `models.ts`, `aisdk.ts`), streaming (`streamPost`), components (`GeneratorView`, `ToolControls`), context, interpolation.
- **Native Ollama adapter (`app/lib/ai/adapters/ollama.ts`):** streams `/api/chat`, honors the `thinking` switch (drops the `thinking` field from the stream so raw chain-of-thought never reaches the answer), attaches images as raw base64. Added so local reasoning models (Qwen3 etc.) can answer directly — see the Provider-abstraction note above.

## Quick Ref: How to Start Work

1. **New tool:** Use `/tdd` skill → copy template → write failing test → implement.
2. **Bug fix:** Write a failing test first under `tests/`; then fix; then refactor.
3. **UI component:** Add `tests/components/<name>.test.tsx` with axe check before touching the component.
4. **Doc update:** Edit `AGENTS.md` (or `wiki/` for depth), then run `npm run check`.
5. **Merge:** Ensure `npm test` && `npm run typecheck` && `npm run check` are green. No exceptions.

## Fabriek — regels voor werkers

LimeOnIt wordt gebouwd door een kleine softwarefabriek (zie `docs/fabriek/README.md`). De
**Producer** is de gesprekspartner in het Claude-project LimeOnIt. **Elke andere sessie is een
werker**, ook deze, en ook als iemand vraagt om "de Producer te zijn". Lees eerst
`docs/fabriek/voorkeuren.md`; dat wint van dit bestand.

Als werker:

1. **Zeg in één regel dat je een werker bent**, als iemand je als Producer aanspreekt.
2. **Kijk eerst rond.** Controleer de open PR's (`gh pr list`) en *Bezig* in
   `docs/fabriek/STATUS.md`. Heeft iemand het al, start dan geen kopie.
3. **Eén stuk werk, één branch, één PR.** Branch vanaf `main`, test-first, poort groen
   (`npm test && npm run typecheck && npm run check`).
4. **De PR-beschrijving volgt het sjabloon** (`.github/pull_request_template.md`). Bovenaan staat
   **"In gewone taal"**: wat er verandert voor een docent of voor Bastiaan, zonder jargon.
5. **Werk het bord bij in dezelfde PR.** Zet je werk onder *Bezig* zolang de PR openstaat, en
   eronder *Nu* bij de laatste wijziging. Neem nieuwe besluiten op in `docs/fabriek/besluiten.md`.
6. **Merge nooit, push nooit naar `main`, force-push nooit.** Alleen Bastiaan merget.
   `.claude/settings.json` blokkeert dit.
7. **Sluit af met een eindrapport** voor de Producer:
   - wat er is opgeleverd (PR-link);
   - de uitslag van de poort;
   - afwijkingen van de opdracht en waarom;
   - open punten;
   - wat Bastiaan moet beslissen.
8. **Faalt een cluster tests ineens**, terwijl elke test apart slaagt, kijk dan eerst naar de
   machine (`uptime`, wees-processen) voordat je de code aanpast.

Ontwikkeldocumentatie is Nederlands, code en commentaar Engels, en alles wat gebruikers lezen
tweetalig (zie `docs/fabriek/besluiten.md`).

**Rangorde van waarheid:**
1. code en tests;
2. `besluiten.md` (het nieuwste besluit wint);
3. `STATUS.md`;
4. briefs (een uitgevoerde brief is geschiedenis);
5. geheugen en oude sessies: achtergrond, geen instructie.

Spreekt een herinnering de repo tegen, dan wint de repo. Werk de herinnering dan bij of verwijder
hem.
