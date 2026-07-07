# Phase 13 — Per-teacher & per-cohort model availability

> **How to run this brief:** open it in a fresh session and implement it exactly, test-first per
> `AGENTS.md` / the `/tdd` skill. Do the internal phases in order (13.1 → 13.4); gate each with
> `npm test && npm run typecheck && npm run check` before moving on, and commit the phase. **Depends
> on** P4 (instance model allow-list + admin console), P6 (cohorts + per-tutor config). Branch from
> `main`.

## Context & goal

Today there is exactly **one** model gate: the admin's instance-wide allow-list (`enabledModels`),
resolved by `getSelectableModelIds()` = client-selectable catalog ∩ `enabledModels`, with a lockout
fallback to `DEFAULT_MODEL`. It is enforced in `api.stream.tsx` (a caller may only force an enabled
model or a free local one) and offered in `tool.tsx` (`getSelectableModels`). There is no per-teacher
and no per-cohort dimension.

The goal is two more gates, so an admin can hand a **teacher** a subset of the instance's models, and
a teacher can hand a **cohort** a subset of their own:

```
admin  → teacher : which models may this teacher use / assign?
teacher→ cohort  : which of the teacher's models may this cohort's students pick?
```

## The model (single source of truth) — INTERSECT, not override

Models are a **billing/safety cap**, so every level can only *narrow*, never widen (the opposite of
the P12 context axes, which override). Effective selectable **catalog** model ids for a caller:

| caller | effective set |
| --- | --- |
| admin (or no user) | `base` = client-selectable catalog ∩ instance `enabledModels` |
| teacher | `base` ∩ their `assignedModels` (unset/empty ⇒ `base`) |
| student | `base` ∩ their cohort's `allowedModels` (unset/empty ⇒ `base`) |

- **Empty/unset at a level = inherit the level above** (never "banned"), so nobody can be locked out
  by narrowing. The single lockout guard stays: if the final intersection is empty (only reachable
  via a stale instance list), fall back to `DEFAULT_MODEL` + warn.
- **Local / CLI / discovered models are free** (cost the owner nothing) and stay **always selectable**
  — the intersect governs the *catalog* set only, exactly as instance does today. The stream keeps
  waving through `resolveModelInfo(id).local === true`; pickers keep appending `localModels`.
- A student's cohort set was already chosen from the owner's effective set at save time; at read time
  we re-apply **instance** (the hard cap) but not the owner's live assignment — the cohort set is the
  teacher's explicit, concrete choice. (Documented; keeps the read path a single cohort lookup.)

## Locked decisions (user-confirmed)

1. **Intersect (narrowing), not override.** teacher ⊆ instance, cohort ⊆ teacher. Empty = inherit.
2. **Per-cohort set lives on a new `cohorts.allowedModelsJson` column** (JSON `string[]`, `null` =
   inherit), via a real Drizzle migration — it is intrinsic cohort config (like `allowedToolSlugs` /
   `configJson`), loaded/saved with the row, and dropped automatically with the cohort.
3. **Per-teacher set is migration-free** — an `assignedModels:<userId>` `instance_settings` key, the
   exact P8/P10/P12 per-teacher storage pattern. No activation flag (intersect needs none).
4. **Both tiers ship together** as P13.

## 13.1 — Repos + availability composition

- **`users.server.ts`:** `getUserAssignedModels`/`setUserAssignedModels` via the existing
  `getAssignedList`/`setAssignedList` on key `assignedModels:<userId>` (null/empty = unrestricted).
- **`cohorts.server.ts`:** new column `allowedModelsJson` on `cohorts`; `allowedModelsOf(cohort):
  Set<string> | null` (pure, mirrors `allowedSlugsOf`); `getAllowedModelIds(userId)` (via
  `getCohortForUser`, mirrors `getAllowedToolSlugs`). `CreateCohortInput`/`UpdateCohortPatch` gain
  `allowedModelIds?: string[] | null`; `createCohort`/`updateCohort` persist it (JSON or null).
- **Schema + migration:** add `allowedModelsJson: text("allowed_models_json")` to `cohorts`; run
  `npm run db:generate` (tests apply migrations to the in-memory DB on first connect, so the column
  must exist as SQL).
- **`availability.server.ts`:** split out `selectableCatalogIds()` (`base`, no fallback); make
  `getSelectableModelIds(user?)` and `getSelectableModels(user?)` user-aware — narrow `base` by the
  teacher's assignment or the student's cohort set (`narrow(ids, r) = !r||!r.size ? ids : ids ∩ r`),
  then apply the empty-set → `DEFAULT_MODEL` lockout. No-arg call = `base` (unchanged for existing
  callers).
