# Context Model

The context model is what lets **one app** serve every level, sector, and country.
It is the practical expression of the [Vision](../docs/VISION.md) thesis —
*pedagogy is universal, its surface is local.*

---

## The principle

Everything that differs between a vwo classroom and a doctoral seminar, or between
the Netherlands and South Africa, is captured as **context data** fed into a
universal engine — not as separate code paths. A teacher describes their context;
[`buildSystemPrompt`](Architecture.md) injects it into the prompt as
`{{contextProfile}}`.

Today this is implemented (Phase 8) as a generic profile (`app/lib/context/types.ts`)
threaded through a **country → sector → level → domain → framework** seam:

- **Country** (`countries.ts`) — `NL` today; the outer axis a future country pack slots into.
- **Sector** (`sectors.ts`) — `vo · mbo · hbo · wo` (primary education, po, is deliberately
  not shipped). Sector scopes the subject taxonomy and drives the learner/teacher noun.
- **Level** — stored as the national **NLQF** level (`nlqf.ts`, the source of truth); the
  engine *derives* and injects only the country-neutral **EQF number** via `derive.ts`
  (`resolveLevel`). No national term ("NLQF"/"Instroom") ever reaches the prompt.
- **Domain** (`domains.ts`) — sector-scoped subject options (`getDomainsForSector`).
- **Framework** (`frameworks.ts`) — a verified domain pack resolved by
  `resolveFramework(country, sector, domain)`; hbo-only today, else the honest
  custom-fields fallback (never an invented framework).

A profile stores only the chosen answers (`packValues`) plus any user-defined
`customFields`; everything is formatted bilingually by `formatProfile(profile, lang)` in
`app/lib/context/format.ts`. Profiles are created + edited in one consolidated **stepped
editor** (`ContextProfileEditor`), and input is validated against the catalogues in
`app/lib/context/parseForm.ts`. Which countries, sectors and domains a teacher may pick is
composed by `availability.server.ts` under an **override** model, not an intersection — see
[Availability & per-teacher override](#availability--per-teacher-override-p12) below. The
vision generalizes this further into a small set of **orthogonal dimensions**.

---

## The orthogonal dimensions

| Dimension | Examples | Notes |
|-----------|----------|-------|
| **Country / region** | NL (US, CA, AU, NZ, ZA … as a seam) | Selects the framework pack, terminology, and compliance regime. |
| **Education sector** | vo · mbo · hbo · wo (po not shipped) | Drives tone and learner/teacher vocabulary; scopes the domain catalogue. |
| **Level** | national **NLQF** stored → **EQF 1–8** derived | **ISCED is not adopted** (seam only). Only the EQF number is injected. See [Qualification Frameworks](Qualification-Frameworks.md). |
| **Subject / domain** | ICT, healthcare, language, … | Optional **domain pack** (hbo-i is the first). |
| **Framework pack** | curriculum standards + qualification descriptors | Per country + sector + level. |
| **Language** | UI language *and* output language | Two separate parameters — see [Internationalization](Internationalization.md). |
| **Learner profile** | pupil · student · apprentice · trainee + register | Derived from sector + level; replaces hard-coded "studenten". |
| **Constraints & compliance** | class size, tooling, privacy regime, learner age | Compliance matters most for student-facing tools. |

The dimensions are **independent**: adding a country does not touch the level logic;
adding a tool does not touch localization.

---

## Availability & per-teacher override (P12)

Not every instance offers every country, sector, or domain, and one teacher may need a
different scope than the house default. Three axes — **countries**, **education sectors**
(`vo · mbo · hbo · wo`), and **domains / profielen** — are composed in
`availability.server.ts` into the option sets the context editor shows.

**Instance defaults.** The admin *Teaching context* page (`admin.context.tsx`) sets a
house default per axis, stored migration-free in `instance_settings`
(`enabledCountries` / `enabledSectors` / `enabledDomains`). Country and sector cannot be
emptied (a lockout guard keeps at least the catalogue); an empty domain list means "all".

**Per-teacher override — not an intersection.** Each teacher carries an *Activate custom
access* flag:

- **Off (default):** the teacher **inherits the instance** on every axis.
- **On:** the teacher's own per-axis selection **replaces the instance entirely** — they
  may be granted *more* than the instance or fewer, and an empty axis means "all" (the
  instance is ignored for them).

The composition is `axisSelection` (which single set governs — an activated teacher's own
assignment, else the instance-enabled list) feeding `resolveAxis` (catalogue ∩ selection,
with a fall-back-to-all lockout guard). This override model fixes an earlier bug where a
disjoint instance/teacher pair (instance sectors `{wo}`, teacher `{vo}`) intersected to
empty and silently fell back to the full catalogue.

**Non-destructive deactivate.** Turning the flag off only flips the flag; the teacher's
saved per-axis selections are preserved and return if custom access is re-activated. The
flag and per-teacher assignments live under keyed `instance_settings` rows too — no
migration.

Public seam: `getAvailableCountries` / `getAvailableSectors` / `getAvailableDomains`, plus
the track-independent `getAvailableDomainSlugs`.

> Note the contrast with the **tool/model** gates in the same module, which *intersect*
> instance × role/cohort × per-teacher allow-list. The context axes deliberately do not.

---

## Packs

A **pack** is a bundle of locale- or domain-specific data that plugs into the engine
without changing it. Domain packs live as pure data in `DOMAIN_PACKS`
(`app/lib/context/packs.ts`); adding capability means adding a registry entry, never
branching control flow. Each pack's option values are lifted verbatim from the domain's
authoritative national framework and carry a `source`/`sourceUrl` for transparency.
Shipped domain packs: ICT (hbo-i), Techniek (HBO Engineering), Economie & management
(HEO), Zorg & welzijn (Bachelor Nursing 2020 / CanMEDS), Onderwijs (bekwaamheidseisen +
generieke kennisbasis), Sociale studies (LOD Sociaal Werk), Recht (LBOP HBO-Rechten),
Kunst & creatief (Beeldende kunst & design). Domains **without** a recognised national
taxonomy (Agro/voeding & leefomgeving, Overig) are deliberately absent — the UI falls
back to user-defined `customFields` rather than inventing a framework.

- **Domain packs** — subject-specific structure, one verified registry entry per domain.
- **Framework packs** — a country+sector+level's curriculum standards and
  qualification descriptors (see [Qualification Frameworks](Qualification-Frameworks.md)).

> **Rule:** the engine never hard-codes a locale. Anything country- or
> sector-specific lives in a pack. This is the seam that keeps "one app for the
> world" maintainable — see [Vision §6–8](../docs/VISION.md#6-why-one-app-a-settled-decision).

---

## The learner-noun problem (largely solved in Phase 8)

The Dutch prompt files still contain literal *"studenten"* / *"docent"*, but across the
ladder the correct learner-noun varies — vo **leerlingen**, mbo **studenten/deelnemers**,
hbo/wo **studenten** — and the teacher is a **docent** (a primary *leerkracht* would follow
once po ships). Phase 8 fixes this **without editing the 15 prompt files**: `format.ts`
injects a sector-driven learner-noun + teacher-noun directive (both audiences), so the tools
use the right words from context. The remaining literal sweep of the prompt files themselves
is an eval-gated backlog item (highest regression risk, kept standalone) — see
[Roadmap](Roadmap.md).

## Related

- [Qualification Frameworks](Qualification-Frameworks.md) ·
  [Internationalization](Internationalization.md) · [Architecture](Architecture.md)
