# Phase 12 — Per-teacher override + instance Domains axis

> **How to run this brief:** open it in a fresh session and implement it exactly, test-first per
> `AGENTS.md` / the `/tdd` skill. Do the internal phases in order (12.1 → 12.4); gate each with
> `npm test && npm run typecheck && npm run check` before moving on. **Depends on** P8 (the
> compose seam), P9 (country/sector write UI) and P10 (per-teacher domains). Branch from `main`.

## Context & goal

The context-editor availability axes (country/sector/domain) composed the instance allow-list and
the per-teacher assignment by **intersection**, with a "no editor may offer nothing" lockout guard
that fell back to the full catalogue on an empty result. That produced a silent, backwards bug: set
instance sectors = `{wo}` and a teacher's per-teacher sectors = `{vo}`, and `{wo} ∩ {vo} = ∅` tripped
the guard — so the teacher's **Type-of-education** dropdown showed *all four* sectors and every
track. Every individual restriction was narrower than the whole, yet the result was wider. (Countries
looked fine only because `NL` was in both sides.) Intersection also can't express the real need: a
teacher who should have **more** than the instance (e.g. instance = NL only, teacher = NL + BE as the
country catalogue grows).

Two goals:
1. Replace intersect with an **override** model — a teacher inherits the instance, or (once given
   *custom access*) replaces it entirely with their own selection.
2. Add the missing **instance-level Domains / profielen** axis, the analog of instance
   countries/sectors (P9 only shipped a per-teacher domain axis in P10.3).

## The model (single source of truth)

Per axis (country / sector / domain), for the context editor:

| user | effective set |
| --- | --- |
| admin | instance-enabled set (or full catalogue if unset) |
| teacher, **not** activated | instance-enabled set (or full catalogue if unset) |
| teacher, **activated** | their own per-axis selection if non-empty, **else full catalogue** — instance ignored |

No intersection anywhere; the empty-intersection footgun disappears. "Empty axis = all" is the
*intended* default for an activated teacher. Instance country/sector keep their write-side lockout
(admin may not empty them); domains default to `null = all` (no lockout — optional, and only vo/hbo
have catalogues).

## Locked decisions (user-confirmed)

1. **Override, not intersect.** A per-teacher selection replaces the instance entirely; empty
   inherits.
2. **Activation is a whole-teacher gate**, needing a persisted flag — an activated-but-empty teacher
   (all axes unrestricted, ignoring the instance) must differ from an unactivated one.
3. **Activated ⇒ inherits nothing from the instance.** The instance is ignored for that teacher; each
   empty axis means "all", never the instance set.
4. **Deactivating is non-destructive.** Composition is `activated ? teacherSet : instanceSet`, so the
   admin action flips the flag off only — saved selections are preserved and return on re-activation.
5. **Add an instance Domains axis** (`enabledDomains`), mirroring instance countries/sectors.
6. **No migration.** Every key lives in `instance_settings` (instance lists + per-teacher assignments
   + the activation flag), per the P8/P9/P10 storage pattern.

## 12.1 — Override composition + activation flag

- **Repo:** `getUserContextCustomAccess`/`setUserContextCustomAccess` (`users.server.ts`) via the
  existing `getAssignedList`/`setAssignedList` on key `contextCustomAccess:<userId>` (present = on).
  Deactivating deletes the key only; assignments untouched.
- **Compose:** `availability.server.ts` — drop `composeAvailable`; add `resolveAxis` (filter a single
  selection against the catalogue; empty selection = all; a selection that filters everything away →
  catalogue + warn) and `axisSelection` (activated teacher → own set, else instance; the `&&`
  short-circuit keeps admins off the per-teacher getters). Rewrite `getAvailableCountries`/`Sectors`.
- **Test plan (RED):** `tests/lib/context-availability.test.ts` — disjoint no longer widens; activated
  teacher overrides beyond the instance; activated + empty = all; **non-destructive deactivate**
  (own set → flag off → instance → flag on → own set restored); admin follows instance and the
  per-teacher getters are never called. `tests/api/users-repo.test.ts` — flag round-trip.
  `tests/api/context-availability-integration.test.ts` — same, real storage.

