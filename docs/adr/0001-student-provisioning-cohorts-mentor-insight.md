# ADR 0001 — Student provisioning via cohorts, mentor insight, and anti-sharing security

- **Status:** Proposed (owner-approved direction; specs to follow in `docs/implementation/`)
- **Date:** 2026-07-05
- **Supersedes / extends:** the "Roles, not multi-tenancy" and "Auth: invite links" decisions in [`Improvement-Plan.md`](../Improvement-Plan.md). Nothing here reverses those; it fills the **intra-instance provisioning** gap they left open.
- **Related:** [`P1-auth-roles-scoping.md`](../implementation/P1-auth-roles-scoping.md), [`P3-prompts-eqf-evals.md`](../implementation/P3-prompts-eqf-evals.md) (EQF spine), `app/lib/registry/access.ts` (`canUseTool`).

## Context

The product model is B2B2C: an **institution employee (teacher / mentor / SLB) or admin provisions pedagogical AI tools to specific students.** The student is the end-user; the teacher is the buyer/configurer. Today the engine supports part of this and is missing the rest:

**What already exists (verified):**
- Roles are real: `users.role ∈ {student, teacher, admin}`.
- Tool access is genuinely gated by `canUseTool(user, tool)`, enforced server-side in **three** places — the home loader (list filter), the tool loader (404), and the stream action (refuse). A `student` may reach only `userType: "student"` tools (the 6 chat tutors: mentorai, peer-tutoring, socratic-partner, dialogic-encounters, scaffolding-feedback, think-pair-share); Bloom + the 9 generators/graders return 404.
- Invites are single-use and race-safe: `consumeInvite` does an atomic `UPDATE … WHERE used_by_user_id IS NULL`, plus an `expiresAt` check.
- Per-user daily quotas exist (`usage` table, enforced in `api.stream`).
- The EQF 1–8 level spine (P3) already carries level-adaptation into any tool via `{{contextProfile}}` and a reader-aware directive that explicitly anticipates a chat tutor.

**What is missing:**
1. **No provisioning UI or payload.** `createInvite` has zero callers; an invite carries only `role` — no creator, no tool allowlist, no configuration. A student who somehow logs in gets *all six* tutors, not a teacher-curated subset, and nothing is pre-configured.
2. **No teacher↔student relationship.** No cohort/class/ownership edge; every account is scoped only to itself.
3. **No way to seed a tutor's level from the teacher.** A `student` account cannot read a teacher's `contextProfile` (owner-scoped), so the programme EQF cannot reach a student-run tutor through the normal path.
4. **No mentor insight.** No cohort-scoped view of engagement or effectiveness; `chatSessions` has no `userId` to scope by.
5. **Weak anti-sharing posture.** Once an account exists, a shared password (or a forwarded pre-redemption link) lets an unintended person abuse the LLM backend. The owner considers this a security breach, not a UX detail.

## Decisions

### D1 — Persistent student accounts (not ephemeral join-codes), for the adult/hbo/mbo track first
Students get real accounts via invite → password → session cookie, exactly like teachers today. Tutoring rewards **continuity** (return visits, history, progress signals), which ephemeral links throw away. An ephemeral, no-account "join code" model is reserved for a **later VO-minors track**, where no-PII / no-password is genuinely the better fit (GDPR minimisation for minors). One sector at a time.

### D2 — A first-class `cohort` is the configuration entity; per-student invites are minted against it
Your requirement — "configure the chat tools once, choose exactly which are available, provision to student**(s)**, but only one person per link" — is two levels:
- **`cohorts`** (teacher-owned): the shared configuration — which tutors are allowed (a subset of the six), each tutor's sandbox inputs, the level/context to inject, and an access window. Set **once**.
- **Per-student, single-use invites** minted against a cohort: one link = one student. Redeeming creates the account and **joins the cohort**, inheriting its allowlist + config.

This gives "one config → many students" with individual, revocable access, and finally creates the teacher↔student edge — **without** multi-tenancy. The cohort lives *inside* an instance, and "the instance is the tenant" still holds.

### D3 — The cohort seeds the tutor's level via the existing context-profile machinery; the tutor still calibrates
The cohort references a **teacher-owned `contextProfile`** (which already carries `eqf` 1–8, programme, packs). When a student in the cohort runs a tutor, the **server injects that profile on the student's behalf** — authorised by *cohort membership*, not by profile ownership. This reuses `formatProfile` + the P3 EQF directive verbatim and dissolves the "student can't see the teacher's profile" problem. The tutor is told to **start at that level and recalibrate to the learner**, never lock. Student self-report ("3 havo") is a *fallback* for a future pure self-serve mode, not the primary path.

Only the **~4 true learner tutors** (scaffolding-feedback, socratic-partner, peer-tutoring, mentorai; think-pair-share adapts by mirroring) get direct-address register adaptation. Dialogic-encounters (adult, persona-driven) and Bloom (teacher) do not — `userType` gates *access*, a separate signal governs *level behaviour*.

