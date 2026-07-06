# Phase 11 — vo fase (onderbouw/bovenbouw) as a stage axis + profiel/studiejaar gating

> **How to run this brief:** this is a **retroactive record** of already-shipped work (commit
> `a904c2c`) written in the house format — no doc existed. RED → GREEN was already done; the Test Plan
> below lists the tests that actually pin the behaviour. To re-run cold: implement exactly as recorded,
> test-first per `AGENTS.md` / the `/tdd` skill, and gate with `npm test && npm run typecheck &&
> npm run check`. **Depends on** P8 (the consolidated editor + sector/track/domain/level model), P9
> (the availability write UI), and P10 (field-relevance predicates, type-scoped domains/profielen,
> per-teacher domain availability). Shipped on `main`.

## Context & goal

After P10 the vo sector carries a **track** (vmbo-bb/kb/gl/tl, havo, vwo) and a **profiel** reusing the
domain field. But vo has one more pedagogically decisive cut the model didn't express: the **fase**.

- A bare *leerjaar* number is ambiguous across tracks — "leerjaar 3" is still **onderbouw** for vwo but
  nearly **bovenbouw** for vmbo — so a numeric study year (`studyYear`, built for hbo/mbo) is the wrong
  instrument for vo.
- The **profiel** is a *tweede-fase* (bovenbouw) concept. In the onderbouw there is no profiel yet, so
  P10 offered the profiel dropdown for every vo track unconditionally — wrong for an onderbouw teacher.

**Goal:** give vo a first-class **fase axis** (onderbouw vs bovenbouw), gate the profiel on it
(onderbouw ⇒ no profiel; bovenbouw ⇒ profiel shown), inject the fase into the context directive, and
clean up the study-year gating that P10 left as an `isHbo` literal. Same brutal-honesty rule as P10:
the fase is *structure*, not an invented taxonomy — no framework, no pack.

## Sourced facts (verified — drive the data, cite in code comments)

- **vo splits into onderbouw and bovenbouw.** The onderbouw is the broad, foundational lower years
  (shared kerndoelen, no profiel); the bovenbouw for havo/vwo is the **tweede fase**, where a profiel
  (N&T / N&G / E&M / C&M — see P10) is chosen and the work turns exam-oriented (Rijksoverheid: bovenbouw
  havo/vwo = tweede fase; SLO: onderbouw-vo kerndoelen vs. tweede fase). vmbo likewise runs a broad
  onderbouw then a beroepsgerichte bovenbouw.
- **A stored vo profiel therefore implies bovenbouw** — a profiel cannot exist in the onderbouw. This
  drives the read-time migration backfill.
- **mbo/hbo count in study years, not fase; wo omits both** — the study-year axis is theirs, fase is
  vo-only. (P10 gated study-year on `isHbo` only; mbo legitimately carries a studiejaar too.)

## Locked decisions

1. **Fase is a new vo-only axis, not a re-use of `track` or `studyYear`.** New `phase?: "onderbouw" |
   "bovenbouw"` on `ContextProfile`, a `VO_PHASES` constant + `isVoPhase` guard in `sectors.ts`. Stored
   as a slug in the existing JSON column — **no DB migration.**
2. **The profiel is gated to vo-bovenbouw.** `showsDomain(sector, phase)` = for vo, `phase ===
   "bovenbouw"`; every other sector keeps its domain field unconditionally (mbo/wo still resolve an
   empty catalogue → honest custom fields). The editor additionally keeps the field visible whenever a
   `domain` value is already present, so opening + editing a legacy flat-vo (or hbo) profile never
   silently blanks a stored value — mirroring `DomainSelect`'s own out-of-catalogue preservation.
3. **Fase feeds the injected directive** (`format.ts`) as a `- Fase: …` / `- Phase: …` line, resolving
   the `VO_PHASES` label; engine stays locale/level-neutral (label lookup only).
4. **Study-year gating is generalized to data, not a literal.** `isHbo && <StudyYearField/>` becomes a
   self-hiding `StudyYearField` driven by `showsStudyYear(sector)` = `hbo || mbo`. vo never shows a
   study year (it has fase); wo shows neither.
5. **Server defends every axis off the wrong sector.** `parseForm` drops a fase off any non-vo sector,
   drops the profiel off vo-onderbouw, and drops a smuggled studiejaar off vo — a hand-crafted POST
   can't persist an irrelevant axis. Junk fase values are rejected via `isVoPhase`.
6. **Legacy backfill on read:** a stored vo profile that carries a profiel gets `phase = "bovenbouw"`
   backfilled (`migrate.ts`) so the fase field + gating stay coherent on read + re-save; a profiel-less
   vo profile stays fase-less (blank onderbouw is legitimate); non-vo profiles never gain a fase; an
   existing `phase` is never overwritten (idempotent).

## Reuse (don't reinvent)

- **Self-hiding field pattern** (P10 `ProgrammeField`/`ProfessionalContextField`, P8
  `LearnerNounField`): `PhaseField` and the reworked `StudyYearField` `return null` when their
  predicate is false — no new mechanism.
- **Domain-clears-on-change**: `onOnderwijstype` already clears `domain` on a sector switch; P11 adds a
  symmetric `onPhase` that clears `domain` on leaving bovenbouw, and clears `phase` when the sector
  leaves vo.
- **Relevance predicates** (P10 `relevance.ts`) are the home for the three new pure helpers
  (`showsPhase`, `showsStudyYear`, `showsDomain`), unit-tested and shared editor↔server so they can't
  drift.
- **`VO_PHASES` label resolution** reuses `loc(...)` + the `LocalizedText` house shape and the
  parenthetical-Dutch EN style of the track labels (e.g. `"havo (senior general secondary)"`).

