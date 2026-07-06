# Phase 9 — Admin & per-teacher country/sector availability (write UI)

> **How to run this brief:** open it in a fresh session and implement it exactly, test-first per
> `AGENTS.md` / the `/tdd` skill. Do the internal phases in order (9.1 → 9.4); gate each with
> `npm test && npm run typecheck && npm run check` before moving on. **Depends on** P8 (the
> read/compose availability seam, shipped on branch `p8-teaching-context`) + P4 (the admin
> console). This adds only the **write side** on top of P8's seam — no engine, editor, or
> compose-seam rework.

## Context & goal

P8 shipped the **read/compose** half of country/sector availability and enforces it server-side
(the context-profiles loader offers only available options; the action refuses a disabled or
unassigned save). Until an admin *writes* any settings, everything is available — non-breaking.
P9 adds the missing **write UI**, mirroring P4 exactly: an admin console page that toggles which
**countries** and **sectors** the instance offers, plus a per-teacher **assignment** surface that
narrows an individual teacher. When those are set, P8's already-shipped enforcement takes effect
with zero further engine work.

**As-built storage (verify against the code — this is the #1 gotcha):** P8 forbade a DB
migration, and this repo builds its schema from **real drizzle migration files** (`app/server/db.server.ts`
runs `migrate()` on connect), so per-teacher assignment is **NOT** a `users` column. P8 stored
everything in the existing `instance_settings` key/value table:

- **Instance:** JSON keys `enabledCountries` / `enabledSectors` (read by `getEnabledCountries()` /
  `getEnabledSectors()` in `settings.server.ts` via the private `getInstanceList(key)` helper;
  `string[] | null`, null = all — mirrors `enabledModels`).
- **Per-teacher:** JSON keys `assignedCountries:<userId>` / `assignedSectors:<userId>` (read by
  `getUserAssignedCountries(id)` / `getUserAssignedSectors(id)` in `users.server.ts` via the private
  `getAssignedList(prefix, userId)` helper; `Set<string> | null`, null/empty = unrestricted).

**P9's setters write those same keys.** Do **not** add columns or a migration.

**Locked decisions (fixed constraints — do not relitigate):**
1. **Mirror P4's admin write patterns** — `admin.models.tsx` is the exact analog for the
   instance-level toggle page (checkbox fieldset + lockout guard + `aria-live` "saved" feedback,
   every loader/action re-checks `requireRole(request, "admin")`).
2. **Per-teacher assignment is a management flow, not an invite-time field.** Because storage is
   keyed by `userId`, and a userId doesn't exist until an invite is redeemed, P9 assigns
   country/sector to **existing teachers** (an admin picks a teacher and edits their assignment →
   writes `assigned*:<userId>`). Invite-time assignment (parity with the P4 tool allow-list) is an
   **optional** extension (see 9.4) and is off the critical path.
3. **Catalogues are the source of truth for the checkboxes** — iterate `COUNTRIES` +
   `COUNTRY_LABELS` (`countries.ts`) and `SECTORS` + `SECTORS_INFO[s].label` (`sectors.ts`). Today
   `COUNTRIES = ["NL"]` (a single, always-on country — the country fieldset renders but is trivial)
   and `SECTORS = ["vo","mbo","hbo","wo"]` (po not shipped).
4. **Instance-level empty selection → lockout refuse** (like `admin.models.tsx`): an admin may not
   disable every sector/country. **Per-teacher empty → clear the assignment** (unrestricted); empty
   is a legitimate "remove restriction", not a lockout.
5. **No engine / editor / compose-seam changes.** `getAvailableCountries/Sectors`, `format.ts`,
   `ContextProfileEditor`, `parseForm.ts`, `api.stream.tsx` are all untouched — P9 only adds
   setters + admin UI + i18n + tests.

## Constraints

- **AGENTS.md gates, no exceptions:** `npm test && npm run typecheck && npm run check` green at the
  end of every internal phase. TDD **red-first**. Every new/changed interactive component ships a
  **vitest-axe zero-violations** test. Every displayed string **bilingual** (parity via
  `tests/i18n.test.ts`).
- **No DB migration.** Setters write `instance_settings` JSON keys only (the P8 storage). Additive.
- **Security boundary:** every admin loader/action re-checks `requireRole(request, "admin")`
  (loaders run in parallel; a nested one must not assume the layout ran first). Validate every
  submitted country/sector against the shipped catalogue before writing (never trust the body).
  Per-teacher writes are keyed by a `userId` that must resolve to a **teacher** account.
- **No gold-plating:** respect Out of scope. Do not touch the P8 editor/engine, do not add invite
  columns, do not gate individual NLQF levels (levels follow from the sector — a P8 decision).

## Target

**New repo setters (write side).**
- `settings.server.ts` — `setEnabledCountries(ids: string[] | null)` and `setEnabledSectors(...)`.
  Mirror `setEnabledModels` exactly: `null` deletes the `instance_settings` key (back to "all"); a
  list upserts `JSON.stringify(list)`. Add a private `setInstanceList(key, ids)` if it de-duplicates
  cleanly with `setEnabledModels` (optional refactor — keep `setEnabledModels`'s behaviour identical).
- `users.server.ts` — `setUserAssignedCountries(userId, ids: string[] | null)` and
  `setUserAssignedSectors(...)`. Mirror the P8 `getAssignedList` storage: write/delete the
  `assignedCountries:<userId>` / `assignedSectors:<userId>` key. `null` or `[]` deletes the key
  (unrestricted); a non-empty list upserts it. Add a private `setAssignedList(prefix, userId, ids)`.

**New admin page `app/routes/admin.context.tsx`** (clone `admin.models.tsx`'s shape):
- `loader` — `requireRole("admin")`; read `getEnabledCountries/Sectors()`; build country + sector
  rows from the catalogues with `checked = enabled === null || enabled.includes(id)`; also list
  **teachers** (`listUsers()` filtered to `role === "teacher"`) with each one's current
  `getUserAssignedCountries/Sectors(id)` so the per-teacher block can pre-check.
- `action` — `requireRole("admin")`; branch on an `intent` hidden field:
  - `intent="instance"` → parse `countries[]` + `sectors[]` (filtered to the catalogue); **lockout
    guard**: refuse if either resolves to empty (`{ error: "instance-empty" }`); else
    `setEnabledCountries/Sectors(selected)` and `{ saved: true }`.
  - `intent="teacher"` → read `userId` (must be an existing teacher — 404/refuse otherwise), parse
    that teacher's `countries[]` + `sectors[]` (catalogue-filtered), and
    `setUserAssignedCountries/Sectors(userId, selected.length ? selected : null)`; `{ saved: true }`.
- Component — two fieldsets (Countries, Sectors) for the instance toggle in one `<Form>`, and a
  per-teacher block: pick a teacher (a `<select>` of teachers, or a small list), then two catcheckbox
  fieldsets pre-checked from that teacher's assignment, submitted with a hidden `userId` + `intent`.
  Reuse `admin.models.tsx`'s `aria-live` "saved" line and `role="alert"` error line verbatim.

**Wire the console nav** — add `{ to: "/admin/context", end: false, key: "context", Icon: <pick a
lucide icon, e.g. GraduationCap/Building2> }` to the `SECTIONS` array in `admin.tsx`, and a matching
`admin._index.tsx` card/description if that page enumerates sections.

**i18n** (`messages/{nl,en}.ts`, keep parity) — add `admin.console.nav.context`, an
`admin.console.descriptions.context` (if `admin._index` uses one), and an `admin.context.*` block:
`heading`, `intro`, `countriesLegend`, `sectorsLegend`, `teacherLegend`, `teacherPick`, `save`,
`atLeastOne` (lockout message), plus a per-teacher "none = unrestricted" help string. Reuse
`admin.console.saved`. Resolve country labels via `COUNTRY_LABELS`, sector labels via
`SECTORS_INFO[s].label` — do **not** hard-code sector names in the messages catalogue.

## Features (each internal phase ends green)

- **9.1 Repo setters.** `setEnabledCountries/Sectors` (settings) + `setUserAssignedCountries/Sectors`
  (users), writing the P8 `instance_settings` keys. RED: extend `tests/api/settings-repo.test.ts`
  (round-trip: set → get returns the list; set `null`/`[]` → get returns null) and
  `tests/api/users-repo.test.ts` (per-teacher round-trip + clear).
- **9.2 Instance admin page.** `admin.context.tsx` instance toggle (country + sector fieldsets,
  lockout guard, saved feedback) + nav wiring + `admin.context` i18n. RED: new
  `tests/components/admin-context.test.tsx` mirroring `admin-models.test.tsx` (renders both
  fieldsets, checks defaults-all, axe zero-violations) + a loader/action test mirroring the P4 admin
  route tests (empty instance selection refused; a valid save persists via the real setter, then
  `getEnabledSectors` reflects it).
- **9.3 Per-teacher assignment.** Extend `admin.context.tsx` with the teacher-assignment block +
  action branch. RED: extend the admin-context tests — assigning a subset narrows that teacher and
  `getUserAssignedSectors(id)` returns it; submitting an empty set clears it (returns null); a
  non-teacher `userId` is refused. Optionally, replace the P8 `context-availability.test.ts` getter
  **mocks** with a real storage-backed round-trip now that setters exist (or add a sibling
  integration test) — asserting `getAvailableSectors(teacher)` reflects a written instance + teacher
  narrowing end-to-end.
- **9.4 (optional) Invite-time assignment.** Only if wanted: let an admin minting a **teacher**
  invite pre-set assigned countries/sectors, stored as pending `instance_settings` keys
  `assignedCountries:invite:<token>` and copied to `assigned*:<userId>` when the invite is consumed
  (hook in the redeem flow, mirroring how `allowedToolSlugs` copies from invite → user). If skipped,
  say so in the PR and leave it as a follow-up — the management flow (9.3) already delivers the value.

## Test plan (red-first, file by file)

- **9.1** — extend `tests/api/settings-repo.test.ts` (enabledCountries/Sectors round-trip + null
  clear, mirroring the `enabledModels` block) and `tests/api/users-repo.test.ts`
  (assignedCountries/Sectors round-trip + `[]`/null clear).
- **9.2–9.3** — new `tests/components/admin-context.test.tsx` (mirror `admin-models.test.tsx`:
  fieldsets render, defaults check all, **axe** zero-violations) + a route loader/action test
  (mirror `tests/api/admin-*` — the in-memory DB pattern with `requireRole` stubbed): instance-empty
  refused; instance save persists; teacher subset narrows + empty clears; non-teacher userId refused.
- **i18n** — parity is enforced automatically by `tests/i18n.test.ts` once the new keys exist in both
  locales.

## Acceptance criteria

- [ ] An admin can enable/disable **countries** and **sectors** for the instance from a console page;
      an empty selection is refused (lockout guard); the page shows a "saved" confirmation.
- [ ] An admin can **assign** a subset of countries/sectors to an individual teacher, and **clear**
      it back to unrestricted; a non-teacher target is refused; writes are catalogue-validated.
- [ ] Settings persist in `instance_settings` (**no migration, no new column**); P8's read getters
      (`getEnabled*`, `getUserAssigned*`) reflect them, and the P8 compose seam +
      context-profiles enforcement narrow the editor accordingly — **with no P8 code changed**.
- [ ] `admin.context` is reachable from the console nav, `requireRole("admin")` on every
      loader/action, bilingual (parity green), axe-clean.
- [ ] All gates green (`npm test && npm run typecheck && npm run check`).

## Out of scope

- Any change to the P8 engine/editor/compose seam (`format.ts`, `derive.ts`, `ContextProfileEditor`,
  `parseForm.ts`, `availability.server.ts`, `api.stream.tsx`).
- **DB schema/column migration** — `instance_settings` k/v makes it unnecessary.
- **Gating individual NLQF levels** (levels follow from the sector — P8 decision).
- **Per-country-scoped sectors** — the model is flat `countries[]` × `sectors[]` (P8 decision).
- **Verified po/vo/mbo pack content** and the **prompt-file learner-noun sweep** (separate P8 backlog
  items).
- Invite-time per-teacher assignment (9.4) unless explicitly wanted — the management flow suffices.

## Key files

- Setters: `app/server/repositories/settings.server.ts` (+`setEnabledCountries/Sectors`);
  `app/server/repositories/users.server.ts` (+`setUserAssignedCountries/Sectors`).
- UI: **new** `app/routes/admin.context.tsx`; `app/routes/admin.tsx` (nav `SECTIONS`);
  `app/routes/admin._index.tsx` (section card, if enumerated).
- i18n: `app/lib/i18n/messages/{nl,en}.ts` (`admin.context.*` + `console.nav.context`).
- Reference/mirror (do not change): `app/routes/admin.models.tsx` (exact page pattern),
  `tests/components/admin-models.test.tsx`, `tests/api/settings-repo.test.ts`,
  `app/lib/context/{countries.ts,sectors.ts}` (catalogues), `app/server/availability.server.ts`
  (the seam these settings feed — read only).

## To verify at build time (do NOT assume)

- The **exact P8 storage keys + helper names** (`getInstanceList`, `getAssignedList`, and the
  `enabledCountries` / `assignedCountries:<userId>` key strings) — read `settings.server.ts` +
  `users.server.ts` and mirror them precisely; a typo'd key silently reads as "unset".
- Whether `admin._index.tsx` enumerates sections with descriptions (add a `context` entry to match).
- The lucide icon set already imported in `admin.tsx` (pick an available/idiomatic icon).
- Whether the P8 `tests/lib/context-availability.test.ts` should keep its getter **mocks** or be
  upgraded to a real storage round-trip now that setters exist (either is fine — decide and note it).

## Verification (end-to-end, manual)

`npm run dev` → as an **admin**, open `/admin/context`: uncheck a sector (e.g. `wo`) and save →
confirm it persists on reload. Then as a **teacher**, open **Onderwijscontext → Nieuw contextprofiel**
→ the Onderwijstype picker no longer offers that sector's tracks, and a hand-crafted POST for it is
refused (the P8 action). Assign a single sector to one teacher, log in as that teacher, and confirm
the picker is narrowed to it. Re-enable everything and confirm the default-open behaviour returns.