### D4 — Account/link sharing is a security threat; defend in depth
Sharing enables an unintended actor to abuse the AI backend (cost, off-topic use, data exfiltration). Perfect prevention is impossible (screen-sharing, prompt relaying), so the goal is: **make casual sharing ineffective and abuse costly + detectable.** Layers:

1. **Identity-bound invites** — an invite may carry the intended student's `email`; redemption must match it (or the link is delivered *to* that mailbox, making mailbox control a second factor). Single-use + **short TTL** shrink the pre-redemption leak window.
2. **Single active session** — `users.sessionVersion`, bumped on each login and carried in the cookie; a new login invalidates older cookies. Kills serial credential-sharing. (True concurrent-use detection — a server-side `sessions` table with last-seen + IP — is a stronger later step.)
3. **Per-user quotas** — the existing daily request/token caps bound the blast radius of any leaked credential.
4. **Constrained surface** — a student credential reaches only the cohort's allowlisted, heavily-bounded tutors (Voice & Bounds refuse off-topic / answer-fishing), so a leaked account is a poor general-purpose LLM.
5. **Access window** — `cohort.activeUntil` lets a mentor revoke a whole cohort without touching auth.

**Separate the two lifetimes:** the invite link is *bootstrap-only* (short, single-use); ongoing authorisation lives on the **cohort**, not the link. Conflating them is the trap.

### D5 — Mentor insight surface, effectiveness as *advice not verdict*, privacy-first
The provisioning teacher/mentor sees, scoped to cohorts they own:
- **Engagement** (solid, derived): sessions, turns, last-active, per tutor.
- **Student-reported helpfulness / reflection** (self-report, decent): an optional end-of-session rating.
- **Tutor-generated session summaries** (LLM judgement, useful but not ground truth): a post-session pass emits a structured summary (focus, struggles, progress, misconceptions).

Be honest about limits: *usage ≠ learning.* These are **signals for the mentor's judgement**, framed exactly like the graders' "advice to the teacher, who decides" — never an automated verdict on the student.

**Privacy is by construction, not by policy toggle: the mentor never sees the raw chat history — at all.** The student's conversation stays private to the student. The mentor receives only *derived, de-personalised learning feedback*: engagement metrics, skills/topics progressed, conceptual misconceptions framed **about the material, not the person**, and whatever the student chose to self-report. The `session-summary` pass is explicitly instructed to abstract to learning-relevant signal and to **omit sensitive personal disclosure** (anxiety, personal circumstances) and verbatim quotes — the mentor sees signal about *the work*, not a window into the student. Access split: the **student** sees their own history (continuity); the **mentor** sees only derived feedback, never raw; an **admin** may reach raw content only through a separate, logged, exceptional safety/abuse path. This is the data-minimisation + purpose-limitation posture the AI Act / minors context demands.

## Data-model deltas (sketch)

Drizzle `sqliteTable` style, matching `app/server/schema.server.ts`. All access stays behind `app/server/repositories/` and every function is `async` (per the SQLite-portability decision). Real `drizzle-kit` migrations, not boot-time DDL.

```ts
// NEW — the shared configuration a teacher provisions once.
export const cohorts = sqliteTable("cohorts", {
  id: text("id").primaryKey(),
  createdByUserId: text("created_by_user_id").notNull(),      // teacher/mentor
  name: text("name").notNull(),                              // "SE jaar 2 — 25/26 blok 1"
  allowedToolSlugs: text("allowed_tool_slugs").notNull(),    // JSON string[]  ⊆ userType:"student"
  configJson: text("config_json").notNull().default("{}"),   // { [slug]: { values: {...} } }  per-tutor sandbox inputs
  contextProfileId: text("context_profile_id"),              // teacher-owned profile → injected server-side for members
  activeUntil: integer("active_until", { mode: "timestamp_ms" }), // access window; null = open
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// NEW — student ↔ cohort. (One row per membership; join table leaves room for multi-cohort later.)
export const cohortMemberships = sqliteTable("cohort_memberships", {
  id: text("id").primaryKey(),
  cohortId: text("cohort_id").notNull(),
  userId: text("user_id").notNull(),                          // the student
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [uniqueIndex("membership_cohort_user").on(t.cohortId, t.userId)]);

// NEW — the progress/effectiveness signal, one per finished chat session.
export const sessionSummaries = sqliteTable("session_summaries", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),                    // FK chat_sessions
  userId: text("user_id").notNull(),                          // student (denormalised for scoped queries)
  cohortId: text("cohort_id"),                                // denormalised for cohort rollups
  toolSlug: text("tool_slug").notNull(),
  summaryJson: text("summary_json").notNull(),                // de-personalised learning signal only: { topicsWorkedOn[], skillsProgressed[], misconceptions[] (about the material), effort }. No verbatim quotes, no personal disclosure.
  helpfulness: integer("helpfulness"),                        // optional student self-rating at close
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// EXTEND invites — creator, provisioning target, identity binding.
//   + createdByUserId  text            // who issued it (teacher/admin)
//   + cohortId         text            // redeemer joins this cohort (nullable → legacy teacher/admin invite)
//   + email            text            // bind to intended student; redemption must match (nullable)

// EXTEND chat_sessions — so mentor/cohort views can scope without a projects join.
//   + userId           text            // the student
//   + cohortId         text            // denormalised for rollups

// EXTEND users — single active session (anti-sharing).
//   + sessionVersion   integer notnull default 0   // bumped on each login; carried in the session cookie
```

