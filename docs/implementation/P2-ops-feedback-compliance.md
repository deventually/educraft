# Phase 2 — Deploy-Ready Ops, Feedback & Compliance Shape

## Context & goal

With the endpoint hardened (Phase 0) and users/roles in place (Phase 1), this phase makes the app observable and safe to run for real testers, captures structured tester feedback, gives the product its compliance shape (EU AI Act / AVG), and ends with the app deployed — **test-drive invites go out at the end of this phase**.

Why compliance shape now: three tools evaluate learning outcomes (stage-assessment, math-grading, forum-autograder) — an EU AI Act Annex III high-risk category with obligations applying from Aug 2026 — and EQF 1–4 usage means minors (AVG). Transparency, human-oversight framing, and deletion are cheap to build now and expensive to retrofit.

Audit findings closed: #8, #9.

## Constraints

- `AGENTS.md` contract: TDD, gates, bilingual strings, axe tests for new interactive UI.
- Everything must work on-prem: no hard dependency on external SaaS. Error reporting (Sentry) is optional-by-env only; do not add the dependency unless trivially tree-shaken when disabled — logging to stdout is the baseline (Docker/hosts collect stdout).
- Keep logging free of prompt/response *content* by default (student data). Log metadata, not payloads.

## Features

### 2.1 Structured logging

**New file:** `app/server/log.server.ts` — a tiny JSON-lines logger (no dependency): `log(event: string, fields: Record<string, unknown>)` → `console.log(JSON.stringify({ ts, event, ...fields }))`.

