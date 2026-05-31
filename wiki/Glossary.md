# Glossary

Shared vocabulary for LimeOnIt. Linked from across the wiki.

---

## Education levels & frameworks

- **EQF** — European Qualifications Framework; 8 levels of learning outcomes.
  LimeOnIt's named [level spine](Qualification-Frameworks.md).
- **ISCED** — International Standard Classification of Education (UNESCO); the global
  level reference (0–8) used to translate levels across countries.
- **NLQF** — the Dutch national qualifications framework (referenced to EQF).
- **AQF** — Australian Qualifications Framework (levels 1–10).
- **NZQF** — New Zealand Qualifications Framework (levels 1–10).
- **NQF (SAQA)** — South Africa's National Qualifications Framework (levels 1–10).
- **RQF / FHEQ / SCQF** — UK frameworks (England/Wales/NI 1–8; Scotland 1–12).
- **NFQ** — Ireland's National Framework of Qualifications (levels 1–10).
- **DQP** — Degree Qualifications Profile (voluntary, US higher education).
- **Common Core / NGSS** — US K-12 curriculum standards.

## Dutch education sectors

- **VO** — *voortgezet onderwijs* (secondary): includes **havo** and **vwo**.
- **mbo** — *middelbaar beroepsonderwijs* (vocational); learners often **deelnemers**.
- **hbo** — *hoger beroepsonderwijs* (higher professional education).
- **wo** — *wetenschappelijk onderwijs* (university / academic).
- **hbo-i** — the ICT domain within hbo; the first [domain pack](Context-Model.md#packs).
- **leerling / student / deelnemer** — learner-nouns that vary by sector and country;
  see the [learner-noun problem](Context-Model.md#the-learner-noun-problem-a-concrete-near-term-task).

## Pedagogy

- **Backward Design** — design from outcomes → evidence → activities (Wiggins &
  McTighe).
- **ARCS-V** — a motivation model: Attention, Relevance, Confidence, Satisfaction,
  Volition.
- **Constructive alignment** — keeping outcomes, assessment, and activities
  mutually aligned (Biggs).
- **Science of Learning** — evidence-based principles (e.g. retrieval practice,
  spaced practice, dual coding) underpinning the Cognitive Architect.
- **The Pedagogical Promptbook** — David Wiley (ed.), CC BY 4.0, DOI 10.59668/2340;
  LimeOnIt's source material.

## LimeOnIt architecture

- **Tool** — a declarative method+prompt unit; *data, not code*. See
  [Architecture](Architecture.md).
- **Stage** — one generation step; tools chain stages via `consumes`. See
  [Tools](Tools.md).
- **PromptDef** — a tool's prompt definition: verbatim original + runtime prompt.
- **Pack** — locale- or domain-specific data that plugs into the engine without
  changing it (domain pack or framework pack). See [Context Model](Context-Model.md#packs).
- **Context profile** — the per-generation context injected as `{{contextProfile}}`.
- **UI language vs output language** — two independent parameters; see
  [Internationalization](Internationalization.md).
- **Pedagogy compiler** — the project's shorthand for itself: context in →
  research-grounded learning material out.

## Related

- [Home](Home.md) · [Qualification Frameworks](Qualification-Frameworks.md) ·
  [Context Model](Context-Model.md)
