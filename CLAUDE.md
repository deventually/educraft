# Claude Code Setup — LimeOnIt

**The contract:** @AGENTS.md

Always TDD (Red → Green → Refactor), also for small UI, copy and i18n changes; use the `/tdd` skill
for templates. Gate before done: `npm test && npm run typecheck && npm run check`.
While the `e2e` job is off on GitHub, also run `npm run test:e2e` yourself where AGENTS.md says so.