## 12.2 — Instance Domains axis

- **Repo:** `getEnabledDomains`/`setEnabledDomains` (`settings.server.ts`), key `enabledDomains`,
  `null = all`.
- **Compose:** `getAvailableDomainSlugs(user)` — the flat effective set (`axisSelection` over
  instance-domains vs teacher-domains; `null = all`) for the editor loader. `getAvailableDomains`
  layers the `(sector, track)` catalogue on top (empty catalogue → `[]`, no lockout).
- **Test plan (RED):** `tests/api/settings-repo.test.ts` round-trip; `context-availability.test.ts`
  instance/override domain resolution + the flat-set helper; integration domain tests now **activate**
  the teacher (the new precondition for an override).

## 12.3 — Admin UI: instance Domains + Activate toggle

- **`app/routes/admin.context.tsx`:**
  - Loader returns `enabledDomains`, a shared `domainCatalogueSectors` (vo + hbo groups) and
    per-teacher `customAccess`. Per-teacher domain checkboxes iterate the **full** catalogue (custom
    access ignores the instance), not the teacher's reachable sectors.
  - Instance form gains a **Domains / profielen** section (reuses the grouped `DomainAxis`,
    `idPrefix="instance"`). Country/sector keep the no-empty lockout; domains may be empty (= all).
  - Each teacher is a client `TeacherAccessForm` with an **Activate custom access** checkbox; off →
    axis controls disabled + an "inherits the instance" note.
  - Action: `intent="instance"` also `setEnabledDomains`. `intent="teacher"` — `customAccess` off →
    `setUserContextCustomAccess(id,false)` **only** (assignments preserved); on → set flag + persist
    all three axes (empty → `null`).
- **i18n:** `instanceDomainsLegend`, `instanceDomainsHint`, `activateLabel`, `inheritsNote` (NL/EN);
  refreshed `teacherPick`/`teacherHint`/`domainsHint` for the override semantics.
- **Test plan (RED):** `tests/components/admin-context.test.tsx` (instance Domains render, activate
  toggle checked-states, disable→enable on activate, axe zero-violations); `tests/api/admin-routes.test.ts`
  (instance domains persist + clear; activation round-trip; **non-destructive deactivate**).

## 12.4 — Editor wiring + docs

- **`app/routes/context-profiles.tsx`:** the loader passes the **effective** domain allow-list
  (`getAvailableDomainSlugs`) as `availableDomains`, not the raw per-teacher assignment; the
  `DomainSelect available` prop already filters (`null = all`). Save re-validation already routes
  through `getAvailableDomains`.
- **Test plan (RED):** `tests/api/context-profiles-route.test.ts` — loader passes the effective set;
  save rejects an out-of-set domain.
- **Docs:** header comments (`availability.server.ts`, `admin.context.tsx`); `AGENTS.md` Access &
  Availability; this brief + the backfilled P11 brief + README rows; wiki (`Context-Model.md`) and
  end-user help (`content/help/topics/context-profiles.{nl,en}.md`); the availability memory note.

## Out of scope

- No per-country domain axis (domains stay NL-only, vo/hbo catalogues; mbo/wo custom fields unchanged).
- No change to student/cohort provisioning, model availability, or the stream/tool gates (those keep
  the intersect model — override is context-editor-only).
- No new DB columns or migrations.
- No prompt/tool-content changes.

## Acceptance — ✅ shipped (`p12-context-override-instance-domains`)

`npm test && npm run typecheck && npm run check` green after each sub-phase. Manual repro: instance
sectors `{wo}`; Test Docent activated + sectors `{vo}` → editor shows **only vo** (was: all four);
deactivate → shows `{wo}` (inherits); re-activate → `{vo}` restored (non-destructive). Instance
**Domains / profielen** restricted → an unactivated teacher's editor offers only those; an activated
teacher offers their own (or all).