In `api.stream.tsx`, log one line per generation attempt at stream end (wire into the same completion path as `onComplete`) and one on refusal/error:
`{ event: "generation", userId, toolSlug, stageId, model, mode, outputLanguage, durationMs, outcome: "ok" | "error" | "rate_limited" | "quota_exceeded", chars: full.length }`. If the AI SDK exposes token usage on the stream result (check `app/lib/ai/adapters/aisdk.ts` — the `ai` package's `streamText` result has a `usage` promise), include `inputTokens`/`outputTokens`; otherwise log `chars` only and leave a TODO for the adapter to surface usage.

### 2.2 Per-user daily quota

**Schema:** new `usage` table (drizzle-kit migration):

```ts
export const usage = sqliteTable("usage", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  day: text("day").notNull(),                 // "2026-07-03" (UTC)
  requests: integer("requests").notNull().default(0),
  outputChars: integer("output_chars").notNull().default(0),
  outputTokens: integer("output_tokens"),     // nullable until adapter surfaces usage
}, (t) => [uniqueIndex("usage_user_day").on(t.userId, t.day)]);
```

**New file:** `app/server/repositories/usage.server.ts` (async, `getDb()`): `getTodayUsage(userId)`, `recordUsage(userId, { chars, tokens? })` (upsert), `checkQuota(userId): Promise<{ ok: boolean }>`.

- Env (`env.server.ts`): `DAILY_REQUEST_LIMIT` (default 50), `DAILY_OUTPUT_TOKEN_LIMIT` (default 200000, checked only when token data exists).
- `api.stream.tsx`: check quota after auth, before the provider call; over-quota → localized SSE error `error.quotaExceeded` ("Daglimiet bereikt — morgen weer beschikbaar." / "Daily limit reached — available again tomorrow."). Record usage in the completion path.
- Admins are exempt (role check).

### 2.3 Tester feedback capture

**Schema:** new `feedback` table: `id`, `generationId` (FK-style reference to `generations.id`), `userId`, `rating` integer (+1 / −1), `comment` text nullable, `createdAt`.

- **New resource route** `app/routes/api.feedback.tsx` (add to `routes.ts`): POST action, `requireUser`, Zod body `{ generationId: string, rating: 1 | -1, comment?: string(max 2000) }`, verifies the generation belongs to the user, upserts (one feedback row per user+generation — re-rating updates).
- **UI:** thumbs up/down + optional comment box, in `ResultPanel` (one-shot/stage results) and at the end of a completed chat turn in `ChatView`. Appears only when a generation id is known (one-shot saves return an id — check how `saveGeneration`/`upsertChatGeneration` ids flow to the client; if they don't, return the generation id in a final SSE metadata event or have the client send its `sessionId` as the id for chat). Keep the mechanism *simple*; if plumbing an id through SSE proves invasive, scope feedback to chat sessions (`sessionId` known client-side) + the projects list (each saved row can host feedback buttons) and note the tradeoff.
- Localized labels; accessible (buttons with `aria-pressed`, comment `label`); axe test.
- **Owner view:** minimal `/admin/feedback` page listing feedback with tool, user, rating, comment, date (`requireRole("admin")`). Phase 4 restyles it into the console; keep this one plain.

### 2.4 Compliance shape (AI Act / AVG)

1. **AI-transparency notice**: a small persistent notice under every output surface (ResultPanel, ChatView, StageStepper results): NL "AI-gegenereerd concept — controleer en beoordeel zelf voor gebruik." / EN "AI-generated draft — review and judge before use." One shared component (`app/components/AiNotice.tsx`), i18n keys, axe-tested.
2. **Teacher-in-the-loop framing for graders**: for the three assessment tools (stage-assessment, math-grading, forum-autograder), the tool page shows a stronger notice variant: NL "Dit is een beoordelings-**advies** voor de docent. De docent beslist." / EN "This is an assessment **suggestion** for the teacher. The teacher decides." Drive it from data: add `assistiveGrading?: boolean` to the `Tool` type (registry data, no per-tool branching) and set it on those three tools. (Prompt-level "draft/advice" wording is Phase 3.)
3. **Delete-my-data**: an account section (extend the AppShell user area or a small `/account` route): shows name/email/role, and a "Delete my account and data" action with type-to-confirm. Action: delete the user's feedback, usage, generations, profiles, then the user row; destroy session; redirect to `/login`. Implement as `deleteUserCascade(userId)` in a repository (single transaction).
4. **`wiki/Compliance.md`** (dev-facing memo, ~1 page): the Annex III high-risk status of learning-outcome evaluation tools, what the product already does (human-in-the-loop, transparency notices, logging, deletion, data minimization in logs), what procurement will ask (DPIA support, data residency, retention), and what is deferred to first sale (conformity assessment, DPIA). Factual, no legal advice claims.
5. **Retention default**: document (in Compliance.md + cookies/legal page if user-facing text exists there) that generations persist until the user deletes them; no silent server-side retention job is built now.

### 2.5 Health endpoint

**New resource route** `app/routes/healthz.tsx` (`route("healthz", ...)` in `routes.ts`, public): loader returns `Response.json({ ok: true })` after a trivial DB probe (`SELECT 1` via `getDb()`); 503 with `{ ok: false }` on failure. No auth (used by orchestrators), no secrets in output.

### 2.6 Deploy

- **Dockerfile**: align the base image with the Volta pin (`node:24-alpine`, currently node 20 per audit); ensure `drizzle/` migrations folder is copied into the image; `CMD` runs migrations then `npm start` (or boot-time migration from Phase 1 covers it — verify once).
- **Volume**: document that `DATABASE_URL=file:/data/limeonit.db` with a mounted volume at `/data` is the production shape.
- **Env checklist** (write into `wiki/Deployment.md`, new): `ANTHROPIC_API_KEY`, `SESSION_SECRET` (32+ chars, required in prod), `APP_ORIGIN`, `DATABASE_URL`, rate-limit/quota overrides, `NODE_ENV=production`. EU hosting note (data residency: Fly.io `ams` or Hetzner both fit; choice is the owner's).
- **CSP**: flip Phase 0's `Content-Security-Policy-Report-Only` to enforcing after a clean click-through on the deployed instance.
- **Smoke checklist** (in `wiki/Deployment.md`): healthz OK → login → generate with a cheap model → projects saved → feedback lands → quota trips when limit set to 1 → logs visible.

## Test plan (write these first — RED)

- `tests/api/usage-repo.test.ts`: upsert accumulates per user+day; `checkQuota` flips at the limit; day rollover resets; admin exemption (test via the route or a helper that takes role).
- `tests/api/quota-route.test.ts` (extend the stream-route harness): request over quota → SSE `error.quotaExceeded`, provider not called; under quota → provider called and usage recorded on completion.
- `tests/api/feedback.test.ts`: POST validates body; rejects another user's generationId; upserts on re-rating.
- `tests/api/delete-account.test.ts`: cascade removes feedback/usage/generations/profiles/user; other users' data untouched.
- `tests/components/AiNotice.test.tsx`: renders both variants (generic / assistive-grading), localized, axe clean. Extend `ResultPanel`-consuming tests when the notice lands there (ResultPanel's own test is Phase 5; don't block on it).
- `tests/api/healthz.test.ts`: 200 + `{ok:true}` with a working DB.
- `tests/lib/log.test.ts`: logger emits parseable JSON with `ts` and `event`.

## Acceptance criteria

- [ ] Every generation attempt produces exactly one structured log line with outcome and duration; no prompt/response content in logs.
- [ ] With `DAILY_REQUEST_LIMIT=2`, the 3rd generation of the day gets the localized quota error; an admin is exempt; the counter resets next day (unit-tested via injected day).
- [ ] A tester can rate any of their generations 👍/👎 with a comment; the admin sees it on `/admin/feedback`; re-rating updates rather than duplicates.
- [ ] Every output surface shows the AI notice; the three grading tools show the teacher-decides variant, driven by registry data.
- [ ] Delete-my-account removes all the user's rows and ends the session; verified by test and one manual pass.
- [ ] `/healthz` returns 200 without auth; all other app routes still require login.
- [ ] Deployed instance passes the full smoke checklist; CSP is enforcing with no violations.
- [ ] All gates green.

## Out of scope

Admin console proper (Phase 4 — only the plain feedback list lands here), token-usage surfacing in the adapter if it exceeds ~an hour of work (log chars, leave TODO), Sentry (optional, only if env-gated cleanly), retention cron jobs, billing/metering beyond the usage table.
