# LimeOnIt Improvement Plan — Roadmap & Decisions

Companion to [`Audit-2026-07.md`](Audit-2026-07.md). Executable, per-phase specifications live in [`implementation/`](implementation/README.md) (the P-series session briefs) — this page records **what** we're building and **why**, so decisions don't get re-litigated mid-implementation.

## Product trajectory

1. **Now → invite-only test-drive**: a select group of testers on one hosted instance.
2. **Then → on-prem installs per institution** (each institution runs its own instance; institutional SSO such as SURFconext/SAML/OIDC replaces the invite front door).
3. **Optionally → hosted multi-tenant SaaS** for small institutions, run on LimeOnIt's server.

## Owner decisions (with rationale)

### Auth: invite links now, SSO-shaped for later
Invite links (token in URL → account creation with password → session cookie). Deliberately lightweight, **but it creates real `users` rows and sessions**, so all authorization work (per-user data scoping, roles) is permanent. Institutional SSO later replaces only the login route and role mapping — nothing else.

### Roles, not multi-tenancy, inside an instance
Students, teachers, and admins get different views: some tools are student-facing, others teacher-facing (the registry already carries `userType`), and only admins configure which LLMs and tools are available. This is RBAC within an instance. One instance per institution means **the instance is the tenant** — no org_id threading, no cross-tenant query discipline to police.

### Hosted SaaS strategy: database-per-tenant
The hosted multi-tenant product is built as "many on-prem-shaped instances": one SQLite database per tenant behind a subdomain → tenant-DB routing layer. Consequences:
- One codebase serves on-prem and hosted; no fork of the data model.
- Hard data isolation by construction (relevant with minors' data; also a procurement answer).
- Hosted ↔ on-prem migration = handing the institution its database file. This is a sales feature.
- The only seams needed **now**: no module-level DB singleton (a single `getDb()` indirection), and settings stored *inside* the tenant DB. Both are in the Phase 1/4 specs. The routing layer itself is out of scope until the SaaS is concrete.

### Database: SQLite now, portability engineered in
SQLite (better-sqlite3) stays: lowest ops for the test-drive, and a self-contained Docker container is the ideal on-prem shape (institutional IT does not have to run a DB server). Portability to Postgres/MySQL/MSSQL for institutions that demand it is preserved by engineering, not by hope:
- **All repository functions become `async`** — better-sqlite3's sync API is the real lock-in (every other dialect's driver is async); Drizzle's query API ports nearly verbatim, but sync signatures would ripple through every loader.
- All DB access stays behind `app/server/repositories/`; no SQLite-isms in app code.
- Real `drizzle-kit` migrations replace boot-time `CREATE TABLE IF NOT EXISTS`.
- The dialect port later = a `pg-core` schema variant + per-dialect migrations behind the same repository interface (~3 small tables; days, not weeks).

### EQF 1–8: level lives in the context model, engine stays neutral
The app must serve all education levels. The context profile already has an `eqf` field (currently `5|6|7`, hbo-only) — it widens to 1–8 with Dutch sector labels (vo/vmbo/mbo/hbo/wo) alongside. `formatProfile` injects the level **plus a tone-adaptation directive** into `{{context}}`, and the shared prompt template requires every tool to adapt register, sentence complexity, and examples to that level. Evals score outputs at contrasting levels (e.g. EQF 2 vs EQF 6).

### Growing tool catalog: code defines existence, admins define availability
New tools keep shipping as code (registry + prompts, per the AGENTS.md recipe). What's *available* on an instance becomes DB-backed configuration: per-tool enabled flag + audience override, and an enabled-models list. The Phase 0 hardcoded model allow-list is the safe default that Phase 4's admin console makes configurable.

### Compliance shape now, formal compliance at first sale
Three tools evaluate learning outcomes → likely EU AI Act Annex III high-risk (obligations from Aug 2026); EQF 1–4 means minors (AVG). Built now because retrofitting is expensive: AI-transparency notices, explicit teacher-in-the-loop framing for grading tools ("draft — review before use", editable output), per-user data deletion, generation logging (already present), and a compliance memo for procurement conversations. DPIA / conformity assessment happens at the first institutional sale, not now.

### Evals: LLM-judge harness
`npm run eval [tool]` generates real outputs and scores them against per-tool rubrics with an LLM judge (~€1–3/run, on demand, never part of `npm test`). Baseline **before** touching prompts, re-run after. Tester feedback (thumbs + comment per generation) feeds the same loop.

## Phases

Execute in order; each phase ends with all gates green (`npm test && npm run typecheck && npm run check`) and a commit. Details in `implementation/` (P-series).

| Phase | Spec | Delivers | Closes audit findings |
|-------|------|----------|----------------------|
| 0 | [P0-security-hardening](implementation/P0-security-hardening.md) | Zod-validated stream body with length caps, model allow-list, rate limiting, per-tool maxTokens, drizzle patch, security headers, CI, api.stream error i18n | #1 (partially — auth completes it), #3, #5, #10, #11, #13 (server half) |
| 1 | [P1-auth-roles-scoping](implementation/P1-auth-roles-scoping.md) | Invite links, users/sessions/roles, `requireUser`/`requireRole`, role-gated tool visibility, per-user data scoping, real migrations, async repos + `getDb()` seam | #1, #2, #12, #14 |
| 2 | [P2-ops-feedback-compliance](implementation/P2-ops-feedback-compliance.md) | Structured logging, per-user daily quotas, tester feedback capture, transparency notices, delete-my-data, healthz, deploy checklist → **test-drive invites go out** | #8, #9 |
| 3 | [P3-prompts-eqf-evals](implementation/P3-prompts-eqf-evals.md) | Prompt template, EQF 1–8 context, eval harness with baseline/after reports, weak-tool refactors, Voice & Bounds everywhere, multi-turn stability, per-tool tokens/temperature | #4, #6 |
| 4 | [P4-admin-console](implementation/P4-admin-console.md) | Instance settings (tools/models availability), admin routes: tools, models, invites, usage, feedback | remainder of catalog-growth & config needs |
| 5 | [P5-test-tech-debt](implementation/P5-test-tech-debt.md) | api.stream integration tests, missing component/tool tests, i18n client fixes, shared sandbox hook, boot-time registry validation, AGENTS.md truth fixes, dependency upgrades | #7, #13 (client half), #15, AGENTS.md drift |

## Out of scope (deliberately)

- **Multi-tenant hosting implementation** (subdomain→tenant-DB routing, tenant provisioning, per-tenant billing) — seams are prepared in Phases 1/4; build when the hosted SaaS is concrete.
- **Institutional SSO** (SURFconext/SAML/OIDC) — plugs into the Phase 1 session layer + role mapping.
- **Postgres/MySQL port** — kept open via the async repository seam; build when an institution demands it.
- **Billing/licensing**, **full AI-Act conformity / DPIA** (memo + product shape now; formal work at first sale), **languages beyond NL/EN**.
