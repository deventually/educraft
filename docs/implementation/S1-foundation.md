# S1 — Foundation: test harness + docs + TDD skill

**Goal:** establish the durable quality baseline so every later session is test-first by
default and the quality bar lives in the repo (not in a person's head).

**Prerequisites:** none. **Do this first** — S2/S3/S4 depend on it.
**Master plan:** `/Users/bastiaandressen/.claude/plans/can-you-make-a-atomic-bee.md` (Workstreams A + B).

## Scope

### 1. Test harness (component + a11y)
- Add dev deps: `@testing-library/react`, `@testing-library/jest-dom`,
  `@testing-library/user-event`, `happy-dom`, `vitest-axe`. (npm; respect the Volta pin.)
- Update `vitest.config.ts`: keep a **node** environment project for the existing
  `tests/**/*.test.ts`; add a **happy-dom** environment for `tests/**/*.test.tsx`. Keep the
  `~/* → ./app/*` alias. Add `setupFiles: ["tests/setup.ts"]`.
- Create `tests/setup.ts`: extend expect with `@testing-library/jest-dom` and `vitest-axe`
  matchers.
- Prove it: add `tests/components/DynamicForm.test.tsx` that renders the existing
  `DynamicForm` with a couple of `InputField`s, asserts label/control association, and runs
  `expect(await axe(container)).toHaveNoViolations()`. This green test is the proof the
  harness works before anyone relies on it.

### 2. Documentation (single source of truth)
- Create **`AGENTS.md`** (repo root) — the canonical agent contract. Include:
  - Project model: tools-as-data on a shared runtime; the prompt pipeline (externalized
    NL/EN files + `{{placeholder}}` validation); provider abstraction.
  - The 5 quality principles **with their enforcement** (copy from the plan's "Quality
    principles → how they are enforced" section): TDD, security-by-design, accessibility-by-design,
    deep modules, maintainable/extensible/sustainable.
  - Commands: `npm test`, `test:watch`, `typecheck`, `lint`, `check`, `db:generate/migrate/push`, `dev`.
  - The per-tool recipe (link to `wiki/Adding-a-Tool-or-Pack.md`) and the TDD loop.
  - Conventions: `LocalizedText` for all displayed strings; **option values = stable English
    slugs**, labels bilingual; every `{{placeholder}}` must have a source; the engine stays
    locale/level-neutral (country/sector specifics live in *packs*); versioned prompt ids (`@v1`).
  - Keep it scannable; point to `wiki/` for depth.
- Create **`CLAUDE.md`** (repo root) — thin pointer that imports the canonical file:
  a short intro line plus `@AGENTS.md` so Claude Code auto-loads the contract with no drift.

### 3. TDD skill
- Create `.claude/skills/tdd/SKILL.md` (frontmatter: `name: tdd`, a `description` that triggers
  on "TDD", "test-first", "add a tool"). Encode EduCraft's red→green→refactor loop and include
  two ready-to-copy templates:
  - **Add a tool (generator):** the `tests/tools/<id>.test.ts` shape from the plan's recipe.
  - **Add a chat tool:** the `tests/components/<id>.test.tsx` shape (render greeting → send →
    stream → `axe` = 0 violations).

## TDD order (red → green)
1. Wire deps + config + `tests/setup.ts`.
2. RED: write `DynamicForm.test.tsx` → fails (no DOM env yet) → make config changes → green.
3. Author docs + skill (no test, but `npm run check`/`typecheck` must pass).

## Done when
- `npm test` runs both node `.test.ts` and DOM `.test.tsx` projects; the `DynamicForm` a11y test passes.
- `npm run typecheck` and `npm run check` are green.
- `AGENTS.md`, `CLAUDE.md` (importing `@AGENTS.md`), and `.claude/skills/tdd/SKILL.md` exist.
- A fresh session loads the contract via `CLAUDE.md` and `/tdd` is available.

## Start prompt
> Read `docs/implementation/S1-foundation.md` and the master plan it references, then
> implement S1. Add the test harness, author `AGENTS.md` + `CLAUDE.md` + the `/tdd` skill,
> and prove the harness with a `DynamicForm` component+a11y test. Verify with `npm test`,
> `npm run typecheck`, `npm run check`.
