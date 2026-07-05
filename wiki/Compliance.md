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
  per-generation log line in `app/routes/api.stream.tsx`.
- **Right to erasure.** "Delete my account and data" (`/account`) runs
  `deleteUserCascade` (`app/server/repositories/users.server.ts`) — a single
  transaction removing the user's feedback, usage counters, generations, context
  profiles, cohort memberships, and their chat history + de-personalised session
  summaries, then the user row — and ends the session. Scoped by user id, so no
  other account is touched.
- **Privacy-safe mentor insight.** A provisioning teacher sees engagement metrics
  and *de-personalised* session summaries for their cohort, but **never** the raw
  chat transcript — enforced structurally (the mentor-facing repo has no query
  that returns message content) and by a summariser that strips verbatim quotes
  and personal disclosure. See [Mentor Insight](Mentor-Insight.md).
- **Access control & scoping.** Invite-only accounts, three roles
  (student/teacher/admin), and per-user scoping on every repository query (a user
  only ever sees their own data). See `wiki/Authentication.md`.
- **Abuse & cost bounds.** Per-user rate limits and a per-user daily quota
  (`app/server/repositories/usage.server.ts`) cap runaway use.

## Retention

Generations and context profiles **persist until the user deletes them**. There
is **no silent server-side retention/expiry job** — deletion is user-initiated
(per-item on the Projects page, or the full account cascade at `/account`). If a
future deployment requires automatic retention limits, add a scheduled job; it is
intentionally not built now to keep behaviour predictable and user-controlled.

The one scheduled server-side job is the abandoned-session **sweep** (`npm run
sweep`, see [Mentor Insight](Mentor-Insight.md)) — it only *adds* de-personalised
summaries for cohort sessions and never deletes or expires student data.

## What procurement will typically ask

- **DPIA support** — a data-protection impact assessment for the specific
  deployment (data categories, purposes, lawful basis, retention).
- **Data residency** — where the DB and model inference run. The app is on-prem
  capable (SQLite + local/EU-hosted models); Anthropic/OpenAI calls leave the EU
  unless a local model is used. EU hosting: Fly.io `ams` or Hetzner both fit.
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
