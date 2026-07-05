# Mentor Insight — session summaries, engagement & the sweep

How a provisioning teacher/mentor sees **whether their students are engaging,
progressing, and which tutors are effective** — without ever seeing the raw
conversation. This is Phase 7 (implements decision **D5** of
[ADR 0001](../docs/adr/0001-student-provisioning-cohorts-mentor-insight.md)), and
it sits on top of the cohorts + provisioning model in
[Authentication](Authentication.md).

> **The one hard rule:** the mentor never reads a student's chat history. They see
> only *derived, de-personalised learning signal* — framed like the graders'
> "advice to the teacher, who decides," never an automated verdict.

---

## Why this exists

A teacher who provisions tutors to a cohort needs to know if it's working — are
students showing up, are they progressing, are the tutors landing — so they can
adjust what they hand out. But a tutoring conversation is the student's private
space. Phase 7 threads that needle: the mentor gets **metrics + a summary of the
work**, not a window into the person.

Be honest about the limits: **usage ≠ learning.** Engagement is solid and derived;
effectiveness is inferential and is always presented as *signal for the mentor's
judgement*.

---

## The privacy model (three access levels)

Privacy is **by construction, not by policy toggle.** The three levels of access
to a session:

| Who | Sees | How |
|-----|------|-----|
| **Student** | Their own raw history (continuity) | `messages` rows, via the student/summariser path only |
| **Mentor** | Derived signal only — engagement counts + de-personalised summaries + the student's self-report | `insight.server` + the insight route, which have **no query that returns message content** |
| **Admin** | Raw content only via a separate, logged, exceptional safety path | *not built here — deferred* |

The guarantee is enforced structurally, not by convention:

- `app/server/repositories/insight.server.ts` (the mentor-facing repo) **never
  reads the `content` column.** Engagement counts turns/last-active straight off
  the `messages` table selecting only `sessionId` + `createdAt`. A test
  (`tests/api/insight-repo.test.ts`) greps the source to assert no `.content`
  reference exists, and that the insight route imports no raw-message reader.
- Reading raw messages (`getSessionMessages` in `chat.server.ts`) is the
  **student / summariser** path. The summariser is a server-side writer, not a
  mentor read — same category as the close endpoint.

---

## Data model

Three tables (`app/server/schema.server.ts`), migration `drizzle/0003_*.sql`:

- **`chat_sessions`** — one row per conversation, keyed by the client session id.
  Denormalised `userId` + `cohortId` (added in P6) let cohort rollups scope
  without joining. Populated per turn by `recordChatTurn`.
- **`messages`** — the student's raw transcript, one row per message. Written per
  turn (idempotent rewrite). Read by the student and the summariser; **never** by
  the mentor layer.
- **`session_summaries`** — the mentor-facing derived signal, one row per session:

  ```ts
  summaryJson  // { topicsWorkedOn[], skillsProgressed[], misconceptions[] (about the material), effort }
  helpfulness  // optional student self-rating at close: -1 / 0 / +1
  ```

Repositories:

- `app/server/repositories/chat.server.ts` — `recordChatTurn` (write),
  `getChatSession`, `getSessionMessages` (student/summariser path).
- `app/server/repositories/insight.server.ts` — `saveSummary` / `getSummary`,
  `listSummariesForCohort`, `cohortEngagement`, `studentEngagement`,
  `listAbandonedSessions`. **Every read is cohort-ownership-checked** — a teacher
  only ever sees cohorts they created; a non-owner gets `null` / `[]`.

Chat turns are dual-written: the existing `generations` row (for the Projects
page) **and** the normalised `chat_sessions`/`messages` (for analytics +
summaries). See `onComplete` in `app/routes/api.stream.tsx`.

---

## The summariser (de-personalised)

A registered prompt `session-summary@v1`
(`app/lib/prompts/files/session-summary.{nl,en}.md`) turns one transcript into
strict JSON matching `summaryJson`. Its *Voice & Bounds* forbid verbatim quotes
and personal/emotional disclosure (anxiety, home circumstances, health) and frame
misconceptions **about the material, not the person**.

The de-personalisation guarantee is enforced at the boundary in
`app/lib/insight/summary.ts` — the model is only *asked* to comply; this code
*decides* whether the output may reach a mentor:

1. **Shape** — `parseSessionSummary` (strict Zod). Malformed JSON or a missing key
   → rejected. Lenient within the shape (trims, caps lists, coerces an unknown
   `effort` to `"unclear"`).
2. **Leakage** — `checkLeakage` rejects any field that shares a ≥6-word verbatim
   run with the transcript (or a quoted span), or that matches a bilingual
   sensitive-term denylist. `validateSummaryOutput` combines both.

`summariseSession` (`app/lib/insight/summarise.ts`) builds the prompt with the
transcript embedded as delimited material, calls the model (injected, so it's
unit-testable without the network), validates, and **retries once then returns
`null`** — never a partial leak. Fail-safe: a false positive costs a skipped
summary, never a leak.

- **Model:** defaults to `DEFAULT_MODEL` (`claude-sonnet-4-6`), `temperature 0.2`,
  `maxTokens 700`. The close endpoint uses the default; the **sweep** can run any
  configured model via `--model` (Anthropic, local, or a `compat::` endpoint —
  see below).
- **Contract test:** `tests/lib/summary-parse.test.ts` pins parse + clamp +
  leakage. **Owner-run eval:** `evals/session-summary/` + `npm run eval:summary`
  checks de-personalisation on *real* model output (needs `ANTHROPIC_API_KEY`).

---

## Student self-report (helpfulness)

