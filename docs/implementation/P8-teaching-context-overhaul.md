# Phase 8 — Teaching-context overhaul (country · sector · NLQF level · domain · framework)

> **How to run this brief:** open it in a fresh session and implement it exactly, test-first per
> `AGENTS.md` / the `/tdd` skill. Do the internal phases in order (8.1 → 8.8); gate each with
> `npm test && npm run typecheck && npm run check` before moving on. **Depends on** P4 (availability
> infrastructure) + P6 (cohorts). The admin + per-teacher availability **write UI** is a separate
> **P9** (stubbed at the end) — do not build it here.

## Context & goal

The **teaching context** (context profile) page has two entry points that drifted apart: a create-only
`ContextWizard` — the broken half; it can't edit a profile and skips pre-filling `professionalContext`
/ `tools` / `customFields` — and a create+edit `ContextForm`, chosen from a "wizard vs form" screen.
Beneath the UI drift, the whole model is **hbo-shaped**: `HboDomain`, `studyYear: 1|2|3|4`, and all 8
verified domain packs are hbo frameworks (hbo-i, HBO Engineering, CanMEDS…). The owner wants the
teaching context **ready for the full Dutch ladder** — basisonderwijs (po) · vmbo in all its leerwegen
· havo/vwo · mbo · hbo · wo — with any NLQF level, one clear editor, and the right
level/register/learner-noun flowing into every tool.

**Locked decisions (fixed constraints — do not relitigate):**
1. **Consolidate** the wizard + form into **one edit-capable, stepped component**; drop the choose screen.
2. **Level model = store the national (NLQF) level, derive EQF.** NLQF is the stored source of truth;
   the engine keeps injecting only the derived **EQF number + the existing neutral directive** (stays
   country-neutral). **No ISCED.**
