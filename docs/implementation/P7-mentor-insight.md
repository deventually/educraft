# Phase 7 — Mentor Insight: Privacy-Safe Progress & Effectiveness

Implements decision **D5** of [`docs/adr/0001-student-provisioning-cohorts-mentor-insight.md`](../adr/0001-student-provisioning-cohorts-mentor-insight.md). Depends on **P6** (cohorts, memberships, `chat_sessions.userId`/`cohortId`).

## Context & goal

A teacher who provisioned tutors (P6) needs to know: **are the students engaging, are they progressing, and are the provisioned tutors effective?** — so they can adjust what they hand out. The owner's hard constraint: **privacy-safe by construction — the mentor never sees the raw chat history.** The mentor gets only *derived, de-personalised learning feedback*, framed like the graders' "advice to the mentor, who decides," never an automated verdict.

Be honest about limits: **usage ≠ learning.** Engagement is solid and derived; effectiveness is inferential and must be presented as signal for the mentor's judgement.

## Constraints

- `AGENTS.md` contract (TDD, gates, bilingual, axe for every new component).
- **No raw-transcript path to a mentor may exist** — the insight layer has *no query* that returns `messages` for a teacher/admin. Raw content is reachable only by the student (own history) or an admin via a separate, logged safety path (not built here).
- The `session-summary` pass must **omit verbatim quotes and sensitive personal disclosure** (anxiety, personal circumstances); a leakage eval guards this.
- Summaries are advisory, cohort-scoped to the requesting owner. Reuse the provider layer; the summariser is a registered prompt, not an inline string.

## Features

### 7.1 Session-summary schema & repository

**File:** `app/server/schema.server.ts` — add:

```ts
export const sessionSummaries = sqliteTable("session_summaries", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),                     // FK chat_sessions
  userId: text("user_id").notNull(),                           // the student (denormalised)
  cohortId: text("cohort_id"),                                 // denormalised for rollups
  toolSlug: text("tool_slug").notNull(),
  summaryJson: text("summary_json").notNull(),                 // { topicsWorkedOn[], skillsProgressed[], misconceptions[] (about the material), effort } — no quotes, no personal disclosure
  helpfulness: integer("helpfulness"),                         // optional student self-rating at close (−1/0/+1 or 1–5)
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
```

**New file:** `app/server/repositories/insight.server.ts` (async, `getDb()`): `saveSummary`, `getSummary(sessionId)`, `listSummariesForCohort(ownerId, cohortId)` (**verifies the requester owns the cohort**), `cohortEngagement(ownerId, cohortId)` and `studentEngagement(ownerId, userId)` — derived from `chat_sessions`/`messages` (session count, turns, last-active, per tutor), never returning message content.

### 7.2 The summariser (de-personalised)

**New prompt** `session-summary` (registered like any tool prompt; NL/EN): input = a transcript, output = strict JSON matching `summaryJson`. The prompt's Voice & Bounds **forbids** verbatim quotes and any personal/emotional disclosure, and frames misconceptions **about the material, not the person**. Runs post-session (on explicit close; a sweep is a fallback — see open questions), gated on a minimum turn count to control cost. Parse/validate with Zod; on malformed output, retry once then skip (no partial leak).

### 7.3 Student end-of-session self-report

Optional, student-facing: at session close, a small "was this helpful?" control writing `helpfulness`. This is the one signal the **student chooses** to share — the most honest effectiveness input. Accessible + axe-tested.

### 7.4 Mentor insight views

**File:** `app/routes.ts` — add `route("cohorts/:id/insight", "routes/cohorts.$id.insight.tsx")` (`requireRole(request, "teacher", "admin")`, ownership-checked):
- **Per student:** engagement (sessions/turns/last-active per tutor) + the de-personalised summaries + self-reported helpfulness. **No transcript.**
- **Per tutor (effectiveness rollup):** across the cohort — engagement + avg helpfulness + aggregated misconception/topic signals — so the teacher can see which provisioned tutors land and iterate. Explicit "signal, not a verdict" framing in the UI copy.

### 7.5 Consent & transparency copy

Student-facing notice (extend the P2 AI-notice/compliance shape): what the mentor can and cannot see (metrics + de-personalised summaries; **not** the conversation), in plain bilingual language. Aligns with the AI Act / minors posture.

## Test plan (write these first — RED)

- `tests/api/insight-repo.test.ts`: `saveSummary`/`getSummary` roundtrip; `listSummariesForCohort` returns only the requesting owner's cohort and **never** message content; a non-owner gets nothing; engagement counts are correct.
- `tests/lib/summary-parse.test.ts`: Zod validator rejects malformed JSON, clamps `helpfulness`, and a **leakage assertion** — given a transcript containing a personal disclosure + a verbatim-quotable phrase, a fixture "model output" that includes either is rejected by the post-processor. (Guards the *contract*; the live-model check is an eval, 7.x below.)
- `tests/components/insight.test.tsx`: renders engagement + summaries, asserts no transcript/message text is rendered, axe zero violations.
- `tests/components/session-helpfulness.test.tsx`: renders, records a rating, axe clean.
- Registry/prompt: `session-summary` passes `tests/prompts.test.ts` (parity, placeholders) and `validateTools()`/prompt-section checks.
- **Eval (owner-run, not CI):** a `session-summary` case under `evals/` asserting de-personalisation on real model output (extends the P3 harness; needs `ANTHROPIC_API_KEY`).

## Acceptance criteria

- [ ] A mentor sees, for their cohort only, per-student engagement + de-personalised summaries + self-reported helpfulness, and a per-tutor effectiveness rollup — with **no** way to reach the raw conversation (verified by a test asserting the view layer exposes no `messages` query).
- [ ] The summariser output contains no verbatim quotes or sensitive personal disclosure (unit contract test + an owner-run eval).
- [ ] A non-owner teacher cannot read another cohort's summaries/engagement.
- [ ] Students can self-report helpfulness at session close; the notice explains what mentors can/can't see.
- [ ] All gates green; new components have axe tests.

## Out of scope

Raw-transcript access for anyone but the student (admin safety path is a separate, logged feature), cross-cohort/institution analytics, grade/LMS linkage, real-time dashboards, non-Anthropic summariser models.

## Key files

- **New:** `app/server/repositories/insight.server.ts`, `app/lib/prompts/session-summary.prompt.ts` + `files/session-summary.{nl,en}.md`, `app/routes/cohorts.$id.insight.tsx`, session-close helpfulness control, `evals/session-summary/`, tests above.
- **Modified:** `app/server/schema.server.ts`, chat-session persistence (write a summary on close), `messages/{nl,en}.ts`, the P2 compliance-notice copy.
