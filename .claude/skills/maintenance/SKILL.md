---
name: maintenance
description: >-
  The maintenance round for LimeOnIt: work through the open Dependabot PRs (minor and patch
  together, each major on its own), npm audit, the toolchain pins and the nightly mutation
  run, and report to Bastiaan what is ready to merge. Triggers: "maintenance",
  "onderhoud", "dependabot", "updates", "npm audit", "dependencies bijwerken".
---

# Maintenance — keep the dependencies current, one safe step at a time

Dependabot opens update PRs every Monday (`.github/dependabot.yml`): minor and patch updates
grouped per ecosystem, each major version jump on its own. This skill turns that pile into a
short list Bastiaan can merge. **Only Bastiaan merges**, and he merges in number order.

Read `docs/fabriek/voorkeuren.md` first; it wins over this file. Talk to Bastiaan in Dutch.
A new dependency (not an update of an existing one) is his decision, as is anything that costs
money.

## 1. Look around

- Open PRs by `dependabot[bot]` (GitHub MCP, `list_pull_requests`), with their CI state.
- Open PRs by other workers: does one already touch the same package? Then leave it.
- `npm audit --omit=dev --audit-level=moderate` and `npm audit --audit-level=high`.
- The latest nightly **Mutation testing** run on `main`: green, and its score.

## 2. Per Dependabot PR

**Green CI** — read the package's changelog between the two versions (the PR links it). No
behaviour change for us? Then it is ready: put it on the list for Bastiaan. Do not push to a
green Dependabot PR.

**Red CI, or a major version** — one at a time, on your own branch from `main`:

1. Reproduce the failure locally first: `npm ci`, then the failing step.
2. Read the migration guide of the new version. Fix what it asks, nothing more.
3. Run the gate: `npm test && npm run typecheck && npm run check`. For a change to the build,
   the server or the browser (React Router, Vite, Playwright) also `npm run test:e2e`.
4. Open your PR with the update and the fix, and say in it which Dependabot PR it replaces;
   Bastiaan closes that one. "In gewone taal" says what changes for a teacher — usually
   "niets".

Never skip, disable or loosen a test to get green, and never use `npm audit fix --force` or
`--legacy-peer-deps`. If a fix needs more than the update (a redesign, a new dependency),
stop and report it instead.

## 3. Keep the pins together

The Node version lives in four places that must agree: `package.json` (`volta.node`), the
`Dockerfile` (`node:<major>-alpine`), every `node-version` in `.github/workflows/`, and
`@types/node` (same major). `tests/deploy/node-version.test.ts` guards this; a Node major is
its own PR.

## 4. When tests fail in a cluster

A group of tests that suddenly fails while each passes on its own is usually the machine, not
the code (`AGENTS.md`, rule 8). Check `uptime` and stray processes before changing code.

## 5. Report

End with a short report for Bastiaan, in Dutch:

- **Klaar om te mergen:** the PR numbers, in the order to merge them.
- **Door mij gerepareerd:** your PRs, and which Dependabot PR each replaces.
- **Wacht op jou:** anything that needs his decision (a new dependency, a major with a real
  behaviour change, an audit finding without a fix).
- **Mutatiescore:** the latest score, and whether it moved.

Do not touch `STATUS.md` (project rule).
