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
`app/lib/context/parseForm.ts`. Which countries/sectors a teacher may pick is composed by
`availability.server.ts` (`getAvailableCountries/Sectors`, default-open). The vision
generalizes this further into a small set of **orthogonal dimensions**.

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
