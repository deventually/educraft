# Phase 14 — Governable local/CLI models + reversible student account removal

> **How to run this brief:** open it in a fresh session and implement it exactly, test-first per
> `AGENTS.md` / the `/tdd` skill. Do the internal phases in order (14.1 → 14.4); gate each with
> `npm test && npm run typecheck && npm run check` before moving on, and commit the phase. **Depends
> on** P13 (model gates), P6 (cohorts), P1 (auth/roles). Branch from `main`.

## Context & goal

Two gaps surfaced after P13 shipped.

1. **Local & CLI models were ungoverned.** P13 made frontier models curatable through an admin →
   teacher → cohort INTERSECT chain, but deliberately left **local (Ollama/LM Studio) and CLI (Claude
   Code, opencode, Codex, Gemini CLI) models "always free/selectable"** — they bypassed every gate
   (`pickableModels` always appended `localModels`, the stream free-passed `resolveModelInfo(id).local
   === true`, and both config UIs filtered them out with `clientSelectable && !m.local`). There was no
   way to curate them. **Goal:** make *every* model class — frontier, local, CLI — curatable by the
   admin and then narrowable by the teacher (per-teacher and per-cohort), **never by students**. Local/
   CLI stay *free* (no billing); they become *curatable*.
2. **Students could hard-delete their own account,** destroying data a teacher might still need.
   **Goal:** a student's removal request **disables** the account (reversible holding state) and
   notifies the teacher on the cohort screen; only teacher/admin may then **purge** or **restore** it.

## Locked decisions (user-confirmed)

1. Local/CLI models join the **P13 INTERSECT** chain, still free but curatable. `null`/unset = inherit
   (all) at every level ⇒ an uncurated instance is unchanged (back-compat).
2. **Discovered local models get per-model toggles** (uniform with frontier). Caveat: once an admin
   stores an explicit list, a newly-appearing local model stays off until re-ticked.
3. **Students never select a model** — unchanged; the gates only govern what admin/teacher may offer.
4. Student removal ⇒ **disable (reversible)**: `disabledAt` blocks login; `deletionRequestedAt` marks
   the student-initiated request so it surfaces on the cohort screen.
5. Teacher/admin **Remove = permanent purge** (`deleteUserCascade`); **Restore = reactivate**. The
   disabled state is a holding state between the two. Actions live on the **cohort manage screen**
   (`cohorts.$id.tsx`); a count badge on the cohort list. The privacy-safe insight screen is untouched.
6. Soft-disable is **student-scoped** — teacher/admin self-delete on `/account` stays a hard delete.

## 14.1 — Local/CLI models enter the gate (enforcement + loaders)

- **`availability.server.ts`:** `isModelSelectableForUser(user, id)` — false unless `isResolvableModel`
  **and** `resolveModelInfo(id).clientSelectable` (Opus stays out), then a membership walk over the
  applicable INTERSECT levels (instance `enabledModels`, then teacher `assignedModels` / student cohort
  set), passing when a level is null/empty (inherit) else requiring `id ∈ list`. Governs volatile
  discovered ids (`ollama::…`) without enumerating any local server. `narrowLocalModels(user,
  discovered)` = the discovered picker half filtered by that predicate.
- **`api.stream.tsx`:** replace `selectableModelIds.has(body.model) || resolveModelInfo(body.model).local
  === true` with `await isModelSelectableForUser(user, body.model)`.
- **`tool.tsx`:** narrow the discovered `localModels` through `narrowLocalModels(viewer, …)` before
  handing them to the picker (only loader feeding a picker — confirmed by grep).
- **Tests:** `tests/lib/availability.test.ts` (predicate: uncurated inherit, explicit curation, teacher/
  cohort narrowing, Opus/unknown excluded; `narrowLocalModels` drops disabled). `tests/api/stream.test.ts`
  (uncurated honours a local id; a disabled CLI/local model falls back to default; cohort refusal).

## 14.2 — Config UIs offer local/CLI models (admin + cohort)

- **`admin.models.tsx`:** `fullCatalog()` = static client-selectable (frontier + CLI, drop the `!m.local`
  filter) + `discoverLocalModels()` (group `local`). Loader/action validate against it; the instance +
  per-teacher forms include CLI/local. Grouped rendering (Frontier / CLI / Local); the misleading
  `localNote` / "always available" copy is corrected.