### Access & injection flow (server)
- `getAllowedToolSlugs(userId): Promise<Set<string> | null>` — reads memberships → `cohort.allowedToolSlugs`. `null` = no cohort (falls back to "all student tools").
- `canUseTool(user, tool, allowedSlugs?)` — unchanged for teacher/admin; for `student`, require `tool.userType === "student"` **and** (`allowedSlugs` absent **or** `allowedSlugs.has(tool.slug)`). Same three enforcement points; still pure, still data-driven.
- **Profile injection for members:** in `api.stream`, when a `student` runs a tutor, resolve `membership → cohort → contextProfileId` and inject it (server-authorised by membership, bypassing owner-scoping), and merge `cohort.configJson[slug].values` as the tutor's sandbox inputs.
- **Redemption (`invite.tsx` action):** if `invite.email` is set, require a match; after `createUser`, if `invite.cohortId` is set, insert a `cohortMembership`.
- **Login:** bump `users.sessionVersion`, store it in the cookie; a session-check helper rejects a cookie whose `sessionVersion` is stale.

### Effectiveness pipeline
- **New prompt** `session-summary` (registered like any tool prompt): summarise a transcript against a small rubric → `sessionSummaries` row. Runs post-session (on close, or a sweep). Reuses `provider`.
- **Engagement**: derived from `chat_sessions` / `messages`, now `userId`/`cohortId`-scoped.
- **Views** (teacher/admin, `requireRole`): cohort → students → per-student (engagement + de-personalised summaries); cohort → per-tutor effectiveness rollup (engagement + avg helpfulness). **No raw-transcript path to the mentor exists** — the view layer has no query that returns `messages` for a mentor. Raw content is reachable only by the student (own history) or an admin via a separate, logged safety path.

### New routes
- `cohorts._index`, `cohorts.$id` — create/manage a cohort (name, pick tutors, per-tutor config, context profile / EQF, `activeUntil`), and **mint per-student invites** (first real caller of `createInvite`).
- `cohorts.$id.insight` (or `students.$id`) — the mentor progress/effectiveness view.

## Consequences

- **Positive:** realises the B2B2C vision incrementally on a working access gate; closes the EQF-for-tutors question (level is a cohort field); gives mentors real insight; makes sharing costly + detectable; no multi-tenancy taken on. Everything stays consistent with DB-per-tenant and SQLite-portability decisions.
- **Costs / risks:** new tables + migrations; `chat_sessions.userId` backfill; a summariser LLM pass per session (cost — cap it, and gate on session length); the summariser must be **tested against leakage** (a de-personalisation eval: assert summaries carry no verbatim quotes / sensitive disclosure); single-active-session can surprise legitimate multi-device users (accept for students; revisit for teachers).
- **Explicitly deferred:** true concurrent-session detection (server-side `sessions` table), the VO-minors ephemeral track, LTI/SSO roster sync, cross-cohort analytics.

## Alternatives considered

- **Flip `usesContextProfile` on all chat tools (the original minimal fix).** Rejected: injects the whole teacher-framed programme block, assumes the student can see a teacher profile (they can't), and does nothing for provisioning, curation, sharing, or insight.
- **Config inlined on each invite (no cohort entity).** Rejected as the primary model: it can't express "one config → many students" or revocation cleanly, and forces a migration to a cohort later. (It's a fine *degenerate* case: a one-student cohort.)
- **Ephemeral join-codes now.** Rejected for the first track: loses tutoring continuity and the progress signal; kept for the later minors track.
- **Full multi-tenancy / classes-as-tenants.** Rejected: contradicts "the instance is the tenant" and over-builds; the cohort is intra-instance provisioning, not a tenant boundary.

## Open questions

1. **Invite delivery:** email-bound implies the app can send email (or the teacher copies a link and is trusted to send it to the right person). Which, for the test-drive?
2. **Session-summary trigger:** on explicit session close, on idle timeout, or a periodic sweep? (Affects cost and completeness.)
3. **Student identity for VO minors** later: institutional email vs teacher-issued code — drives the ephemeral track's shape.
4. **Multi-device for students:** is single-active-session too strict (a student on phone + laptop), or exactly the point?
