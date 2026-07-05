---
name: tdd
description: >-
  TDD loop for LimeOnIt — red → green → refactor, done well. Use when adding a
  tool (generator or chat tutor), fixing a bug test-first, building or changing a
  UI component, or making any behaviour/copy/route/i18n change: write the failing
  test first. Bundles the test-quality bar (behaviour over implementation, seams,
  anti-patterns, mocking) with copy-ready, repo-accurate templates. Triggers:
  "red-green-refactor", "test-first", "add a tool", "new tool", "TDD", "write a
  test for".
---

# TDD — LimeOnIt Red → Green → Refactor, done well

Two things have to be true at once: you follow the loop, **and** the tests the loop
leaves behind are worth keeping. This skill covers both. The loop is the easy half;
the quality bar is where most TDD quietly fails.

- **The loop** — the cadence below.
- **The quality bar** — `quality.md`: what a good test is, where tests go (seams),
  the anti-patterns that pass CI but rot, and when to mock. Read it *before* writing
  assertions, not after.
- **The recipes** — `recipes.md`: copy-ready, compile-accurate templates for a
  generator tool, a chat tool, a bug fix, and a UI component — plus what the global
  test suites already cover so you only write the delta.

## When to use

- Adding a **tool** — generator (one-shot / multi-stage) or chat tutor.
- **Bug fix** — reproduce with a failing test, then fix.
- **UI component** — new or changed interactive component or page (ships a `vitest-axe`
  zero-violations test).
- Any **behaviour change** — copy, layout, routes, i18n all count.

## The loop

The cadence is **Red → Green → Refactor** — the project contract in `AGENTS.md`. Run
`npm run test:watch` while you work.

1. **RED — one failing test, at a named seam.** Before you type an assertion, name the
   seam you're testing at (see `quality.md`): the public boundary where you can observe
   behaviour — `getToolBySlug`, `buildSystemPrompt`, a rendered component's
   roles/labels — never a tool's internal fields or a component's state. State it in the
   `describe` name or a one-line comment. Then write **one** test and watch it fail *for
   the right reason* (assertion fires — not a typo, missing import, or unregistered tool).
2. **GREEN — minimum to pass.** Just enough code to go green. No speculative fields, no
   "while I'm here." If the implementation feels impossible to test, the design is
   unclear — fix the shape, not the test.
3. **REFACTOR — clean up on a green net.** This is where tools-as-data and deep-module
   cleanups land (extract a shared input group, collapse a `mode === "chat"` branch into
   the component). Keep the test green throughout.

Work in **vertical slices**: one seam → one test → one implementation → repeat. Never
write all the tests first and all the code after (that's the horizontal-slicing
anti-pattern in `quality.md` — it locks you into imagined behaviour). Each test is a
tracer bullet that responds to what the last one taught you.

> **Refactor vs. review.** Keep *refactoring* in the loop. But judging whether these are
> the *right* assertions at the *right* seam is a separate **quality review** pass — use
> `quality.md` and the `code-review` skill — don't interleave it with getting to green.

## The gate — before done

All three green. No exceptions (`AGENTS.md`).

```bash
npm test          # vitest run — node (*.test.ts) + happy-dom (*.test.tsx)
npm run typecheck # react-router typegen && tsc
npm run check     # biome (lint + format)
```

## Before-merge checklist

- [ ] The new test names its seam and failed first for the right reason (RED → GREEN).
- [ ] Assertions read as behaviour ("resolves by slug", "no unresolved `{{…}}`"), not
      structure — cross-check against the anti-patterns in `quality.md`.
- [ ] Interactive UI ships a `vitest-axe` test: `expect((await axe(container)).violations).toEqual([])`.
- [ ] Refactored toward data-not-control-flow / deeper modules.
- [ ] `npm test` && `npm run typecheck` && `npm run check` all green.
- [ ] No leftover `console.log` / debug code. Commit message says *what*, not *how*.

## Pointers

- **`quality.md`** — the quality bar. Read first.
- **`recipes.md`** — repo-accurate templates + "covered for free" by the global suites.
- **`AGENTS.md`** — the canonical contract (TDD, security, a11y, deep modules, i18n).