At session close the student can answer "was this helpful?" (−1 / 0 / +1) — the
one effectiveness signal the student *chooses* to share, and the most honest one.
The control is `app/components/SessionHelpfulness.tsx` (accessible, axe-tested),
wired into `ChatView`'s end-session flow. It carries the plain-language consent
line: *your teacher sees your progress and this rating — not your conversation.*

---

## Two triggers: explicit close + the sweep

A summary is produced post-session. There are two ways a session ends:

### 1. Explicit close (primary)

`app/routes/api.session-close.tsx` — the student clicks "End session". Ownership-
scoped (a caller may only close their own session); only a cohort-linked session
produces a mentor-visible summary. It records the optional helpfulness and runs
the summariser (gated on `≥ 4` messages). **Idempotent:** a second close (e.g.
after the student adds a rating) reuses the existing summary rather than paying
for another model call.

### 2. The periodic sweep (fallback)

Students often just navigate away and never click "End session". The sweep closes
that gap — `app/server/insight/sweep.server.ts` (`sweepAbandonedSessions`), driven
by `scripts/sweep-summaries.ts` / `npm run sweep`, cron-scheduled.

**Eligibility** — `listAbandonedSessions` selects sessions that are:

- **cohort-linked** (there's a mentor to inform),
- **idle** — no message newer than `now − idleMs` (default **2h**, so a live
  session is never touched),
- **long enough** — `≥ minMessages` (default 4), and
- **not already summarised** (explicit closes and prior sweeps are skipped).

**Cost is bounded three ways:** the min-length filter, a per-run `limit`
(default 50), and — critically — every processed session gets a summary row
written *even on summariser failure* (an empty summary), so a poison session is
never re-swept forever. Abandoned sessions get `helpfulness: null` (no self-report).

```bash
npm run sweep                                   # default model (Sonnet)
npm run sweep -- --model claude-haiku-4-5        # cheaper Anthropic model
npm run sweep -- --model "ollama::llama3.1:8b"   # local, no key, no data leaves the box
npm run sweep -- --model "compat::glm-4-plus"    # any configured OpenAI-compatible endpoint
npm run sweep -- --idle-minutes 120 --limit 50 --lang nl
```

**Model & keys.** `--model` accepts any model the app can resolve — an Anthropic
catalog id, a local `ollama::…` / `lmstudio::…` id, a CLI agent, or a configured
`compat::<model>` endpoint (ChatGPT, Gemini, Mistral, GLM, DeepSeek, OpenRouter,
vLLM, …). Credentials come from **`.env`** via `env.server` (`vite-node` loads
`.env`) — a preflight resolves the model's provider and checks the *right* key
(`credentialKeyFor`), or none for local/CLI, and fails fast with a clear message.
A local model needs no key and keeps transcripts on-box — the natural choice for
the minors/AVG posture. See [Architecture § Providers](Architecture.md#providers-model-agnostic).

Runs via `vite-node` (the summariser prompt uses Vite `?raw` imports). Candidate
selection reads **metadata only** (keeping `insight.server` content-free); the
sweep service then reads the transcript through the summariser path to build the
summary.

---

## The mentor views

`app/routes/cohorts.$id.insight.tsx` — route `cohorts/:id/insight`, guarded by
`requireRole("teacher", "admin")` and cohort ownership (a non-owner gets a 404,
indistinguishable from a missing cohort). Reached from the cohort detail page's
"Insight & progress" link. Two panels, **no transcript anywhere**:

- **Per student** — engagement (sessions / turns / last-active) + the
  de-personalised summaries + self-reported helpfulness. Inactive members are
  listed with zeros.
- **Per tutor (effectiveness rollup)** — across the cohort: engagement + average
  helpfulness + aggregated top topics / recurring misconceptions, so a teacher can
  see which provisioned tutors land and iterate. UI copy makes the "signal, not a
  verdict" framing explicit.

---

## Retention & erasure

The student's chat history + summaries follow the account. `deleteUserCascade`
(`app/server/repositories/users.server.ts`) — the "delete my account and data"
path — removes the user's `chat_sessions`, their `messages`, and their
`session_summaries` alongside the existing feedback/usage/generations/profiles, in
one transaction. See [Compliance](Compliance.md).

The sweep is the one scheduled server-side job that writes derived data; it never
deletes and only ever *adds* de-personalised summaries for cohort sessions.

---

## Key files

| Concern | File(s) |
|---------|---------|
| Schema + migration | `app/server/schema.server.ts` · `drizzle/0003_*.sql` |
| Chat persistence | `app/server/repositories/chat.server.ts` |
| Mentor reads (ownership-checked, content-free) | `app/server/repositories/insight.server.ts` |
| De-personalisation contract | `app/lib/insight/summary.ts` |
| Summariser orchestration | `app/lib/insight/summarise.ts` · prompt `session-summary@v1` |
| Close trigger | `app/routes/api.session-close.tsx` |
| Sweep (fallback) | `app/server/insight/sweep.server.ts` · `scripts/sweep-summaries.ts` |
| Self-report control | `app/components/SessionHelpfulness.tsx` |
| Mentor views | `app/routes/cohorts.$id.insight.tsx` |
| Tests | `tests/api/insight-repo.test.ts` · `tests/api/insight-sweep.test.ts` · `tests/lib/summary-parse.test.ts` · `tests/components/insight.test.tsx` · `tests/components/session-helpfulness.test.tsx` |
| Owner-run eval | `evals/session-summary/` · `npm run eval:summary` |

## See also

- [ADR 0001 — student provisioning, mentor insight, anti-sharing](../docs/adr/0001-student-provisioning-cohorts-mentor-insight.md) (decision D5)
- [Authentication](Authentication.md) — cohorts, roles, per-user scoping
- [Compliance](Compliance.md) — AI Act / AVG posture, erasure, retention
- [Context Model](Context-Model.md) — how a cohort's level reaches a student's tutor