- **Test plan (RED):**
  - `tests/api/users-repo.test.ts` — `assignedModels` round-trip (null default, set, clear).
  - `tests/api/cohorts-repo.test.ts` — `createCohort({allowedModelIds})` → `allowedModelsOf`;
    `updateCohort` change + clear; `getAllowedModelIds` via a membership; `null` when unset.
  - `tests/lib/availability.test.ts` — teacher narrows by assignment; student narrows by cohort;
    admin/no-user = base; empty final set → `DEFAULT_MODEL` (+ warn); a non-restricting (null)
    assignment/cohort = base.

## 13.2 — Admin → teacher UI (`admin.models.tsx`)

- **Loader:** keep the instance section; add `base` (instance-enabled selectable catalog) + a
  `teachers` list, each with `assignedModels` (array | null).
- **Action:** add `intent` — `intent="instance"` (today's save) and `intent="teacher"`. Teacher save:
  resolve `userId` to a real teacher (404 otherwise); filter submitted ids to `base`; store `null`
  when the selection is empty **or** covers all of `base` (= inherit), else the subset via
  `setUserAssignedModels`. No lockout needed (empty = inherit, not ban).
- **UI:** a per-teacher `<Form>` (client-free — plain checkboxes over `base`, pre-checked from
  `assignedModels`, `null` ⇒ all checked). Small, mirrors `admin.context.tsx`'s teacher list.
- **i18n:** `admin.models.teacherLegend`, `teacherIntro`, `teacherInherits`, `teacherNone` (NL/EN).
- **Test plan (RED):** `tests/components/admin-models.test.tsx` (teacher section renders + pre-checks;
  axe zero-violations); `tests/api/admin-routes.test.ts` (`intent="teacher"` persists a subset;
  empty/all → null inherit; unknown/non-teacher userId → 404; `intent="instance"` still guarded).

## 13.3 — Teacher → cohort UI (`cohorts.$id.tsx`)

- **Loader:** pass `models: { catalog: PickerModel[], selected: string[] | null }` — `catalog` =
  `getSelectableModels(user)` (the editor's own effective set), `selected` = `allowedModelsOf(cohort)`.
- **Action:** read `models` field, filter to the editor's effective catalog ids, store `null` when
  empty or all-selected (= inherit the teacher's set), else the subset; thread `allowedModelIds`
  through both the create and edit `updateCohort`/`createCohort` calls.
- **UI:** a "Modellen voor dit cohort" `<fieldset>` of checkboxes (pre-checked from `selected`,
  `null` ⇒ all). Local models are free/omitted here (catalog only), consistent with the gates.
- **i18n:** `cohorts.modelsLegend`, `modelsHint`, `modelsInherit` (NL/EN).
- **Test plan (RED):** `tests/components/cohorts.test.tsx` (model fieldset renders + pre-checks; axe);
  `tests/api/cohorts-route.test.ts` (create + edit persist a subset; empty/all → null; a body model
  outside the editor's effective catalog is dropped).

## 13.4 — Stream / tool enforcement + docs

- **`api.stream.tsx`:** `getSelectableModelIds(user)` (was no-arg) — a student is narrowed by their
  cohort, a teacher by their assignment. Local-model freedom + the vision gate unchanged.
- **`tool.tsx`:** `getSelectableModels(viewer)` (was no-arg) — the picker offers only the caller's
  effective catalog (+ discovered local models, as today).
- **Test plan (RED):** `tests/stream.test.ts` — a cohort-restricted student (and an
  assignment-restricted teacher) who forces an out-of-set **catalog** model falls back to the
  tool/stage default; a free local model is still honoured.
- **Docs:** header comments (`availability.server.ts`, `admin.models.tsx`, `cohorts.server.ts`);
  `AGENTS.md` Access & Availability (note the intersect chain vs P12's override); this brief + README
  row; the availability memory note.

## Out of scope

- **No override semantics** — models narrow only (billing cap); the P12 context axes keep override.
- **No per-model pricing/quota**, no per-cohort *default* model (just the selectable set), no change
  to the free local/CLI/discovered path.
- **No new instance axis** beyond the existing `enabledModels`; no student-facing UI beyond the
  already-shown picker (now narrowed).

## Acceptance

`npm test && npm run typecheck && npm run check` green after each sub-phase. Manual repro: admin
assigns Teacher T only `{Haiku}` → T's picker + cohort editor offer only Haiku; T restricts a cohort
to `{Haiku}` → a student in it can pick/force only Haiku (Sonnet in the body falls back to default),
while a free local model stays selectable. Clearing an assignment/cohort set restores inheritance.
