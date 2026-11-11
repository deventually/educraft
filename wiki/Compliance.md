# Compliance (EU AI Act / AVG)

A developer-facing memo on where LimeOnIt sits under EU rules and what is already
built versus deferred. **Factual orientation, not legal advice** — a real
deployment for a school/institution needs its own DPIA and, if graded outcomes
are used in high-stakes decisions, a conformity assessment. Consult counsel.

---

## Why this matters here

Three tools **evaluate learning outcomes**:

- **stage-assessment** (internship/thesis grading + feedback)
- **math-grading** (handwritten math)
- **forum-autograder** (discussion participation)

Under the EU AI Act, "AI systems intended to be used to evaluate learning
outcomes" and "to assess the appropriate level of education an individual will
receive" fall in **Annex III (high-risk)**. The high-risk obligations apply from
**August 2026**. Separately, EQF 1–4 usage means **minors** may be involved, so
the **AVG/GDPR** applies to any student data processed.

These three tools carry `assistiveGrading: true` in the registry
(`app/lib/registry/types.ts`), which is the single source of truth driving the
stronger "teacher decides" transparency notice — no per-tool UI branching.

## What the product already does

- **Human-in-the-loop by design.** Every grading tool frames its output as a
  *draft/advice for the teacher, who decides* — surfaced via the `AiNotice`
  (`assistive` variant) on the output surface. The teacher is never removed from
  the decision. (Prompt-level "draft/advice" wording is tightened in P3.)
- **AI transparency.** A persistent AI-generated-draft notice sits under every
  output surface (generator results, staged results, chat) so a user always
  knows the text is machine-generated. One shared component: `app/components/AiNotice.tsx`.
- **Data minimisation in logs.** The structured logger (`app/server/log.server.ts`)
  emits **metadata only** — user id, tool, model, duration, outcome, output
  length — and **never** prompt or response content (student work). See the
  per-generation log line in `app/routes/api.stream.tsx`. An unexpected error is logged with
  its request id, method, path (without query string) and a capped message and stack, never
  a request body (`app/server/errorLog.server.ts`).
- **Right to erasure.** "Delete my account and data" (`/account`) runs
  `deleteUserCascade` (`app/server/repositories/users.server.ts`) — a single
  transaction removing the user's feedback, pilot check-ins, usage counters (`usage` and
  `ai_usage`), generations, context
  profiles, and their chat history, then the user row — and
  ends the session. Scoped by user id, so no other account is touched.
- **Access control & scoping.** Invite-only accounts, two roles
  (teacher/admin), and per-user scoping on every repository query (a user
  only ever sees their own data). See `wiki/Authentication.md`.
- **Abuse & cost bounds.** Per-user rate limits, a quiet per-user daily brake on output tokens
  (`app/server/repositories/usage.server.ts`) and the monthly limits in euros
  (`app/server/aiLimits.server.ts`) cap runaway use.
- **AI-use measurement.** `ai_usage` keeps token counters per user, day, tool and model for the
  usage page (`/usage`): no prompt, no answer, no time of day. A team lead sees team totals
  only, and only the total when fewer than three members were active; per person stays with
  the admin and the teacher (BESLUIT-2026-11-11-1). The help topic *Wat we meten* explains it.

## Retention

Generations and context profiles **persist until the user deletes them**. There
is **no silent server-side retention/expiry job** — deletion is user-initiated
(per-item on the Projects page, or the full account cascade at `/account`). If a
future deployment requires automatic retention limits, add a scheduled job; it is
intentionally not built now to keep behaviour predictable and user-controlled.

The one exception is the AI-use measurement (BESLUIT-2026-11-11-6): `ai_usage` keeps rows
per person for **thirteen months** (this month and the twelve before, the months the usage
page offers). Every hour the server rolls older rows up into `ai_usage_rollup`, month totals
per tool and model for the whole institution and per team, **without a person**, and deletes
the person rows (`aiUsageRetention.server.ts`). Deleting an account still removes its rows at
once; the totals that were already rolled up know no person.

## What procurement will typically ask

- **DPIA support** — a data-protection impact assessment for the specific
  deployment (data categories, purposes, lawful basis, retention).
- **Data residency** — where the DB and model inference run. The app is on-prem
  capable (SQLite + local/EU-hosted models); Anthropic/OpenAI calls leave the EU
  unless a local model is used (local models run only in development mode, not in a
  production process). EU hosting: Fly.io `ams` or Hetzner both fit.
- **Retention & deletion** — documented above; deletion is implemented.
- **Sub-processors** — the model provider(s) in use (Anthropic, OpenAI, or a
  local Ollama/LM Studio endpoint with no third party).

## Deferred to first sale / real deployment

- **Conformity assessment** for the high-risk grading tools (AI Act Annex III).
- **A formal DPIA** for the deploying institution.
- **Logging/audit retention policy** aligned to the customer's requirements.

These are institution- and contract-specific and are out of scope for the
current test-drive phase; the technical hooks (human-in-the-loop, transparency,
metadata-only logging, deletion) are in place so they are cheap to satisfy later.
