# Phase 5 — Test Debt & Tech Debt

## Context & goal

The audit found the project's TDD contract violated in specific, listable places: the core streaming route has almost no tests, the multi-stage orchestrator has none, one tool lacks its registry test, five interactive components lack their mandated axe tests, and several small architecture leaks (hardcoded Dutch error fallback, duplicated sandbox logic, registry validation never running at boot) accumulated. This phase pays that debt down and makes `AGENTS.md` truthful again.

Run this phase **after** Phases 0–4 so tests are written against the final (auth-gated, availability-aware) behavior rather than rewritten twice. If Phases 3–4 slip, items 5.1, 5.2, and 5.4–5.7 can run any time after Phase 1.

Audit findings closed: #7, #13 (client half), #15, AGENTS.md drift.

## Constraints

- `AGENTS.md`: gates green; axe assertions in every component test; tests must be meaningful (assert behavior, not existence).
- No new runtime dependencies for testing; use the existing vitest dual-project setup (`vitest.config.ts`: node + happy-dom).
- Dependency upgrades land as **separate commits/PRs each**, never mixed with test or feature work.

## Features

### 5.1 api.stream integration tests

**File:** `tests/api/stream.test.ts` (extend/replace the narrow `stream-images.test.ts` harness — read it first; it already mocks the provider). Cover, with the provider mocked:

- Happy paths: one-shot (trigger message built, language directive applied), chat (messages validated, `reinforceLanguage` applied to last turn only), multi-stage (priorOutputs + `stage.consumes` land in the system prompt).
- Persistence branches: chat with valid `sessionId` (8–100 chars) → `upsertChatGeneration` with rebuilt transcript; one-shot → `saveGeneration`; save-failure (`throw` in repo mock) does not kill the stream (error is caught + logged).
- Every refusal path returns a **localized SSE error frame and never calls the provider**: unknown slug, auth missing, role not allowed for tool, disabled tool, invalid body, oversized values, invalid messages, non-vision model + images, rate-limited, over quota.
- SSE mechanics: token frames accumulate in order; a provider mid-stream throw produces a trailing error frame (test through `sseStream` with a failing async iterator).

### 5.2 Missing component & tool tests

All in `tests/components/`, happy-dom, axe zero-violations each, mocking `streamPost`/loaders as the existing `ChatView.test.tsx`/`GeneratorView.test.tsx` do:

