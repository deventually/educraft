# Claude Code Setup — LimeOnIt

**See the canonical contract:** @AGENTS.md

This file auto-loads in Claude Code and imports the single source of truth for the quality bar, conventions, and workflows. The `/tdd` skill encodes the testing loop; use it when adding tools or implementing test-first.

## Always use TDD (non-negotiable)

For **every** new feature, behaviour change, bug fix, or UI tweak — including small ones — follow Red → Green → Refactor:

1. **RED** — Write a failing test under `tests/` that pins the new/changed behaviour *before* touching implementation code. Run it and confirm it fails for the right reason.
2. **GREEN** — Write the minimum implementation to make the test pass.
3. **REFACTOR** — Clean up with the test as a safety net.

This applies to UI work too: interactive components and pages get a `tests/components/**/*.test.tsx` test (including a `vitest-axe` zero-violations assertion) written first. Changing copy, layout, routes, or i18n counts as a behaviour change — add or update a test for it.

**Gate before done:** `npm test` && `npm run typecheck` && `npm run check` all green. No exceptions. Invoke the `/tdd` skill for ready-to-copy templates. See `AGENTS.md` for the full per-tool recipe and enforcement details.
