# Qualification Frameworks

EduCraft scales a tool's complexity, vocabulary, and pedagogy to the learner's
**level**. To do that across countries, it needs a level model that is both precise
and globally translatable. This page is the reference.

See also: [Context Model](Context-Model.md) · [Vision §3](../docs/VISION.md#3-the-level-spine-eqf-18-globally-anchored).

---

## The spine and the bridge

- **EQF 1–8 (European Qualifications Framework)** is the **named spine** EduCraft
  reasons about — eight levels expressed as learning outcomes.
- **ISCED 2011 (UNESCO)** is the **global bridge** — a worldwide level reference
  (0–8) used to translate "what level is this" for countries without an EQF tie, or
  with a differently-sized framework.

> **Important:** national frameworks do **not** all use EQF's 1–8 range. Several run
> 1–10, Scotland's runs 1–12. EduCraft maps each national level onto the ISCED/EQF
> spine — it never assumes a fixed count.

---

## EQF spine (simplified)

| EQF | Learning-outcome character | Typical anchor |
|-----|----------------------------|----------------|
| 1 | Basic general knowledge | End of basic compulsory schooling |
| 2 | Basic factual knowledge of a field | Lower secondary; entry vocational |
| 3 | Facts, principles, processes, general concepts | Mid secondary / vocational |
| 4 | Factual & theoretical knowledge in broad contexts | Upper secondary diploma / advanced vocational |
| 5 | Comprehensive, specialised knowledge; short-cycle tertiary | Associate degree |
| 6 | Advanced knowledge; bachelor | Bachelor |
| 7 | Highly specialised knowledge; master | Master |
| 8 | Knowledge at the most advanced frontier | Doctoral |

---

## Target countries & their frameworks

### Europe — EQF
- **Netherlands** — **NLQF** (current first market; VO / mbo / hbo / wo).
- **Germany** — **DQR**.
- **France** — **RNCP / CNCP**.
- **Ireland** — **NFQ**, levels 1–10.
- **UK** — **RQF / FHEQ** (England, Wales, NI), levels 1–8; **SCQF** (Scotland),
  levels 1–12; **CQFW** (Wales).

### United States
No single national framework. Use:
- **K-12 grade levels** + degrees (Associate / Bachelor / Master / Doctoral).
- Standards via **Common Core** and **NGSS**.
- The voluntary **Degree Qualifications Profile (DQP)** for higher education.

### Canada
Provincial education systems coordinated through **CMEC**; the
**Canadian Degree Qualifications Framework (CDQF)** covers higher education.

### Australia
**AQF (Australian Qualifications Framework)** — levels 1–10.

### New Zealand
**NZQF (New Zealand Qualifications Framework)** — levels 1–10.

### South Africa
**NQF (National Qualifications Framework, SAQA)** — levels 1–10.

---

## How it is used

1. The teacher picks **country → sector → level** (a prominent first choice, not a
   buried setting — see [Vision §6](../docs/VISION.md#6-why-one-app-a-settled-decision)).
2. EduCraft resolves that to an ISCED/EQF position and loads the matching
   [framework pack](Context-Model.md#packs).
3. The engine scales the prompt — complexity, examples, vocabulary, pedagogical
   assumptions — to the level's outcome descriptors.

> Mappings here are approximate and meant for engineering orientation, not
> accreditation. Each framework pack should carry the authoritative descriptors for
> its jurisdiction.