- **`StageStepper.test.tsx`** (highest risk — written last-minute features live here): renders stages from a multi-stage tool fixture; stage 2 disabled until stage 1 completes; prior output threaded into the next stage's request body; abort mid-stream leaves a re-runnable stage; required-field validation blocks generation with a localized error; axe.
- **`ToolControls.test.tsx`**: model picker lists provided models (and filters to vision models when required), profile select fires change, language toggle, disabled state; axe.
- **`ResultPanel.test.tsx`**: streaming vs done states, copy button (mock clipboard), download produces a file name from the tool, markdown renders through the shared Markdown component, `aria-live` region present; axe.
- **`ContextForm.test.tsx`**, **`ContextWizard.test.tsx`**: field rendering from pack definition, required validation, submit payload shape, wizard step navigation (incl. back), EQF options 1–8; axe.
- **`tests/tools/cognitive-architect.test.ts`**: follow the existing tool-test template (e.g. `tests/tools/math-grading.test.ts`): slug resolves; **four stages with correct `consumes` chains** (each stage's `StageDependency.fromStageId` references an earlier stage; placeholders match); every stage's prompt resolves with sample inputs + prior outputs; NL/EN parity; attribution present.

### 5.3 Client i18n fix (streamClient)

`app/lib/streamClient.ts:61,63` hardcodes `"Onbekende fout"`. Refactor: `streamPost` stops inventing human copy — it surfaces a machine code (e.g. `{ kind: "parse-error" }` or rethrows with a sentinel) and the **callers** (ChatView/GeneratorView/StageStepper, which have `useT()`) map it to `m.error.unknown`. Also sweep ChatView's raw-English fallback strings (`ChatView.tsx:205,214,254,275,335` — "Continue", "Your settings", etc.) into proper message keys; `tests/i18n.test.ts` enforces parity automatically once they're in `messages/{nl,en}.ts`.

### 5.4 Shared sandbox/profile hook

ChatView (`ChatView.tsx:87-98`) and GeneratorView (`GeneratorView.tsx:48-62`) duplicate profile-selection + prefill logic (StageStepper likely too — verify). Extract `app/lib/hooks/useSandbox.ts` (or `useProfileSelection`) with the union of current behavior; all three consume it. Pure refactor: existing component tests must pass unchanged (that's the acceptance test); add a focused unit test for the hook via `renderHook`.

### 5.5 Registry validation at boot

`validateTools()` runs only in tests. Call it once at server startup (e.g. in `app/lib/registry/index.ts` module scope or `entry.server.tsx`): throw in dev (fail fast), `console.error` + continue in production (a typo in one tool must not take the instance down — the invalid tool is filtered out; log which). Test: a deliberately broken tool fixture is filtered + reported.

### 5.6 Query caps

`listProfiles` (`profiles.server.ts:36`) is unbounded and `listGenerations` has no max. Cap: `limit = Math.min(limit ?? 50, 500)` on both (per-user scoping from Phase 1 already bounds realistic sizes; this is belt-and-braces). Test the clamp.

### 5.7 AGENTS.md truth pass

Fix the drift the audit documented — the contract must match reality:
- Tool count: 15 (roadmap table gains stage-assessment; "all 14 shipped" reworded).
- The five component-test gaps and cognitive-architect test are now closed — claims become true; keep them.
- "Zod at the boundary" — now true again (Phase 0); add one line naming `StreamBodySchema` as the boundary.
- Add the new conventions: roles & `canUseTool`, availability resolution (`availability.server.ts`), async-repository rule, `getDb()` seam, EQF/level-adaptation via `formatProfile`, `TEMPLATE.md` mandatory for new prompts, eval harness (`npm run eval`), invite/admin flows. Keep it terse — AGENTS.md is a contract, not a changelog. Update `wiki/Architecture.md` and `wiki/Home.md` links (Audit, Improvement-Plan, Deployment, Compliance).

### 5.8 Dependency upgrades (each its own PR, in this order)

1. `vitest` 3 → 4 (+ `happy-dom` current): dev-only blast radius; fix breaking config changes; full gate.
2. `ai` 6 → 7 (+ `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible` majors): touches only `app/lib/ai/adapters/aisdk.ts` if the abstraction held — verify streaming + `maxOutputTokens` + usage reporting still work; this may unlock token-usage logging (close the Phase 2 TODO).
3. `react-router` 7 → 8: **only when ecosystem-stable and with a green migration guide read first**; not a launch blocker. Typegen, route module APIs, and `createCookieSessionStorage` import paths are the risk surface. Time-box; abandon cleanly if it cascades.
4. Skip: `@anthropic-ai/sdk` direct dependency — check first whether anything imports it besides the AI SDK adapters (`grep -r "@anthropic-ai/sdk" app/`); if unused, **remove it** instead of upgrading.

## Test plan

This phase largely *is* tests; the RED→GREEN discipline applies to 5.3–5.6 (write the failing test for the new behavior first: error-code mapping, hook contract, boot validation filter, query clamp). For 5.1–5.2 the tests are the deliverable — each must fail if the behavior it pins is broken (mutate to verify at least once for StageStepper chaining and stream error paths).

## Acceptance criteria

- [ ] `tests/api/stream.test.ts` covers every refusal path listed in 5.1 (count them in the test file) and the three mode happy-paths.
- [ ] All five components + cognitive-architect have meaningful tests with zero axe violations; the "every interactive component ships an axe test" claim is grep-verifiably true (each `app/components/*.tsx` with interactivity has a counterpart test).
- [ ] No hardcoded human-language error strings in `app/lib/streamClient.ts` or `ChatView.tsx` (grep `"Onbekende`, `"Continue"`, `"Your settings"`).
- [ ] One shared hook powers profile/sandbox logic in ChatView, GeneratorView, StageStepper; their tests pass unchanged.
- [ ] A broken tool entry cannot crash prod boot but is loudly reported and excluded; dev boot fails fast.
- [ ] AGENTS.md contains no claim the codebase contradicts (re-run the audit's claims table mentally — all ✅).
- [ ] vitest 4 and ai SDK 7 upgrades merged with green gates; RR8 either merged green or explicitly deferred with a note in `wiki/Roadmap.md`.
- [ ] All gates green.

## Out of scope

E2E browser tests (Playwright etc. — a future decision), performance/bundle work, visual regression testing, new features of any kind.