3. **Frameworks = ship the structure now, phase the content.** Build the
   country→sector→level→domain→framework seam and expose the full range now; keep verified packs
   **hbo-only**; everywhere else fall back to the level directive + custom fields — **never invent a
   framework**. Author po (SLO kerndoelen) / vo (vmbo examenprogramma's & profielen, havo/vwo) / mbo
   (SBB kwalificatiedossiers) verified packs in a **later** content phase.
4. **Introduce `sector`** (po/vo/mbo/hbo/wo) and use it to fix the hard-coded learner-noun via an
   injected directive — **without** editing 15 prompt files now.
5. Support **basisonderwijs (po)** and **vmbo in all its forms** (bb/kb/gl/tl) plus havo/vwo.
   Consequence: the subject taxonomy becomes **sector-scoped** (`DOMAINS_BY_SECTOR`), the teacher-noun
   becomes **sector-driven** (po = *leerkracht*, not *docent*), and **po carries no NLQF level**
   (primary education yields no qualification) — it uses a young-learner register directive.
6. **Country + sector availability is admin-controllable *and* per-teacher-assignable**, reusing P4's
   instance-settings + `availability.server.ts` pattern (default-open; **no DB migration** — the
   `instance_settings` table is key/value JSON). **Individual levels are NOT gated** (over-granular;
   levels follow from the enabled sector). **P8 ships the read/compose SEAM + server enforcement +
   default-open** (the editor reads it); the **admin toggles + per-teacher assignment WRITE UI are
   deferred to a separate P9.** A teacher can be assigned **multiple countries and multiple sectors**
   (flat `countries[]` × `sectors[]`, not per-country-scoped sectors).

**NLQF facts (verified against nlqf.nl — do not re-derive):**
- NLQF = **Instroomniveau + levels 1–8**, coupled 1:1 to EQF (NLQF *n* → EQF *n*), officially linked
  since 2012. There is also an **NLQF "4+"** rung (derives EQF 4, "formeel onderwijs").
- The **Instroomniveau is genuinely below EQF 1 and cannot be coupled to EQF**; mapping it to EQF 1 for
  injection is a **documented engine approximation** paired with a neutral "entry-level" note.
- **NLQF/EQF does not classify basisonderwijs** (primary education is pre-qualification).
- Cite the level framework as `https://nlqf.nl` (levels "waaier":
  `https://nlqf.nl/impact-nlqf/nlqf-niveaus-waaier/`). **Verify the exact deep-link at build time.**

## Constraints

- **AGENTS.md gates, no exceptions:** `npm test && npm run typecheck && npm run check` green at the end
  of every internal phase. TDD **red-first**. Every new/changed interactive component ships a
  **vitest-axe zero-violations** test. Every displayed string **bilingual** (parity via types +
  `tests/i18n.test.ts`).
- **Tools-as-data / deep modules:** capability grows by adding registry/catalogue entries, never
  per-sector `if` branches in the engine. The prompt engine stays **country- and level-neutral** — the
  only level signal injected is the derived **EQF number** + neutral directive.
- **Never invent a framework.** Pack fields are lifted verbatim from an authoritative national
  framework with a `source`/`sourceUrl`. No verified pack → custom-fields fallback, no fabrication.
- **No DB migration.** Profiles are JSON in `context_profiles.dataJson`; availability settings are
  JSON keys in the existing `instance_settings` key/value table; per-teacher assignment mirrors the
  existing per-teacher tool allow-list storage. All additive.
- **Security boundary:** validate all new inputs in `parseContextForm`; enforce availability
  server-side (loader + action), never trust the client.
- **No gold-plating:** respect Out of scope. Admin/assignment WRITE UI (P9), verified po/vo/mbo pack
  *content*, and the prompt-file literal sweep are deferred.

## Target model

**New profile fields** (all optional; `app/lib/context/types.ts`):
- `country?: CountryCode` — `COUNTRIES = ["NL"]` (seam only today).
- `sector?: Sector` — `SECTORS = ["po","vo","mbo","hbo","wo"]`.
- `track?: string` — sector-scoped school-type/leerweg (see catalogue); most meaningful for vo.
- `nationalLevel?: NlqfLevel` — `"instroom" | "1".."8"` (**+ "4+" — confirm**). **Source of truth for
  level.** Optional/absent for `po`.
- `learnerNounOverride?: string` — mbo studenten↔deelnemers.
- `pedagogy?: string` — optional free-text **onderwijsconcept / didactische aanpak** (Montessori,
  Dalton, Vrijeschool, Jenaplan…). Injected verbatim like `professionalContext`. **Deliberately NOT a
  catalogued enum** (pedagogical philosophy, not a qualification/subject framework; open-ended; no
  authoritative descriptor set — see Out of scope).
- `eqf?: EqfLevel` — **deprecated as input**; retained for the cohort synthetic `{ eqf }` profile and
  legacy/fallback deserialization. The new form no longer collects it.
- `studyYear?: 1|2|3|4` — **kept, hbo-only, demoted** to pack-level prefill; not generalized now.
- `HboDomain` stays the **hbo** domain subset; `domain` is a string slug validated against the sector's
  catalogue.

**New catalogue/seam files** under `app/lib/context/` (pure data):
- `countries.ts` — `COUNTRIES`, `CountryCode`, `COUNTRY_LABELS`.
- `sectors.ts` — `SECTORS`, `Sector`, `SECTORS_INFO` (`label`; `learnerNoun`: po/vo→*leerlingen*,
  mbo→*studenten* [+ `learnerNounAlternatives` *deelnemers*], hbo/wo→*studenten*; **`teacherNoun`:
  po→*leerkracht*, else *docent***); `TRACKS_BY_SECTOR` (vo: `vmbo-bb, vmbo-kb, vmbo-gl,
  vmbo-tl (mavo), havo, vwo`; po: `regulier` [sbo/so later]; mbo: `entree, mbo-2, mbo-3, mbo-4`; hbo:
  `ad, bachelor, master`; wo: `bachelor, master, phd` — each with optional `defaultNationalLevel`);
  `learnerNounFor(sector, override, lang)`, `teacherNounFor(sector, lang)`.
- `nlqf.ts` — NLQF national-framework pack: `NLQF_LEVELS` (bilingual anchors, reuse those in `eqf.ts`),
  `NLQF_SOURCE` + `NLQF_SOURCE_URL`, `nlqfToEqf(level) → {eqf, entryLevel}`. `eqf.ts` stays the spine.
- `domains.ts` — `DOMAINS_BY_SECTOR`: hbo = `HBO_DOMAINS`; **po = SLO leergebieden** (indicative —
  verify); **vo = vmbo profielen + core vakken** (indicative — verify); mbo later.
  `getDomainsForSector(country, sector)`.
- `derive.ts` — `resolveLevel(profile) → {eqf, entryLevel} | undefined`: prefers `nationalLevel` (via
  `nlqfToEqf`), **falls back to `profile.eqf`** (keeps the cohort `{eqf}` path + legacy profiles
  working), else undefined.
- `frameworks.ts` — `resolveFramework(country, sector, domain)` backed by
  `FRAMEWORK_REGISTRY = { NL: { hbo: DOMAIN_PACKS } }` (po/vo/mbo/wo absent today → graceful no-pack
  fallback; later packs slot in as data). `getDomainPack`/`getPackField` stay (hbo-internal).

**Availability (compose seam — P8 read side; write side is P9).** Mirror P4 exactly:
- **Storage (no migration):** two new JSON keys in the existing `instance_settings` table —
  `enabledCountries`, `enabledSectors` (absent = all, per P4's `enabledModels` convention). Per-teacher
  assignment (`assignedCountries`, `assignedSectors`, each `string[]`) mirrors the **existing
  per-teacher tool allow-list** storage (`getUserToolAllowlist`/`setUserToolAllowlist` in
  `users.server.ts`) — absent = all.
- **Repo (P8 = read getters):** in `settings.server.ts`, `getEnabledCountries()/getEnabledSectors()`
  (mirror `getEnabledModels`); in the users repo, `getUserAssignedCountries(id)/getUserAssignedSectors(id)`
  (mirror `getUserToolAllowlist`). The **setters + admin/invite UI are P9.**
- **Compose seam (P8):** in `availability.server.ts`, `getAvailableCountries(user)` and
  `getAvailableSectors(user)` = shipped catalogue ∩ instance-enabled ∩ per-teacher-assigned, each layer
  default-open, with a **lockout fallback** (empty intersection → full catalogue, like
  `getSelectableModelIds`). Admins get instance-enabled (or all); students N/A (no editor — they get
  their sector/level via the P6 cohort profile). Until P9 writes any settings, these return everything
  → non-breaking.
- **Enforcement (P8):** the context-profiles **loader** passes `getAvailableCountries/Sectors(user)`
  into the editor (option lists); the **action** re-validates the submitted `country`/`sector` against
  them (a hand-crafted POST for a disabled/unassigned sector is refused) — mirroring the tool
  loader-404 / stream-refuse seam. `api.stream.tsx` unchanged.

**Engine changes** (surgical; output stays EQF-based + country-neutral) — `app/lib/context/format.ts`:
- Replace `if (profile.eqf)` with `const lvl = resolveLevel(profile)`; inject `EQF ${lvl.eqf}` +
  existing `LEVEL_DIRECTIVE`/`LEVEL_DIRECTIVE_DIRECT`; when `lvl.entryLevel`, append one neutral
  entry-level note. **When `resolveLevel` is undefined but `sector` is set (po), inject a
  sector-appropriate register directive** (po → young-learner register) instead of an EQF line.
- Add a **learner-noun + teacher-noun directive** (both audiences), driven by `sector`. No national
  term ("NLQF"/"Instroom") ever leaks into the prompt.
- Repoint the domain-pack block from `getDomainPack` to `resolveFramework(country, sector, domain)`.
- Inject `pedagogy` verbatim as a didactic-approach line when set (mirrors `professionalContext`).
- `buildSystemPrompt.ts` and `api.stream.tsx`: **no change** — the EQF-only cohort synthetic
  `{ eqf: cohort.contextEqf }` keeps working through `resolveLevel`'s fallback. **Zero blast radius on
  the cohort/injection path.**

**Consolidated UI** — new `app/components/context/ContextProfileEditor.tsx` (delete `ContextWizard.tsx`
+ `ContextForm.tsx`): one `<Form method="post">`, inactive steps `hidden` (values persist + submit
together), edit-capable via `profile?` (hidden `id` + `intent="update"`). "Extremely clear" UX: a single
**grouped "Onderwijstype" picker** (optgroup per available sector) that sets `sector` + `track` and
prefills the NLQF level; an explicit **NLQF level select** remains (prefilled, overridable, cited
`NLQF_SOURCE` link + read-only derived-EQF preview). Steps:
1. **Basis** — `NameField`, `CountrySelect` (**hidden when ≤1 country available**),
   `OnderwijstypeSelect` (options from `getAvailableSectors(user)`), `ProgrammeField`, `CourseField`.
2. **Niveau & kader** — `NationalLevelSelect` (hidden/"n.v.t." for po) + derived-EQF preview + NLQF
   source, `DomainSelect` (sector-scoped via `getDomainsForSector`), `DomainFields` (sector-aware via
   `resolveFramework`), `StudyYearField` (hbo only).
3. **Context & eigen velden** — `ProfessionalContextField`, `ToolsField`, `PedagogyField` (new;
   optional free-text onderwijsconcept), `LearnerNounField` (mbo-only override), `CustomFieldsEditor`.
4. **Afronden** — recap (extend `buildSummary`: sector/track/national level/derived EQF) + `makeDefault`.

Reused **unchanged** from `ContextFields.tsx`: `NameField`, `ProgrammeField`, `CourseField`,
`StudyYearField`, `ProfessionalContextField`, `ToolsField`, `CustomFieldsEditor`. **Changed:**
`DomainSelect` (options from `getDomainsForSector`), `DomainFields` (`resolveFramework`, re-key on
`sector|domain`). **New controls:** `CountrySelect`, `OnderwijstypeSelect`, `NationalLevelSelect`
(replaces `EqfField` here — `EqfField` retained only for `cohorts.$id.tsx`), `LearnerNounField`,
`PedagogyField`.

**Route** `app/routes/context-profiles.tsx`: delete the `CreateMode` union, `mode` state, choose-screen
JSX; "Nieuw" opens the editor, "Bewerken" opens it with `profile={p}`. Loader passes available
country/sector sets; action validates them + `parseContextForm`. Add a sector badge to list cards.

## Features

- **8.1 Level model + NLQF→EQF derivation.** New fields; `countries.ts`, `nlqf.ts`, `derive.ts`; wire
  `format.ts` to `resolveLevel` + entry-level note. Engine still EQF-out.
- **8.2 Sector + track + noun directives.** `sectors.ts` (po/vo/mbo/hbo/wo, all vmbo leerwegen,
  `teacherNoun` po→leerkracht); learner+teacher-noun directive in `format.ts`; po young-learner
  register fallback; mbo override plumbing. **No prompt-file edits.**
- **8.3 Sector-scoped domains + framework seam.** `domains.ts`; `frameworks.ts`; repoint `format.ts` +
  `parseForm.ts` + `DomainSelect`/`DomainFields`.
- **8.4 Availability compose seam + enforcement (read side).** `instance_settings` keys
  `enabledCountries/Sectors` + per-teacher `assignedCountries/Sectors` **read getters**;
  `getAvailableCountries(user)/getAvailableSectors(user)` composing catalogue ∩ instance ∩ per-teacher
  (default-open, lockout fallback); enforce in the context-profiles loader (option lists) + action
  (refuse disabled/unassigned). **No admin/write UI (that's P9).** Returns everything until P9 → no
  behaviour change.
- **8.5 Consolidated editor + route.** New `ContextProfileEditor` (grouped Onderwijstype UX,
  country hidden when ≤1, edit-capable, 4 steps, axe); delete wizard/form; simplify route.
- **8.6 Parse/validate.** Extend `parseContextForm`: `country`/`sector` (validated against the
  available sets), `track` (per sector), `nationalLevel` (instroom/1–8[/4+]; absent for po),
  `learnerNounOverride` (mbo set), `pedagogy` (length-capped), `domain` gated by `getDomainsForSector`,
  pack values gated by `resolveFramework`; stop requiring `eqf`.
- **8.7 Read-time migration.** Extend `migrateLegacy` (pure, unit-testable backfill): `country ??= "NL"`;
  `sector ??= "hbo"`; `nationalLevel ??= String(eqf)` when `eqf` set (don't invent "instroom"); keep
  `eqf`; idempotent. **Cohorts stay EQF-native — no cohort migration.**
- **8.8 Help + docs.** Rewrite `context-profiles.{nl,en}.md` (bilingual, keep an H1): country→sector
  (+track)→level first choice; NLQF is source of truth, EQF derived, only EQF number + neutral
  directive reach the prompt; po has no NLQF level; frameworks sector-scoped (hbo cited packs; po/vo/mbo
  fall back); learner-noun via sector (po=leerlingen/leerkracht). Bilingual inline per-step help. Update
  `wiki/Context-Model.md` + `Qualification-Frameworks.md` (add po/vo; note ISCED not adopted).

## P9 (separate session — deferred) — Admin & per-teacher country/sector availability UI

Adds the **write side** on top of P8's seam (mirrors P4's `admin.tools.tsx`/`admin.models.tsx` + the
per-teacher tool allow-list): setters `setEnabledCountries/Sectors` + `setUserAssignedCountries/Sectors`;
an `admin.context.tsx` console page (two checkbox fieldsets, `requireRole("admin")`, lockout guard,
saved feedback); per-teacher country/sector assignment surfaced in the teacher invite / management flow;
`admin.context` i18n; availability + settings-repo + admin-component tests mirroring
`tests/lib/availability.test.ts`, `tests/api/settings-repo.test.ts`, `tests/components/admin-*.test.tsx`.
No engine/editor rework — P8's compose seam already reads these. The full P9 brief is authored when P8
lands.

## Backlog (later, separate sessions)

- **Verified po/vo/mbo packs.** Pure data under `FRAMEWORK_REGISTRY[NL].po/.vo/.mbo`; seam built in
  8.3. Each is a real sourcing task (SLO kerndoelen; vmbo examenprogramma's/profielen; SBB
  kwalificatiedossiers) — never invent.
- **Prompt-file learner-noun sweep.** Replace literal "studenten"/"docent" across ~17 NL prompt files
  with a neutral placeholder / lean on the directive; **eval-gated** (`npm run eval`, needs
  `ANTHROPIC_API_KEY`). Highest behavioral-regression risk — standalone.

## Execution order (each internal phase ends green)

**8.1 → 8.2 → 8.3 → 8.4 → 8.5 → 8.6 → 8.7 → 8.8**, all in P8. New fields are optional and legacy `eqf`
still resolves, and 8.4's seam returns everything until P9, so existing component tests stay green
through 8.1–8.4 (UI rewrite lands in 8.5). Land the engine + derivation + the cohort-invariant test
**before** touching `format.ts`; then data seams; then availability seam; then UI; then validation;
then migration; then docs.

## Test plan (red-first, file by file)

- **8.1** — NEW `tests/nlqf.test.ts`; NEW `tests/derive.test.ts` (**cohort invariant**
  `resolveLevel({eqf:5})→5`); NEW migration unit test; extend `tests/context.test.ts` (nationalLevel→EQF
  + entry-level note; **no national term leaks**; legacy `eqf` fallback stays green).
- **8.2** — NEW `tests/sectors.test.ts` (`learnerNounFor`; **`teacherNounFor` po→leerkracht**); extend
  `tests/context.test.ts` (noun directive per sector, both audiences; **po young-learner directive with
  no EQF line**; no leak).
- **8.3** — NEW `tests/frameworks.test.ts` (hbo/ICT=pack; po/vo/mbo/wo/unknown=undefined); NEW
  `tests/domains.test.ts` (`getDomainsForSector` per sector, bilingual); extend `tests/context.test.ts`
  (framework block only when a pack resolves). `tests/packs.test.ts` stays green.
- **8.4** — NEW `tests/lib/context-availability.test.ts` (mirror `availability.test.ts`): defaults
  return all; instance `enabledSectors` narrows; a per-teacher `assignedSectors` narrows a teacher and
  leaves an unassigned teacher unrestricted; **multi-country + multi-sector assignment** returns the
  union set; empty intersection → lockout fallback to full catalogue. Extend the settings-repo/users-repo
  tests for the new **read getters** (null = default). Add a context-profiles loader/action test: a
  disabled sector is absent from options and refused on save.
- **8.5** — NEW `tests/components/ContextProfileEditor.test.tsx` (replaces the two deleted tests): 4-step
  flow; name-gated; grouped Onderwijstype sets sector+track; **country picker hidden with one country**;
  NLQF select hidden/"n.v.t." for po else populated with derived-EQF preview + source link; sector-scoped
  domain options; hbo/ICT pack + source; honest no-framework note for vo/mbo; mbo-only learner-noun;
  **edit-mode prefills every field**; **axe** on step 1, recap, and with a pack. Update
  `tests/components/ContextSettings.test.tsx` (no choose screen; sector badge; axe). Delete
  `ContextWizard.test.tsx` + `ContextForm.test.tsx`. Update `tests/i18n.test.ts`.
- **8.6** — Extend `tests/parseForm.test.ts` (country/sector validated against available; track;
  nationalLevel incl. po-without-level; domain gated by sector; pack gated by resolveFramework; no eqf).
- **8.8** — Update `tests/help.test.ts` (new H1 title).

## Acceptance criteria

- [ ] One edit-capable stepped editor; wizard/form/choose-screen gone; a profile with custom fields
      round-trips through **create and edit** (the old wizard could not edit).
- [ ] A teacher can build a valid profile for **po, vmbo-bb/kb/gl/tl, havo, vwo, mbo, hbo, wo** with
      **sector-scoped** domain options.
- [ ] Level is stored as **NLQF**; the injected prompt carries only the **derived EQF number** + neutral
      directive (`EQF n` for 1–8; entry-level note for Instroom; **no EQF line but a young-learner
      register directive for po**); **no "NLQF"/"Instroom"** ever appears in `{{contextProfile}}`.
- [ ] Learner + teacher noun injected from `sector` (po→leerlingen/**leerkracht**; mbo override) with
      **no prompt-file edits**.
- [ ] hbo domains resolve a **cited** verified pack; po/vo/mbo show an honest "no national framework"
      note; **nothing invented**; the NLQF level shows a cited source.
- [ ] **Availability seam** composes catalogue ∩ instance-enabled ∩ per-teacher-assigned (each
      default-open, lockout fallback); a teacher may hold **multiple countries and sectors**; the editor
      only offers available options and the action refuses a disabled/unassigned save. With no settings
      written, behaviour is unchanged (all available).
- [ ] **Cohort invariant holds** (`resolveLevel({eqf})→eqf`); `api.stream.tsx` unchanged; existing
      profiles migrate at read time to NL/hbo/national-level with no data loss.
- [ ] Help rewritten (bilingual) + inline per-step help; wiki docs updated.
- [ ] All gates green.

## Out of scope

- **Admin/assignment WRITE UI** (P9): the `admin.context.tsx` console, the setters, and the per-teacher
  assignment surface in the invite/management flow. P8 ships only the read/compose seam + enforcement.
- **Gating individual NLQF levels** (levels follow from the enabled sector).
- **Per-country-scoped sectors** — the per-teacher model is flat `countries[]` × `sectors[]`.
- **Verified pack *content*** for po/vo/mbo (later sourcing session — do not fabricate).
- The **prompt-file learner-noun literal sweep** (eval-gated, separate).
- **Onderwijsconcepten as a catalogued enum** (Montessori, Dalton, Vrijeschool, Jenaplan, Freinet…) —
  captured via the free-text `pedagogy` field, injected verbatim. (tto/tweetalig onderwijs is handled by
  the existing output-language parameter.)
- **Other countries** and **ISCED** (seam only). Generalizing `studyYear` beyond hbo; sbo/so po tracks.
- Any DB schema/column migration (JSON storage makes it unnecessary).

## Key files

- Engine/data: `app/lib/context/{types.ts, format.ts, eqf.ts, packs.ts, parseForm.ts}` + **new**
  `{countries.ts, sectors.ts, nlqf.ts, domains.ts, derive.ts, frameworks.ts}`.
- Availability: `app/server/availability.server.ts` (+`getAvailableCountries/Sectors`);
  `app/server/repositories/settings.server.ts` (+read getters); users repo (per-teacher read getters).
- Persistence/migration: `app/server/repositories/profiles.server.ts` (extend `migrateLegacy`).
- UI: `app/routes/context-profiles.tsx`; `app/components/context/ContextFields.tsx`; **new**
  `ContextProfileEditor.tsx` (deletes `ContextWizard.tsx` + `ContextForm.tsx`).
- No change: `app/lib/template/buildSystemPrompt.ts`, `app/routes/api.stream.tsx`,
  `app/server/schema.server.ts` (JSON keys only), `cohorts.$id.tsx`.
- Help/i18n/docs: `app/content/help/topics/context-profiles.{nl,en}.md`;
  `app/lib/i18n/messages/{nl,en}.ts`; `wiki/{Context-Model,Qualification-Frameworks}.md`.

## To verify at build time (do NOT invent)

- Exact `nlqf.nl` source deep-link; per-rung NLQF→qualification anchors (reuse `eqf.ts`); whether the
  **"4+"** rung is worth surfacing; **NLQF anchors for vmbo leerwegen / havo / vwo** (e.g.
  vmbo-bb≈NLQF1, vmbo-kb/gl/tl≈NLQF2, havo/vwo≈NLQF4 — confirm).
- Current **SLO leergebieden** (po) and **vmbo profielen/vakken** (vo) — list as indicative stubs,
  confirm against SLO before authoring verified content later.
- The exact storage of the **per-teacher tool allow-list** (`getUserToolAllowlist`) to mirror it for
  country/sector assignment. mbo default learner-noun (proposed *studenten*).

## Verification (end-to-end, manual)

`npm run dev` → create a profile per onderwijstype: po/basisonderwijs (no NLQF level; leerlingen +
leerkracht in the injected block), vmbo-kb (NLQF 2), havo (NLQF 4), mbo-4 (toggle studenten↔deelnemers),
hbo/NLQF 6 + ICT (hbo-i pack + source), wo/NLQF 7. Confirm the derived-EQF preview, the NLQF source
link, sector-scoped domain options, the honest "no framework" note for po/vo/mbo, and that the country
picker is hidden (single country). Edit each and confirm every field pre-fills. Spot-check the system
prompt for an hbo, an Instroom, and a po profile: EQF n + directive vs entry-level note vs young-learner
register directive, learner/teacher noun present, and **no** national-term leakage. (Availability
enforcement is exercisable once P9 writes settings; in P8 confirm the seam returns all and the action
refuses a hand-crafted disallowed sector via the loader/action test.)
