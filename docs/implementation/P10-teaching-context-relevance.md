# Phase 10 — Teaching-context form relevance, per-type domains & profielen, per-teacher domain availability

> **How to run this brief:** open it in a fresh session and implement it exactly, test-first per
> `AGENTS.md` / the `/tdd` skill. Do the internal phases in order (10.1 → 10.3); gate each with
> `npm test && npm run typecheck && npm run check` before moving on. **Depends on** P8 (the
> consolidated editor + domain/framework/level model) and P9 (the country/sector availability write
> UI this extends). Branch from `p9-context-availability-write-ui` (or `main` once P9 merges).

## Context & goal

The P8 editor (`ContextProfileEditor` + `ContextFields`, one 4-step `<Form>`) shows every field
regardless of the chosen education type, and scopes the **domain** dropdown by *sector only*. Two
consequences, both wrong for the teacher:

1. **Irrelevant fields are shown.** "Opleiding / Programme" and "Beroepspraktijk / werkveld
   (Professional field)" appear for havo/vwo, where neither concept exists (general education has no
   *opleiding* and no *beroepsveld*).
2. **The domain list is wrong for general secondary.** The `vo` domain catalogue is a flat mix of the
   **10 vmbo** beroepsgerichte profielen + 3 kernvakken, offered to the whole `vo` sector — so a
   havo/vwo teacher is shown *vmbo* profielen, while the real havo/vwo profielen (N&T / N&G / E&M /
   C&M) don't exist in the app at all. There is also **no per-teacher domain restriction** (P9 gated
   only country/sector).

**Goal:** (a) show only the fields relevant to the selected sector/track; (b) offer the correct,
**type-scoped** domains — introducing havo/vwo + vmbo profielen as verified data; (c) let an admin
**restrict domains per teacher** (P9-style), so an unavailable domain never appears in the editor.
**Brutal-honesty rule:** never invent a domain/framework. Where the Netherlands has no verified
national taxonomy (mbo domeinen — see below — and wo), keep the honest custom-fields fallback.

## Sourced facts (verified — drive the data, cite in code comments)

- **havo & vwo share the same four profielen** — Natuur & Techniek, Natuur & Gezondheid, Economie &
  Maatschappij, Cultuur & Maatschappij — chosen in the tweede fase (havo 4–5, vwo 4–6).
  Rijksoverheid (havo / vwo), SLO `sectoren/havo-vwo/profielen/`.
- **vmbo profielen (2016 reform, Besluit profielen vmbo 22-04-2016):** bb/kb/gl → 10 profielen (the
  slugs already shipped: bwi, pie, mt, mvi, mat, zw, eo, hbr, groen, dp); **tl/mavo → 4** (Techniek,
  Zorg & Welzijn, Economie, Landbouw/Groen). SLO `sectoren/vmbo/beroepsgericht/`.
- **"Programme/Opleiding" is meaningless for havo/vwo** (structure is *schooltype → profiel →
  vakken*); **"Beroepsveld/Professional field" is a vocational concept, irrelevant for havo/vwo.**
