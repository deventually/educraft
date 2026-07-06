# Roadmap

A phased path from today's MVP to the global [Vision](../docs/VISION.md). This is
**direction, not commitment** — sequence by real demand. The current-state list also
lives in the [README](../README.md).

---

## Now — shipped (phase 1)

- Netherlands · hbo · Dutch/English UI.
- Four instructor generators (see [Tools](Tools.md)).
- Externalized bilingual prompts, generic context profile + hbo-i pack, multi-provider
  AI with dynamic local-model discovery.
- Verified: build, typecheck, 57 tests, full pipeline (live LLM call needs an API key).

## Phase 2 — breadth

- Remaining instructor generators: Bloom by Design, Forum Autograder,
  handwritten-math marking (image input).
- More provider adapters (OpenAI / Gemini) alongside the existing ones.

## Phase 3 — student-facing

- Student-facing chatbots (MentorAI, Think-Pair-Share, Socratic tutor) on the
  existing chat infrastructure (`mode: "chat"`).
- First need for [compliance & safeguarding](Internationalization.md#5-compliance--safeguarding)
  for minors.

## Phase 4 — quality & sharing

- Evaluation with synthetic students, multi-model comparison.
- PDF / DOCX export, shareable links.

---

## Vision tracks (cross-cutting, sequence by demand)

These realize the [Vision](../docs/VISION.md) and run alongside the phases above.

- **Level spine** — add EQF 1–8 as a first-class dimension across NL
  (VO / mbo / hbo / wo); anchor to ISCED. See
  [Qualification Frameworks](Qualification-Frameworks.md).
- **Learner-noun parameterization** — stop hard-coding *"studenten"*; read the
  [learner profile](Context-Model.md#the-learner-noun-problem-a-concrete-near-term-task)
  from context.
- **Framework-pack system** — generalize the hbo-i pack into the
  [pack mechanism](Context-Model.md#packs); add a first non-NL country (e.g. US or
  UK) as a second pack.
- **Multilingual UI** — extend the i18n catalog beyond nl/en.
- **Global reach** — target regions: Europe, US, Canada, Australia, New Zealand,
  South Africa, and more wherever the model applies.
- **Community packs** — eventually, community-contributed country & curriculum packs.

## Deferred tech debt

- **React Router 7 → 8** — *deferred* (P5.8 item 3). RR 7.15 is stable and not a
  launch blocker; RR 8 is a fresh framework major with a large blast radius
  (typegen, 30+ route modules, the SSR entry, and the `createCookieSessionStorage`
  import path), whose regressions the current non-E2E suite cannot fully catch.
  Revisit as a dedicated pass once the RR 8 ecosystem has settled and after E2E
  coverage exists — read the official migration guide first, time-box it, and
  abandon cleanly if it cascades. `vitest 3 → 4` and `AI SDK 6 → 7` shipped in P5.8.

## Related

- [Vision](../docs/VISION.md) · [Tools](Tools.md) · [Context Model](Context-Model.md)
