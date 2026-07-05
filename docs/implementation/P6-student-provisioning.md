# Phase 6 — Student Provisioning: Cohorts, Curated Invites & Anti-Sharing

Implements [`docs/adr/0001-student-provisioning-cohorts-mentor-insight.md`](../adr/0001-student-provisioning-cohorts-mentor-insight.md) (decisions D1–D4; D5 is Phase 7). Read the ADR first — this brief is the executable form of it.

## Context & goal

The access **gate** exists — `canUseTool` (`app/lib/registry/access.ts`) is enforced server-side in three places (home loader filter, tool loader 404, `api.stream` refuse), and invites are atomic single-use (`consumeInvite`). What's missing is **provisioning**: `createInvite` has zero callers (no UI), an invite carries only `role` (no creator, no tool curation, no config), there is no teacher↔student relationship, and a `student` account can't read a teacher's context profile so the programme EQF never reaches a tutor.

This phase lets a **teacher/admin provision specific students** — choosing, **per invite or per batch**, exactly which chat tutor(s) a student gets and how they're configured (including level) — via a first-class **cohort** (the shared config) with **per-student single-use invites** minted against it. It also injects the cohort's level into the ~4 learner tutors (closing the EQF-for-tutors thread) and hardens against **account/link sharing** (an AI-backend abuse vector).

**Not** multi-tenancy: the cohort is intra-instance ("the instance is the tenant" still holds).

Depends on: **P1** (auth/roles/scoping, `getDb()`, async repos, real migrations) and **P2** (per-user quotas — an anti-abuse layer we lean on). Overlaps **P4** (its "admin: invites" view defers to the provisioning UI built here).

## Constraints

- `AGENTS.md` contract: TDD (RED→GREEN→REFACTOR), gates (`npm test && npm run typecheck && npm run check`), every displayed string bilingual, a vitest-axe test for every new interactive component.
- **Extend P1, don't rewrite it.** Reuse `invite.tsx`, `session.server.ts`, `auth.server.ts`, `repositories/users.server.ts`, `access.ts`. Keep `consumeInvite` atomic/single-use.
- Real `drizzle-kit` migrations (P1 pattern); all DB access async, behind `repositories/`, via `getDb()`. No better-sqlite3 API outside `db.server.ts`.
- No multi-tenancy / org structures. No email sending (owner distributes invite links — same as P1). Persistent accounts only (the VO-minors ephemeral track is out of scope).
- Engine stays level/locale-neutral: level reaches tutors as data through `{{contextProfile}}`, never engine branching.

## Features

### 6.1 Schema additions & migration

**File:** `app/server/schema.server.ts` — add two tables and extend three:

```ts
export const cohorts = sqliteTable("cohorts", {
  id: text("id").primaryKey(),
  createdByUserId: text("created_by_user_id").notNull(),        // teacher/mentor/admin
  name: text("name").notNull(),                                // "SE jaar 2 — 25/26 blok 1"
  allowedToolSlugs: text("allowed_tool_slugs").notNull(),      // JSON string[] ⊆ userType:"student" slugs
  configJson: text("config_json").notNull().default("{}"),     // { [slug]: { values: Record<string,string> } }
  contextProfileId: text("context_profile_id"),               // teacher-owned profile → injected server-side for members
  activeUntil: integer("active_until", { mode: "timestamp_ms" }), // access window; null = open-ended
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const cohortMemberships = sqliteTable("cohort_memberships", {
  id: text("id").primaryKey(),
  cohortId: text("cohort_id").notNull(),
  userId: text("user_id").notNull(),                           // the student
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [uniqueIndex("membership_cohort_user").on(t.cohortId, t.userId)]);
```

