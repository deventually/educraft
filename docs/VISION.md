# LimeOnIt — Vision

> A **pedagogy compiler for the world**: one application that turns evidence-based
> teaching methods into ready-to-use learning designs for **any level (EQF 1–8),
> any sector, any country, any language**.

*Status: living document · Started 2026-05-29*

This is an envisioning document, not a commitment. It describes what LimeOnIt can
become and the single architectural idea that makes that reach tractable. For what
exists today and how it is built, see [`README.md`](../README.md).

---

## 1. The core thesis

**Good pedagogy is universal; its surface is local.**

The cognitive science behind *The Pedagogical Promptbook* — retrieval practice,
backward design, motivation (ARCS-V), authentic assessment, cognitive engagement —
describes *how humans learn*. It does not change between a primary-school classroom
and a doctoral seminar, nor between Rotterdam and Nairobi. What changes is the
**shell** around it: the words, the level of complexity, the curriculum standard,
the language, the assessment culture, the legal regime.

LimeOnIt's bet:

> **Build the universal pedagogical engine once, and make everything local a
> swappable layer of data.**

A teacher anywhere enters their context; the engine *compiles* it into
research-grounded, classroom-ready material — in their language, at their level,
within their framework. This is why LimeOnIt is **one app, not many** (see §6).

---

## 2. Three axes of universality

LimeOnIt generalizes along three independent axes. Today it occupies a single
corner — **Netherlands · hbo · Dutch**. The vision is to fill the cube.

1. **Level — the full EQF 1–8.** From basic general knowledge (EQF 1) through
   secondary and vocational education (2–4), short-cycle and bachelor (5–6),
   master (7), to doctoral level (8). The *same* tool, re-scaled in complexity,
   vocabulary, and pedagogy by level.
2. **Geography — every country.** Not just a translated interface, but localized
   *frameworks*: each country's curriculum standards, qualification framework,
   terminology, grading culture, and compliance regime become packs that plug into
   the same engine. **Initial target regions:** Europe (EQF), the United States,
   Canada, Australia, New Zealand, and South Africa — chosen because they have
   mature qualification frameworks and large English- or Dutch-adjacent education
   sectors. Wherever the same model applies, more countries follow; the architecture
   sets no geographic ceiling.
3. **Tools — the full Promptbook and beyond.** The ~14 evidence-based methods,
   plus future instructor- and student-facing tools, all expressed as data on one
   runtime.

The axes are orthogonal: adding a country does not touch the level logic; adding a
tool does not touch the localization layer.

---

## 3. The level spine: EQF 1–8, globally anchored

EQF 1–8 is the **primary level spine**. To reach "every country," it is bridged to
global and national standards rather than tied to the Dutch ladder:

- **ISCED 2011 (UNESCO)** — the worldwide level reference; the neutral interlingua
  for "what level is this," usable where EQF is not.
- **EQF (Europe)** — the named 8-level spine, expressed as learning outcomes.
- **National frameworks** map onto EQF/ISCED as packs. Note that they do *not* all
  share EQF's 1–8 range — the engine maps each onto the ISCED/EQF spine rather than
  assuming a fixed count:
  - **Europe** — EQF 1–8; national: NLQF (NL), DQR (DE), RNCP/CNCP (FR), NFQ (IE,
    1–10), RQF/FHEQ (England/Wales/NI, 1–8), SCQF (Scotland, 1–12).
  - **United States** — no single national framework: K-12 grade levels + degrees
    (Associate/Bachelor/Master/Doctoral); standards via Common Core / NGSS; the
    voluntary Degree Qualifications Profile (DQP).
  - **Canada** — provincial systems (CMEC); Canadian Degree Qualifications Framework
    (CDQF) for higher education.
  - **Australia** — AQF, levels 1–10.
  - **New Zealand** — NZQF, levels 1–10.
  - **South Africa** — NQF (SAQA), levels 1–10.

| EQF | Learning-outcome character (simplified) | Example anchors |
|-----|------------------------------------------|-----------------|
| 1 | Basic general knowledge | End of basic compulsory schooling |
| 2 | Basic factual knowledge of a field | Lower secondary; entry vocational (NL: vmbo-b/k, mbo-1) |
| 3 | Facts, principles, processes, general concepts | NL: vmbo-gt/mavo, mbo-2/3, havo onderbouw |
| 4 | Factual & theoretical knowledge in broad contexts | NL: havo/vwo diploma, mbo-4 |
| 5 | Comprehensive, specialised knowledge; short-cycle tertiary | NL: Associate degree |
| 6 | Advanced knowledge; bachelor | hbo / wo bachelor |
| 7 | Highly specialised knowledge; master | Master |
| 8 | Knowledge at the most advanced frontier; doctoral | PhD |

*(EQF and ISCED are broadly alignable, not identical — EQF is outcomes-based, ISCED
is programme-based. The engine treats the spine as the source of truth and maps
national labels onto it.)*

The user picks a level; the engine knows its outcome descriptors and **scales the
prompt** — complexity, examples, vocabulary, and pedagogical assumptions — to match.

---

## 4. The localizable context model

Generalize today's context profile (programme / domain / EQF / competencies /
free-text + the hbo-i pack) into a small set of **orthogonal dimensions**:

