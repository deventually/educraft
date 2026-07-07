# AGENTS.md — LimeOnIt's Agent Contract

This is the canonical contract for AI agents and developers working on LimeOnIt. Adherence is enforced via tests, tooling, and the TDD loop below. One source of truth — see `CLAUDE.md` for how this auto-loads.

## Project Model

**LimeOnIt** turns *The Pedagogical Promptbook* (David Wiley, ed., CC BY 4.0) into a React Router 7 app for Dutch education (VO/mbo/hbo/wo).

- **Tools as data:** Every pedagogical tool from the book conforms to one shape (a `Tool` registry entry) regardless of mode. No control-flow branching for each tool — capability grows by data addition, not engine churn.
- **Prompt pipeline:** Prompts are externalized per language (NL/EN) as `.md` files with `{{placeholder}}` syntax. Each tool lives in `app/lib/prompts/<id>.prompt.ts` (registered) with language variants in `app/lib/prompts/files/<id>.{nl,en}.md`. Placeholders are validated at build time.
- **Provider abstraction:** The AI layer (`app/lib/ai/provider.ts`) abstracts Claude/OpenAI/local models behind one interface. Tools never import specific SDKs.
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
- The `/api/stream` boundary parses the whole request body with `StreamBodySchema` (Zod) — every field length/count-capped; a bad body returns a localized SSE error, never a stack trace. Extend that schema, never `request.json()` directly.
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
- **Parity:** `tests/i18n.test.ts` enforces NL/EN coverage in `app/lib/i18n/messages/{nl,en}.ts`.

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

### Access & Availability (roles, cohorts, instance settings)
- **Roles:** `student | teacher | admin` (`app/lib/registry/access.ts`). `canUseTool(user, tool, allowedSlugs?)` is the one source of truth for role × tool visibility — data-driven, no per-tool branching. Students see only student/`both` tools, narrowed to their cohort's allow-list.
- **Effective availability:** `app/server/availability.server.ts` composes three gates — instance settings (admin `tool_settings`), role/cohort (`canUseTool`), per-teacher allow-list — into `isToolAvailable`/`getAvailableTools`. Enforced server-side in the home loader, the tool loader (404), and the stream action (refuse). Empty settings = pre-P4 behaviour.
- **Cohorts & student provisioning (P6):** a teacher provisions a cohort once (allowed tutors + per-tutor sandbox config + a context profile *or* bare EQF + access window); per-student single-use invites join it. The stream injects the cohort's config values (server-authoritative — beats a tampered body) and, by membership, the teacher's profile (`getProfileForMember`, the one sanctioned bypass of owner-scoping). Anti-sharing: single active session via `sessionVersion` (a stale cookie ⇒ logged out). Repos: `cohorts.server.ts`.
- **Mentor insight (P7):** privacy-safe — de-personalised `session-summary`, engagement/effectiveness rollups, student self-report; never the raw transcript.
- **Model availability uses INTERSECT, three levels (P13, extended P14).** `getSelectableModelIds(user)`/`getSelectableModels(user)` narrow the instance base (client-selectable catalog ∩ admin `enabledModels`) by the caller's role: a **teacher** ∩ their `assignedModels:<userId>` (admin write UI: per-teacher section of `admin.models.tsx`), a **student** ∩ their cohort's `allowedModelsJson` (teacher write UI: `cohorts.$id.tsx`). Empty/unset at a level = inherit the level above; one lockout fallback to `DEFAULT_MODEL` after. Enforced in the stream + offered in the tool loader. **Unlike the P12 context axes (override), models only ever narrow** — a billing/safety cap, so a teacher/cohort can never widen past the instance. Per-teacher = `instance_settings` (no migration); per-cohort = the `cohorts.allowedModelsJson` column.
  - **P14: local/CLI/discovered models ride the same intersect** — still *free*, now *curatable* (no more silent free-pass). Enforcement uses `isModelSelectableForUser(user, id)` (a membership walk over the same three levels, so it governs volatile discovered ids like `ollama::…` without enumerating any local server); the stream calls it instead of the old `resolveModelInfo(id).local === true` pass. The pickers narrow the discovered half via `narrowLocalModels(user, discovered)`; the admin/cohort config UIs show local/CLI as toggles (grouped Frontier / CLI / Local — the `!m.local` filter is gone). `null`/unset at every level still = all (an uncurated instance is unchanged, back-compat). Students never pick a model — the gates only govern what admin/teacher may *offer*.