## Implementation (as shipped)

**Data / helpers**
- `app/lib/context/sectors.ts` — `VO_PHASES` (`onderbouw`/`bovenbouw` with bilingual labels), `VoPhase`
  type, `isVoPhase(v)` guard.
- `app/lib/context/relevance.ts` — `showsPhase(sector)` (`=== "vo"`), `showsStudyYear(sector)` (`hbo ||
  mbo`), `showsDomain(sector, phase)` (vo ⇒ bovenbouw; else true).
- `app/lib/context/types.ts` — add `phase?: "onderbouw" | "bovenbouw"` to `ContextProfile` (documented
  as vo-only; other sectors use `studyYear`; no DB migration).

**Editor**
- `app/components/context/ContextFields.tsx` — new self-hiding `PhaseField` (`#cf-phase`, `showsPhase`
  gate, `VO_PHASES` options); `StudyYearField` now takes `sector` and self-hides via `showsStudyYear`.
- `app/components/context/ContextProfileEditor.tsx` — `phase` state; render `PhaseField` in step 1;
  `onOnderwijstype` clears `phase` when leaving vo; new `onPhase` clears `domain` when leaving
  bovenbouw; `showsDomainField = showsDomain(sector, phase) || Boolean(domain)` gates both
  `DomainSelect` and `DomainFields`; `StudyYearField` now always rendered (self-hides) instead of the
  `isHbo &&` literal; step summary adds a Fase line.

**Server / prompt**
- `app/lib/context/parseForm.ts` — parse `phase` (`showsPhase(sector) && isVoPhase(...)`), gate `domain`
  through `showsDomain(sector, phase)`, gate `studyYear` through `showsStudyYear(sector)`.
- `app/lib/context/format.ts` — inject `- Fase/Phase: <label>` from `VO_PHASES` (new `phase` label in
  the `LABELS` table, nl/en).
- `app/lib/context/migrate.ts` — read-time backfill `phase = "bovenbouw"` for a legacy vo profile that
  carries a profiel.

**i18n**
- `app/lib/i18n/messages/{nl,en}.ts` — `settings.phase` ("Fase"/"Phase") and `settings.phaseNone`
  ("Kies fase…"/"Choose phase…"); parity enforced by `tests/i18n.test.ts`.

## Test Plan

RED-first tests that pin the shipped behaviour (already green):

- **`tests/lib/relevance.test.ts`** — `showsPhase` true only for vo (false for mbo/hbo/wo/undefined/`""`);
  `showsStudyYear` true for hbo & mbo, false for vo/wo/undefined; `showsDomain` true for vo only in
  bovenbouw, true for every non-vo sector regardless of phase.
- **`tests/parseForm.test.ts`** — fase stored for vo, dropped off a non-vo (hbo) sector, junk rejected;
  profiel dropped in onderbouw, kept in bovenbouw; studiejaar un-gated for mbo, kept for hbo, dropped
  for vo. The existing P10 domain-catalogue cases updated to pass `phase=bovenbouw` (the profiel is now
  fase-gated).
- **`tests/migrateLegacy.test.ts`** — backfills `phase=bovenbouw` for a legacy vo profile with a
  profiel; leaves a profiel-less vo profile fase-less; never overwrites an existing phase; never adds a
  phase to a non-vo profile; idempotent.
- **`tests/context.test.ts`** — `formatProfile` injects `Fase: Bovenbouw` (nl) / `Phase: Upper secondary
  (bovenbouw)` (en).
- **`tests/components/ContextProfileEditor.test.tsx`** — a vo test picks the fase before step 2; the
  profiel is hidden in the onderbouw and shows the track's profielen (label "Profiel") in bovenbouw;
  P10.3 teacher-domain filtering still holds under bovenbouw.
- **`tests/components/ContextSettings.test.tsx`** — the Fase field appears after choosing a vo track;
  the profiel stays out of the DOM until fase = bovenbouw, then reveals the havo profielen; Studiejaar
  shows for mbo & hbo but not vo; **axe zero-violations** with a vo track + bovenbouw chosen.

**Gate:** `npm test && npm run typecheck && npm run check` — all green.

## Out of scope

- gymnasium/atheneum (a vwo school-type axis orthogonal to fase) and praktijkonderwijs — unchanged from
  P10's out-of-scope.
- A per-leerjaar numeric axis for vo (fase is the deliberate, unambiguous replacement).
- Any invented vo framework or pack — the fase is structure, injected as a label only.
- Any change to the streaming engine, provider, or tool registry. `format.ts` touched **only** to add
  the fase-label injection line.

## Acceptance

- [x] A vo profile carries a **fase** (onderbouw/bovenbouw); the field appears only for vo and hides for
      every other sector.
- [x] The **profiel** is hidden in the onderbouw and shown (track-scoped, label "Profiel") in the
      bovenbouw; a profile that already carries a profiel keeps showing it on edit.
- [x] **Studiejaar** shows for hbo & mbo, not for vo (fase) or wo; the P10 `isHbo` literal is gone.
- [x] The server drops a fase off non-vo, a profiel off vo-onderbouw, and a studiejaar off vo; junk fase
      values rejected. A legacy vo profile with a profiel reads back as bovenbouw (idempotent).
- [x] The fase injects into the directive (`Fase:`/`Phase:`); every string bilingual (parity green);
      the editor is axe-clean.
- [x] All gates green (`npm test && npm run typecheck && npm run check`).

> **✅ shipped** (`a904c2c`, on `main`). This brief is a faithful retroactive record; no code changes
> accompany it. Depends on P8, P9, P10; no follow-on deferred.
