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

Today this is implemented as a generic profile
(`app/lib/context/types.ts`) plus the **hbo-i (ICT) pack**, formatted bilingually by
`formatProfile(profile, lang)` in `app/lib/context/format.ts`. The vision generalizes
this into a small set of **orthogonal dimensions**.

---

## The orthogonal dimensions

| Dimension | Examples | Notes |
|-----------|----------|-------|
| **Country / region** | NL, US, CA, AU, NZ, ZA … | Selects the framework pack, terminology, and compliance regime. |
| **Education sector** | general/academic · vocational · higher · professional/CPD | Drives tone and learner vocabulary. |
| **Level** | EQF 1–8 ↔ ISCED ↔ national framework | See [Qualification Frameworks](Qualification-Frameworks.md). |
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
without changing it. The existing **hbo-i pack** (architectuurlagen / activiteiten /
niveau, shown when `domain === "ICT"`) is the prototype for all future packs:

- **Domain packs** — subject-specific structure (hbo-i for ICT; others to follow).
- **Framework packs** — a country+sector+level's curriculum standards and
  qualification descriptors (see [Qualification Frameworks](Qualification-Frameworks.md)).

> **Rule:** the engine never hard-codes a locale. Anything country- or
> sector-specific lives in a pack. This is the seam that keeps "one app for the
> world" maintainable — see [Vision §6–8](../docs/VISION.md#6-why-one-app-a-settled-decision).

---

## The learner-noun problem (a concrete near-term task)

The current Dutch prompts hard-code *"studenten"* and *"docent"*. Across the ladder
the correct learner-noun varies — VO **leerlingen**, mbo **deelnemers/studenten**,
hbo/wo **studenten**, and per country/language again. The fix is to make the
learner-noun and register part of the **learner profile** dimension, so prompts read
it from context instead of fixing it. This is one of the first steps in the
[Roadmap](Roadmap.md).

## Related

- [Qualification Frameworks](Qualification-Frameworks.md) ·
  [Internationalization](Internationalization.md) · [Architecture](Architecture.md)