- **`cohorts.$id.tsx` (`assignableCohortModels`):** drop `!m.local`; append `narrowLocalModels(discovered)`.
- **i18n (nl/en):** `admin.models.{frontierGroup,cliGroup,localGroup,localGroupHint}` (replaces `localNote`).
- **Tests:** `admin-models.test.tsx` (CLI + a discovered local render as instance + per-teacher toggles;
  axe). `admin-routes.test.ts` (instance persists a CLI id; per-teacher CLI subset; all-of-base ⇒ null).
  `cohorts.test.tsx` (cohort fieldset lists a CLI option). `cohorts-route.test.ts` (cohort persists a CLI
  id). Route tests stub `discoverLocalModels` → `[]` (env-dependent host).

## 14.3 — Account disable schema + repos + auth + student request flow

- **Schema + migration 0007:** `users.disabledAt` + `users.deletionRequestedAt` (`timestamp_ms`, null =
  active). `createUser` seeds both null.
- **`users.server.ts`:** `requestAccountDeletion` (set both to now); `reactivateUser` (clear both).
- **Auth:** `getUser` returns null when `disabledAt` is set (before the sessionVersion check); `login.tsx`
  refuses a disabled account with `m.auth.accountDisabled` after a successful password verify.
- **`/account`:** the danger zone branches on role — a **student** calls `requestAccountDeletion` then
  `logout`; **teacher/admin** keep `deleteUserCascade`.
- **i18n (nl/en):** `auth.accountDisabled`; `account.{requestHeading,requestIntro,requestButton}`.
- **Tests:** `users-repo.test.ts` (round-trip); `auth.test.ts` (getUser + login block a disabled account);
  `account-route.test.ts` (student disables, teacher purges); `Account.test.tsx` (student variant + axe).

## 14.4 — Cohort-screen notification + student remove/restore (+ docs)

- **`cohorts.server.ts`:** `listCohortMembersWithStatus(cohortId)` (join memberships → users, returns
  status); `countPendingRemovals(cohortId)`; `removeMembership(cohortId, userId)`; **`assertManagesMember(actor,
  cohortId, userId)`** — the actor must manage the cohort AND the target must be a member, else a 404
  Response (no info leak).
- **`cohorts.$id.tsx`:** loader adds `members`; a **Students** section lists them with a `Badge` ("removal
  requested" / "disabled") + per-member **Remove** (ConfirmDialog → `intent="removeStudent"` →
  `deleteUserCascade`) and **Restore** (`intent="reactivateStudent"` → `reactivateUser`), both behind
  `assertManagesMember`.
- **`cohorts._index.tsx` + `admin.cohorts.tsx`:** a pending-removal count badge per cohort row.
- **i18n (nl/en):** `cohorts.{studentsHeading,studentsIntro,studentsEmpty,removalRequested,disabledBadge,
  pendingRemovals,removeStudent,removeStudentTitle,removeStudentBody,removeStudentConfirm,restoreAccess}`.
- **Docs:** header comments; `AGENTS.md` Access & Availability (models now ride the intersect; the account
  lifecycle); this brief + README row; `wiki/` (Authentication + Architecture); end-user help
  (`app/content/help/topics/account.md`); the model-availability + account-lifecycle memory notes.
- **Tests:** `cohorts-repo.test.ts` (status list + count; `assertManagesMember` allows a manager, 404s a
  stranger and a non-member; `removeMembership`). `cohorts-route.test.ts` (removeStudent purges a managed
  member; reactivateStudent clears; a non-manager is refused 404). `cohorts.test.tsx` (Students section +
  badge + Remove/Restore + empty state + axe). `cohorts-index.test.tsx` (list badge + axe).

## Out of scope

- No override semantics for models (narrow only). No runtime discovery in the stream (membership
  predicate). No student model picker. No teacher/admin self-delete change. No general "admin disables any
  user" console beyond the cohort-screen restore/remove. No fix to the insight-screen emptiness (derived
  P7 signal — separate). No email/push — the teacher notification is the in-app badge only.

## Acceptance — ✅ shipped 14.1–14.4 (`main`)

`npm test && npm run typecheck && npm run check` green after each sub-phase. Manual repro: an admin
disables a CLI agent instance-wide → it leaves the picker and, forced via the body, the stream falls back
to default; assigning a teacher only `{Haiku + Claude Code}` limits their picker/cohort editor; a cohort
restricted to `{Haiku}` blocks Claude Code for its students; clearing restores inheritance. A student
requests removal on `/account` → logged out, cannot log back in; the teacher sees the "removal requested"
badge (cohort + list), **Restore** re-enables login, **Remove** purges the account; a teacher cannot act
on a student in a cohort they do not manage.