Extend existing tables (add columns; dev DBs are disposable pre-launch — no backfill):
- `invites` → `createdByUserId text`, `cohortId text` (nullable — legacy teacher/admin invites have none), `email text` (nullable — binds the invite to the intended student).
- `chatSessions` → `userId text`, `cohortId text` (denormalised; **populated now** so Phase 7's analytics need no re-migration).
- `users` → `sessionVersion integer notnull default 0` (single-active-session, 6.7).

Export the new `$inferSelect` row types. Then `npm run db:generate` (one migration covering all deltas); it runs on boot via the P1 migrator.

### 6.2 Cohort repository

**New file:** `app/server/repositories/cohorts.server.ts` (async, via `getDb()`):
- `createCohort(input)`, `updateCohort(id, patch)` (edit config/allowlist/`activeUntil`), `getCohort(id)`, `listCohortsByOwner(userId)`.
- `addMembership(cohortId, userId)`, `getCohortForUser(userId)` (join membership→cohort; the student's active cohort — MVP: at most one), `getAllowedToolSlugs(userId): Promise<Set<string> | null>` (parse `allowedToolSlugs`; `null` when the user has no cohort).
- `isCohortActive(cohort)` — `!activeUntil || activeUntil > now`.

### 6.3 Curated, identity-bound, batch invites

**File:** `app/server/repositories/users.server.ts`:
- Extend `CreateInviteInput` + `createInvite` with `createdByUserId`, `cohortId?`, `email?`.
- Add `createInvitesForCohort(cohortId, createdByUserId, recipients: { email?: string }[], expiresAt): Promise<InviteRow[]>` — mints one single-use token per recipient (the **batch** primitive; a single invite is `recipients.length === 1`).
- Extend `consumeInvite`: if `invite.email` is set, the redeemer's submitted email **must match** (case-insensitive) or reject. Keep the atomic `UPDATE … WHERE used_by_user_id IS NULL`. On success the caller (6.6) also creates the membership.

### 6.4 Provisioning UI — the front door (per-invite **or** batch, with tool curation)

This is the feature you asked for: choose **which tutors** and their config **when you issue an invite or batch**. A cohort is created *by* this flow — the teacher thinks "invite these students, give them these tutors," and the cohort is the container.

**File:** `app/routes.ts` — add (behind the AppShell, gated): `route("cohorts", "routes/cohorts._index.tsx")`, `route("cohorts/:id", "routes/cohorts.$id.tsx")`.

- **`cohorts._index.tsx`** (`requireRole(request, "teacher", "admin")`): lists the owner's cohorts (name, tool count, member count, active-until) + "New provisioning" CTA.
- **`cohorts.$id.tsx`** — create/manage one cohort and issue invites. The create/issue form:
  - **Name** (auto-suggested), **tutor multi-select** — checkboxes over the six `userType:"student"` tools (source from the registry, not hardcoded), each with a collapsible **per-tutor config** (its sandbox inputs, reusing the tool's input schema).
  - **Context profile** select (the owner's profiles → seeds level/EQF) + **access window** (`activeUntil`) + **invite expiry** (short default, e.g. 7 days).
  - **Recipients:** a single email, **or** a batch (textarea of emails, or "generate N link-only invites"). Email is optional → link-only bearer invite; email present → identity-bound (6.3).
  - **Submit:** `createCohort(config)` then `createInvitesForCohort(...)`; render the generated invite links (copyable — no email sending). Re-issuing later into the same cohort supports late joiners.
  - **Config granularity = the batch (invariant).** Every invite minted in one submit shares that cohort's tools/config. A **single** invite is a batch of one: it gets its own cohort, so its available tools are configured independently for that student. To give different students different tutors, issue separate invites/batches (each its own cohort). There are **no per-member tool overrides within a batch** — same batch ⇒ same tools.
- Bilingual strings in `messages/{nl,en}.ts`; **axe zero-violations test** for the form.

**Minting stays scriptable too:** keep `scripts/invite.ts` (P1) working for role-only ops invites (no cohort).

### 6.5 Cohort-aware access control

**File:** `app/lib/registry/access.ts` — widen the interface, keep it pure/data-driven:

```ts
export function canUseTool(
  user: { role: Role },
  tool: Pick<Tool, "slug" | "userType"> | { slug: string; userType: UserType },
  allowedSlugs?: Set<string> | null,   // resolved from the student's cohort; undefined/null = unconstrained
): boolean {
  if (user.role !== "student") return true;
  if (tool.userType !== "student") return false;
  return !allowedSlugs || allowedSlugs.has(tool.slug);
}
```

Resolve `allowedSlugs` via `getAllowedToolSlugs(user.id)` and pass it at the **same three enforcement points**: `home.tsx` loader (filter), `tool.tsx` loader (404), `api.stream.tsx` (refuse). Also refuse when the student's cohort is **inactive** (`activeUntil` passed) — a localized SSE error in `api.stream`, 404 in the tool loader. A student with no cohort keeps today's behaviour (all student tools) so nothing regresses.

### 6.6 Redemption joins the cohort; server injects level via membership

**File:** `app/routes/invite.tsx` action — after `consumeInvite` + `createUser`, if the invite has a `cohortId`, `addMembership(cohortId, userId)`. Enforce the `email` match (6.3) at the form boundary (surface a localized error).

**File:** `app/routes/api.stream.tsx` — for a `student` running a tutor, resolve `getCohortForUser(user.id)` and, when the cohort has a `contextProfileId`, load that profile **authorised by membership** (a new `getProfileForMember(userId, profileId)` that checks membership, *not* owner-scoping — this is the sanctioned bypass of finding #2's rule) and merge `cohort.configJson[slug].values` into the tutor's input values. Teachers/admins keep the existing `usesContextProfile && contextProfileId` path unchanged.

### 6.7 Anti-sharing: single active session (D4)

Sharing an account/link lets an unintended actor abuse the LLM backend. Layered defence — email-bound invites (6.3), per-user quotas (P2), and the constrained tutor surface already exist; add **single active session**:

**Files:** `app/server/session.server.ts` (store `{ userId, sessionVersion }`), `app/server/auth.server.ts` (`getUser` compares the cookie's `sessionVersion` to `users.sessionVersion`; mismatch → treat as logged out), `login.tsx` + `invite.tsx` (bump `users.sessionVersion` and write it into the new session on every login/redeem, invalidating older cookies). Document that true concurrent-use detection (a server-side sessions table + IP heuristics) is a later step.

### 6.8 Level reaches the learner tutors (the EQF payoff)

Make the ~4 **learner** tutors receive the cohort's level; leave persona-/mirror-driven and teacher tools untouched.

- **Prompts** (`app/lib/prompts/files/<id>.{nl,en}.md`) for **scaffolding-feedback, socratic-partner, peer-tutoring, mentorai**: add a single `{{contextProfile}}` injection point (exactly once — see `tests/prompts.test.ts`) and a **"Level & tone adaptation"** section per `TEMPLATE.md` §4, worded for **direct address** (pitch vocabulary/sentence-length/abstraction to the level, **recalibrate to the learner, never name the level**). Migrate MentorAI's `foundation/intermediate/advanced` and Peer-Tutoring's `high-school/undergraduate/graduate` onto this spine (retire the bespoke `level` inputs). Keep NL/EN substantively identical.
- **Registry:** set `usesContextProfile: true` on those four. Leave **think-pair-share** (adapts by mirroring), **dialogic-encounters** (adult/persona-driven), **bloom-by-design** (teacher) at `false` — deliberate; note it.
- **Direct-address directive:** in `app/lib/context/format.ts` add `LEVEL_DIRECTIVE_DIRECT` (register-first); thread an `audience` (or `learnerFacing`) argument from `app/lib/template/buildSystemPrompt.ts` → `formatProfile`, and have `api.stream` pass it from `tool.userType === "student"`. Instructor tools keep the existing substance-first directive.

### 6.9 The student sees no sandbox — prefilled from the cohort

A provisioned student must **not** be re-asked for the teaching context the teacher already set. The tutor's input fields are **not removed** from the tool definition (teachers use them in 6.4's config UI and when running a tool directly); they are **bypassed and prefilled** on the student's path.

- **`app/routes/tool.tsx` loader:** for a `student` with a cohort, resolve `getCohortForUser` + its `configJson[slug].values`; pass them to the view as **prefilled, locked** sandbox values, and **do not** pass a profile list (the cohort profile is applied server-side, 6.6). Teachers/admins keep today's behaviour (their own profiles + editable sandbox).
- **`app/components/ChatView.tsx`:** when given locked prefilled values, **skip the sandbox step and settings/profile controls** and open directly on the greeting/starters. Optionally show a compact read-only "Ingesteld voor: …" line for transparency. (The shared sandbox hook that P5.4 extracts must carry this locked/prefilled mode — flagged there.)
- All sandbox fields are teacher-config for provisioned tutors (they define the activity; the student contributes through the chat). A future "student-provided field" distinction is out of scope.

## Test plan (write these first — RED)

- `tests/api/cohorts-repo.test.ts`: create cohort; add membership (unique per (cohort,user)); `getAllowedToolSlugs` returns the parsed set / `null` with no cohort; `isCohortActive` honors `activeUntil`.
- `tests/api/users-repo.test.ts` (extend): `createInvite` stores creator/cohort/email; `createInvitesForCohort` mints N single-use tokens; `consumeInvite` rejects an email mismatch and stays single-use/atomic.
- `tests/lib/access.test.ts` (extend): `canUseTool` matrix with `allowedSlugs` — student×allowed ✅, student×student-tool-not-in-cohort ❌, `null` allowedSlugs = all student tools; teacher/admin unaffected.
- `tests/api/invite-flow.test.ts` (extend P1's): redeeming a cohort invite creates the membership; email-bound invite requires a match.
- `tests/api/auth.test.ts` (extend): a stale `sessionVersion` cookie is unauthenticated after a newer login.
- `tests/buildSystemPrompt.test.ts` / `tests/context.test.ts` (extend): learner audience emits `LEVEL_DIRECTIVE_DIRECT`; instructor audience emits the substance directive; exact strings asserted, NL vs EN per output language.
- `tests/prompts.test.ts` **must stay green** for the four edited tutors (parity + single `{{contextProfile}}`); `tests/tools/<id>.test.ts` updated for the retired `level` inputs.
- `tests/components/cohorts.test.tsx`: form renders tutor checkboxes + per-tutor config, issues a (mocked) batch, shows links; axe zero violations.
- `tests/components/ChatView.test.tsx` (extend): given locked prefilled values (student mode), the sandbox form + profile/settings controls are absent and the greeting renders immediately; teacher mode still shows the editable sandbox; axe clean in both.
- Registry: `validateTools()` stays clean after the four `usesContextProfile` flips.

## Acceptance criteria

- [ ] A teacher can, in one flow, pick specific tutor(s) + configure them + set an expiry/access window, and mint **either** a single **or** a batch of single-use invite links. A single invite carries its own independently-chosen tool set; **all invites in a batch share one tool set** (config granularity = the batch).
- [ ] Redeeming a cohort invite creates the account, joins the cohort, and the student sees/uses **only** that cohort's tutors (home filtered, 404 elsewhere, `api.stream` refuses) — verified by tests **and** one two-account walkthrough.
- [ ] An email-bound invite rejects a different email; every invite stays single-use; an expired cohort blocks access without deleting anything.
- [ ] A second login invalidates the first session (single active session).
- [ ] A cohort student running one of the four learner tutors gets the cohort profile's level injected (server-side, via membership) with the **direct-address** directive; instructor tools are unchanged; the four prompts keep NL/EN parity and a single `{{contextProfile}}`.
- [ ] A provisioned student opens a tutor and lands **directly in the chat** — no sandbox form, no profile selector — with the teacher's config already applied; the same tool run by a teacher still shows the editable sandbox (fields are prefilled/hidden, never removed).
- [ ] Fresh clone boots with the new migration (dev DB reset noted in the commit); all gates green; the new form has an axe test.

## Out of scope

Mentor insight / session summaries / effectiveness views (**Phase 7**), email sending (owner distributes links), VO-minors ephemeral join-codes, per-member tool overrides within a cohort, LTI/SSO roster sync, concurrent-session (multi-IP) detection, admin cross-cohort analytics.

## Key files

- **New:** `app/server/repositories/cohorts.server.ts`, `app/routes/cohorts._index.tsx`, `app/routes/cohorts.$id.tsx`, `tests/api/cohorts-repo.test.ts`, `tests/components/cohorts.test.tsx`.
- **Modified:** `app/server/schema.server.ts`, `repositories/users.server.ts`, `session.server.ts`, `auth.server.ts`, `app/routes/invite.tsx`, `login.tsx`, `home.tsx`, `tool.tsx`, `api.stream.tsx`, `app/components/ChatView.tsx` (student prefill/no-sandbox mode), `app/lib/registry/access.ts`, `app/lib/context/format.ts`, `app/lib/template/buildSystemPrompt.ts`, the four learner tutors' registry + prompt files, `messages/{nl,en}.ts`.