- **Account disable + student-initiated removal (P14).** A *student* on `/account` may only **request removal**: `requestAccountDeletion` sets `users.disabledAt` + `users.deletionRequestedAt` (migration 0007) — a reversible holding state, not a delete. `disabledAt` blocks login everywhere (`getUser` returns null; `login` refuses with `accountDisabled`). The teacher sees the flag on the **cohort manage screen** (`cohorts.$id.tsx` Students section) + a count badge on the cohort list / admin cohorts. Teacher/admin then **Remove** (`deleteUserCascade` — hard purge) or **Restore** (`reactivateUser` — clears both flags), guarded by `assertManagesMember` (actor manages the cohort AND target is a member, else 404). Teachers/admins keep the immediate hard delete on their own `/account`.
- **Context-editor axes (country/sector/domain) use an OVERRIDE model, NOT the tool-gate intersect (P12).** `getAvailableCountries`/`getAvailableSectors`/`getAvailableDomains` (+ `getAvailableDomainSlugs` for the editor loader) resolve one selection via `axisSelection` + `resolveAxis`: an admin or an *unactivated* teacher inherits the instance-enabled set (`enabledCountries`/`enabledSectors`/`enabledDomains`; `null` = all); a teacher with **custom access** (flag `contextCustomAccess:<userId>`) replaces the instance entirely with their own assignment (empty axis = all, instance ignored — they may be granted more than the instance). Deactivating is non-destructive (flip the flag only; assignments preserved). Admin write UI: `admin.context.tsx`. No intersection ⇒ disjoint instance/teacher settings never silently widen to the full catalogue. All keys live in `instance_settings` (no migration).

### Repositories & the DB seam
- All DB access goes through repositories under `app/server/repositories/`; **every exported DB function is `async`** (portability insurance) and **scoped to its owning `userId`** in the WHERE clause. No better-sqlite3 API outside `db.server.ts`.
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
- **Modified (later phases):** `api.stream.tsx` (chat + images), `tool.tsx` (mode branching), `DynamicForm.tsx` (image control + `document` upload control), `registry/types.ts` (ChatConfig i18n; `document` field kind), `prompts/index.ts`, `registry/index.ts`, `messages/{nl,en}.ts`.
- **Document upload (client-side):** `app/lib/documents/extract.ts` — `fileToText`/`extractTextFromBytes` lazily load `unpdf` (PDF) + `mammoth` (DOCX), extract text in the browser, and fill a `kind: "document"` textarea. No server endpoint; `buildSystemPrompt` and `api.stream` are unchanged (the value stays a plain string). Fixtures: `tests/fixtures/generate.mjs`.
- **Reused as-is:** runtime (`provider.ts`, `models.ts`, `aisdk.ts`), streaming (`streamPost`), components (`GeneratorView`, `ToolControls`), context, interpolation.

## Quick Ref: How to Start Work

1. **New tool:** Use `/tdd` skill → copy template → write failing test → implement.
2. **Bug fix:** Write a failing test first under `tests/`; then fix; then refactor.
3. **UI component:** Add `tests/components/<name>.test.tsx` with axe check before touching the component.
4. **Doc update:** Edit `AGENTS.md` (or `wiki/` for depth), then run `npm run check`.
5. **Merge:** Ensure `npm test` && `npm run typecheck` && `npm run check` are green. No exceptions.