- **gymnasium/atheneum** is a vwo school-type axis orthogonal to profiel — **out of scope** (low value).
- **mbo "profiel" ≠ vo profiel** (it's the profession-specific part of a kwalificatie), and the
  "16 mbo domeinen" count is **UNVERIFIED** (terminology shifted to "hoofdgroep"). → **Do not ship an
  mbo domain catalogue.** mbo & wo stay on honest custom fields.

## Locked decisions

1. **Profielen reuse the existing domain field, track-scoped** (no new field). Domain field label is
   sector-aware: **"Profiel"** for vo, **"Domein"** for mbo/hbo/wo. Profielen have no verified pack →
   the existing honest "no national framework → custom fields" path applies (reword the note softer
   for vo so it doesn't read as a defect).
2. **Field-relevance rules (all applied):** hide **Programme** for the whole `vo` sector; hide
   **Professional field** for havo/vwo (keep for vmbo/mbo/hbo/wo); relabel **Course → "Vak"** for vo
   (label only). **Pedagogy stays everywhere** (Montessori/Dalton in vo, PGO/competentiegericht in
   mbo/hbo — broadly relevant).
3. **Per-teacher domain availability = a full P9-style axis** (user chose "admin per-teacher list").
   **Per-teacher only** — no instance-wide domain toggle (fewer knobs; add later if wanted).
4. **Never invent** mbo/wo domain catalogues or vo/mbo/wo frameworks.
5. **Hidden fields aren't submitted** → an irrelevant field is cleared on the next save; a pre-P10
   stored value survives until the profile is re-saved (acceptable, low-risk). Server also drops
   irrelevant fields defensively (see 10.1).

## Reuse (don't reinvent)

- **Conditional-render patterns already in the editor:** self-hiding component (`LearnerNounField`
  returns `null` when `learnerNounChoices(sector).length === 0`, `ContextFields.tsx:282-293`);
  sector gate (`{isHbo && <StudyYearField/>}`, `ContextProfileEditor.tsx:207`); domain-triggered
  packs (`DomainFields`, `ContextFields.tsx:368-394`); domain-clears-on-type-change
  (`ContextProfileEditor.tsx:150-155`). **Mirror these — don't add a new mechanism.**
- **P9 availability seam:** `composeAvailable<T>()` + the per-teacher `getAssignedList`/
  `setAssignedList` helpers (`users.server.ts`) and `getUserAssigned*` / `setUserAssigned*` — the
  new domain axis is a near-verbatim clone. Admin UI extends the P9 page `admin.context.tsx`.
- **How the editor already receives a server-computed availability set:** `availableCountries` is
  passed from the loader into the editor and the client filters against it — the domain axis follows
  the same shape (loader passes the teacher's flat `assignedDomains` set; the client filters the
  bundled, track-scoped catalogue).

---

## 10.1 — Field relevance (fields + labels)

**New pure helpers** — `app/lib/context/relevance.ts` (engine-neutral data; unit-tested):
- `showsProgramme(sector)` → `sector !== "vo"`.
- `showsProfessionalContext(sector, track)` → hide only for havo/vwo:
  `!(sector === "vo" && (track === "havo" || track === "vwo"))`.
- `courseLabel(sector): LocalizedText` → vo: `{nl:"Vak", en:"Subject"}`; else `{nl:"Vak", en:"Course"}`.

**Editor** — make `ProgrammeField` and `ProfessionalContextField` **self-hiding** (mirror
`LearnerNounField`): each takes `sector`/`track` and `return null` when its predicate is false. Feed
`courseLabel(sector)` into `CourseField`. Files: `app/components/context/ContextFields.tsx`,
`ContextProfileEditor.tsx` (pass `track` where needed).

**Server defense** — `parseForm.ts`: null out `programme` when `!showsProgramme(sector)` and
`professionalContext` when `!showsProfessionalContext(sector, track)`, so a hand-crafted POST can't
persist an irrelevant field. (`sector`/`track` are already parsed there.)

**i18n** — any changed/added label strings in `messages/{nl,en}.ts`, parity enforced by
`tests/i18n.test.ts`.

**Test plan (RED first):**
- `tests/lib/relevance.test.ts` — the three helpers across every sector/track.
- `tests/components/context-editor.test.tsx` (or the existing editor test) — Programme hidden for
  havo, shown for hbo; Professional field hidden for havo, shown for vmbo & hbo; Course label = "Vak"
  for vo; **axe zero-violations**.
- `tests/lib/context/parseForm.test.ts` — irrelevant fields dropped server-side.

## 10.2 — Type-scoped domain catalogue + profielen

**Data** — `app/lib/context/domains.ts`:
- Add **havo/vwo profielen**: slugs `nt, ng, em, cm` with bilingual labels (e.g. `nt →
  {nl:"Natuur & Techniek", en:"Nature & Technology"}`).
- Track-scope `vo`: `havo`/`vwo` → the 4 profielen; `vmbo-bb/kb/gl` → the existing 10; `vmbo-tl` → 4
  (techniek, zorg-welzijn, economie, groen). **Drop the 3 kernvakken** from the domain catalogue
  (the specific subject belongs in the Course/"Vak" field).
- Signature: `getDomainsForSector(country, sector)` → **`getDomainsForTrack(country, sector, track)`**
  (branch by track for `vo`; sector-level unchanged for hbo; empty for mbo/wo). Keep hbo behaviour
  byte-identical. Update callers.

**Editor** — `ContextFields.tsx` `DomainSelect`: accept `track`, call `getDomainsForTrack`; label the
field **"Profiel"** for vo, **"Domein"** for else (sector-aware label helper). Domain already clears
on any Onderwijstype change (`ContextProfileEditor.tsx:154`), which covers havo↔vmbo track switches.

**Server** — `parseForm.ts`: validate `domain` against `getDomainsForTrack(country, sector, track)`
(reject a havo POST carrying a vmbo profiel). `format.ts`: ensure the domain value injects with its
**label** (e.g. "Profiel: Natuur & Techniek") — small label lookup; keep engine locale/level-neutral.

**Back-compat** — a stored `domain` no longer in the track-scoped list (legacy flat-vo profiles):
render it as a preserved/selected option so editing doesn't silently drop it; note in `migrate.ts`
if a normalization is cheap, else leave as display-only.

**Test plan (RED first):**
- `tests/lib/context/domains.test.ts` — `getDomainsForTrack` returns the 4 profielen for havo & vwo,
  10 for vmbo-bb, 4 for vmbo-tl; hbo unchanged; mbo/wo empty; no kernvakken.
- `parseForm.test.ts` — cross-track domain rejected; valid profiel accepted.
- editor component test — havo shows the 4 profielen, label "Profiel"; hbo shows "Domein" + its 8.
- i18n parity for the new profiel labels.

## 10.3 — Per-teacher domain availability (P9-style axis)

**Storage** — `app/server/repositories/users.server.ts`: `getUserAssignedDomains(userId)` /
`setUserAssignedDomains(userId, ids|null)` reusing the existing `getAssignedList`/`setAssignedList`
helpers with prefix `assignedDomains` (`assignedDomains:<userId>` key). **No migration.** Instance-
level domains intentionally omitted.

**Compose seam** — `app/server/availability.server.ts`:
`getAvailableDomains(user, sector, track)` = `composeAvailable(getDomainsForTrack(...).map(d=>d.value),
null, teacherAssigned, "availability_no_available_domains")` where `teacherAssigned =
user.role==="teacher" ? await getUserAssignedDomains(user.id) : null`. Admin unrestricted; empty
intersection → full catalogue + warn (mirror the P9 lockout fallback).

**Editor filtering** — the loader (`context-profiles.tsx`) passes the teacher's flat
`assignedDomains: string[] | null` into the editor (as `availableCountries` is passed today);
`DomainSelect` filters `getDomainsForTrack(...)` by it client-side (`assigned===null || includes`).
No server round-trip on sector/track change.

**Server gate** — the `context-profiles.tsx` action re-validates the submitted `domain` against
`getAvailableDomains(user, sector, track)` (never trust the body), mirroring how the P9 action
re-checks country/sector.

**Admin UI** — extend the P9 per-teacher block in `app/routes/admin.context.tsx` with a **Domains**
group per teacher (submitted as `domains[]`, same `intent="teacher"` form). "Formidable & easy":
render domain checkboxes **grouped by sector** (and, for vo, by track), **only for the sectors that
teacher can actually reach** (their P9 available sectors), collapsed by default (`<details>`), pre-
checked from the assignment (null = all). Action branch: catalogue-filter `domains[]` and
`setUserAssignedDomains(userId, selected.length ? selected : null)` (empty = clear = unrestricted).

**i18n** — `admin.context.domainsLegend`, per-sector group headings resolve via existing
`SECTORS_INFO[s].label` / track labels (never hard-code), teacher domain help string.

**Test plan (RED first):**
- `tests/api/users-repo.test.ts` — assignedDomains round-trip + null/[] clear.
- `tests/api/context-availability-integration.test.ts` — `getAvailableDomains` narrows by assignment,
  admin unrestricted, track-scoped, lockout fallback.
- `tests/api/admin-routes.test.ts` — teacher `domains[]` persists + empty clears; catalogue-filtered.
- `tests/components/admin-context.test.tsx` — grouped domain checkboxes render/pre-check; **axe**.
- editor component test — a domain outside the teacher's assignment is absent from the dropdown.
- `parseForm`/action test — an unavailable domain is refused server-side.
- i18n parity.

---

## Out of scope

- Instance-wide domain enable/disable (per-teacher only for now).
- gymnasium/atheneum, praktijkonderwijs (po dropped), leerjaar/onderbouw-bovenbouw gating (profiel
  stays optional — blank in the onderbouw).
- Inventing mbo/wo domain catalogues or vo/mbo/wo frameworks (honest custom-fields fallback stays).
- Any change to the streaming engine, provider, or tool registry. `format.ts` touched **only** for
  correct domain-label injection.

## Acceptance criteria

- [ ] A teacher picking **havo/vwo** sees no Programme and no Professional field; Course reads "Vak";
      the domain field is labelled **"Profiel"** and offers exactly N&T/N&G/E&M/C&M.
- [ ] **vmbo** shows its profielen (10 for bb/kb/gl, 4 for tl) and keeps Professional field; **hbo**
      is unchanged (8 domains + verified packs, label "Domein").
- [ ] An admin can assign a **subset of domains** to a teacher (grouped, collapsible UI) and clear it
      back to unrestricted; an unavailable domain never appears in that teacher's editor and a
      hand-crafted POST for it is refused. No migration, no new column.
- [ ] Every displayed string bilingual (parity green); every changed interactive component axe-clean;
      `requireRole("admin")` on the admin loader/action.
- [ ] All gates green (`npm test && npm run typecheck && npm run check`) at the end of each phase.

## Verification (manual, end-to-end)

`npm run dev`. As a **teacher**, open **Onderwijscontext → Nieuw contextprofiel**: pick *havo* →
confirm Programme & Professional field vanish, Course = "Vak", and the "Profiel" dropdown lists the
four profielen only; switch to *hbo* → Programme/Professional field return, dropdown = the 8 domains
with packs. As an **admin**, open `/admin/context`, assign one teacher a single domain, save; log in
as that teacher → the editor's dropdown is narrowed to it; a crafted POST for a disabled domain is
refused. Re-open a legacy profile → its stored values still display.

## Key files

- **Data/helpers:** `app/lib/context/relevance.ts` (new), `domains.ts` (track-scope + profielen),
  `sectors.ts` (track constants if needed), `format.ts` (domain-label injection, minimal),
  `parseForm.ts` (relevance drop + track-aware domain validation), `migrate.ts` (legacy note).
- **UI:** `app/components/context/ContextFields.tsx`, `ContextProfileEditor.tsx`,
  `app/routes/context-profiles.tsx` (loader passes `assignedDomains`; action re-validates).
- **Availability/admin:** `app/server/repositories/users.server.ts` (+`get/setUserAssignedDomains`),
  `app/server/availability.server.ts` (+`getAvailableDomains`), `app/routes/admin.context.tsx`
  (per-teacher domain group).
- **i18n:** `app/lib/i18n/messages/{nl,en}.ts`.
- **Reference/mirror (do not rework):** `app/routes/admin.models.tsx` + the P9 `admin.context.tsx`
  (per-teacher pattern), `app/server/availability.server.ts` (`composeAvailable`), the P8 editor
  conditional patterns cited above.
