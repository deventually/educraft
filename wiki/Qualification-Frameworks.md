# Qualification Frameworks

LimeOnIt scales a tool's complexity, vocabulary, and pedagogy to the learner's
**level**. To do that across countries, it needs a level model that is both precise
and globally translatable. This page is the reference.

See also: [Context Model](Context-Model.md) · [Vision §3](../docs/VISION.md#3-the-level-spine-eqf-18-globally-anchored).

---

## The spine and the bridge

- **EQF 1–8 (European Qualifications Framework)** is the **named spine** LimeOnIt
  reasons about — eight levels expressed as learning outcomes. It is the **only**
  level currency the engine injects (see [Context Model](Context-Model.md)).
- A national framework is what the *teacher* actually picks; the app stores that
  national level and **derives** the EQF number from it.
- **ISCED 2011 (UNESCO)** is documented here as a possible future global bridge for
  non-EQF countries, but **is not adopted** in the implementation (Phase 8). No ISCED
  code path exists; it remains a seam for a later country pack.

> **Important:** national frameworks do **not** all use EQF's 1–8 range. Several run
> 1–10, Scotland's runs 1–12. A country pack maps each national level onto the EQF
> spine — the engine never assumes a fixed count.

### Netherlands — NLQF (implemented)

The stored level today is the **NLQF** (`app/lib/context/nlqf.ts`), verified against
nlqf.nl:

- NLQF = an **Instroomniveau** + levels **1–8**, coupled **1:1** to EQF (NLQF *n* → EQF *n*),
  plus an **NLQF 4+ / EQF 4** rung ("formeel onderwijs", vwo).
- The **Instroomniveau cannot be coupled to EQF**; the engine approximates it to EQF 1
  paired with a neutral entry-level note (a documented approximation, not a claim of equality).
- Indicative diploma anchors used to prefill the level (Staatscourant 2024-34565):
  vmbo-bb → NLQF 1; vmbo-kb/gl/tl → 2; mbo entree/2/3/4 → 1/2/3/4; havo → 4; vwo → 4+;
  ad → 5; bachelor → 6; master → 7; doctoraat → 8.
- `derive.ts` turns the stored NLQF level into `{ eqf }`; only that EQF number + the
  neutral directive reach `{{contextProfile}}` — **never** the term "NLQF"/"Instroom".

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

## How it is used (Phase 8)

1. The teacher picks **country → onderwijstype (sector + track) → level** in the
   stepped editor — a prominent first choice, not a buried setting
   (see [Vision §6](../docs/VISION.md#6-why-one-app-a-settled-decision)). The track
   prefills the matching NLQF level (overridable).
2. `derive.ts` resolves the stored NLQF level to an **EQF number**; the sector
   resolves a verified [framework pack](Context-Model.md#packs) via `resolveFramework`
   — **hbo only today**. vo/mbo have no verified pack yet, so the editor shows an honest
   "no national framework" note and falls back to custom fields (nothing is invented).
3. The engine scales the prompt — complexity, examples, vocabulary, pedagogical
   assumptions — to the injected EQF number + the neutral level directive, and uses the
   sector-driven learner/teacher noun.

> Mappings here are approximate and meant for engineering orientation, not
> accreditation. Each framework pack should carry the authoritative descriptors for
> its jurisdiction. Verified po/vo/mbo packs are a later content phase (SLO kerndoelen;
> vmbo examenprogramma's/profielen; SBB kwalificatiedossiers) — never invented.