- **Country / region**
- **Education sector** — general/academic · vocational · higher · professional/CPD
- **Level** — EQF 1–8 ↔ ISCED ↔ national framework
- **Subject / domain** — with an optional domain pack (hbo-i for ICT is the first)
- **Framework pack** — curriculum standards & qualification descriptors for that
  country + sector + level
- **Language** — UI language *and* output language (already separate dimensions)
- **Learner profile** — the learner-noun (pupil · student · apprentice · trainee)
  and the register, derived from sector + level
- **Institutional constraints & compliance** — privacy regime, especially for minors

The current **hbo-i pack is the prototype for all of these.** Anything sector- or
country-specific is a pack; the engine never hard-codes a locale.

---

## 5. Internationalization is more than language

Five layers, in increasing depth:

1. **UI language** — interface chrome (nl/en today; extend to N languages).
2. **Output language** — per generation (already a parameter).
3. **Framework localization** — curriculum standards, qualification descriptors,
   level naming.
4. **Pedagogical & cultural norms** — assessment culture, grading scales (1–10 NL,
   GPA US, percentage UK), directness of feedback, individual vs. collective norms.
5. **Compliance & safeguarding** — GDPR (EU), FERPA/COPPA (US), and minors' data
   protection. This module activates by country + learner age and matters most for
   the **future student-facing tools**, far less for today's instructor generators.

Translation is layer 1–2. The reach of the vision lives in layers 3–5.

---

## 6. Why one app (a settled decision)

The pedagogy is universal; only the surface differs. The divergence between
sectors and countries is **data, not code** — terminology, level taxonomy,
framework pack, register. LimeOnIt's architecture (tools-as-data, generic profile +
packs, output language as a parameter) is already built around exactly that seam.

Forking into separate apps per sector or per country would mean N deploys, N× the
bug surface, and every pedagogy, provider, or i18n improvement re-done N times — a
maintenance tax with no shared upside, since 90%+ of the codebase is identical
across contexts. Audiences also overlap (institutions and educators routinely
straddle levels and subjects).

**Model: "one product, many front doors."** Sector-, level-, and country-specific
landing pages, branding, and presets sit *on top of* one shared engine — never as
separate codebases. Reconsider separation only if some context ever needs a
fundamentally different *workflow*, not merely different vocabulary.

The real risk is not technical but UX: *"universal for everyone = right for no
one."* **Mitigation:** make **country + level + sector a prominent first choice**
that genuinely re-skins terminology, examples, defaults, and tone — not a buried
dropdown. Each context should *feel* like its own purpose-built tool.

---

## 7. Universal core vs. localizable shell

The line between these two columns is the entire architecture.

| Universal core (build once) | Localizable shell (data / packs) |
|-----------------------------|----------------------------------|
| The evidence-based methods & cognitive-science principles | Language (UI + output) |
| Tool registry (tools as data) | Framework packs (curriculum & qualification standards) |
| Prompt pipeline (`buildSystemPrompt`, interpolation, stages) | Level descriptors (EQF/ISCED/national) |
| Provider abstraction (multi-model, local-first) | Terminology & learner-noun, register |
| Streaming, persistence, evaluation harness | Grading & assessment norms |
| Interview→generate UX | Compliance & safeguarding rules |

---

## 8. Architecture: the vision extends today's design

LimeOnIt already rests on the right primitive — **tools are data, context is a
generic profile + optional packs, output language is a parameter.** The global
vision is that *same* primitive, scaled:

- additional context dimensions (country, sector, a level spine, framework pack);
- a **packs registry** (hbo-i is pack #1 → many);
- prompt phrasing parameterized by the **learner profile**, so prompts stop
  hard-coding *"studenten"* / *"docent"*;
- the i18n message catalog scaling from nl/en to N languages;
- compliance/safeguarding as configuration that gates the student-facing phase.

This is a **widening of existing seams, not a rebuild.**

---

## 9. An illustrative path

Direction, not commitment — sequence by real demand.

- **Now** — NL · hbo · nl/en · 4 instructor generators.
- **Near** — sector + level spine (EQF 1–8) across NL (VO / mbo / hbo / wo);
  learner-noun parameterized; remaining Promptbook tools; more providers.
- **Mid** — framework-pack system; a first non-NL country as a second pack;
  multilingual UI beyond nl/en; student-facing tools + safeguarding for minors.
- **Far** — community-contributed country & curriculum packs; ISCED-anchored level
  engine; multi-model evaluation across contexts; export & LMS integration.

---

## 10. Guiding principles

- **Evidence first** — every tool traces to a named method and a source (CC BY
  fidelity to the Promptbook).
- **Universal core, local shell** — never hard-code a locale into the engine.
- **One product, many front doors** — tailor the entry, not the codebase.
- **Context is a first choice, not a setting** — country, level, and sector up front.
- **Local-first & model-agnostic** — runs on the institution's chosen engine and
  infrastructure.
- **Safeguard minors by design.**

---

## 11. Non-goals (for now)

- Not an LMS or student-information system.
- Not a content repository or course marketplace (initially).
- Not a grading-of-record system.
- Not a set of bespoke per-country codebases.
