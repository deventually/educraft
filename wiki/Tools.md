# Tools

A *tool* in LimeOnIt pairs an evidence-based teaching method with a carefully
designed, evaluated prompt. Tools are **data** on a shared runtime — see
[Architecture](Architecture.md). Each tool's prompt is adapted from
*The Pedagogical Promptbook* (CC BY 4.0) and kept faithful to its source via a
visible verbatim original.

---

## The stage model

`stages[]` is the unifier:

- A **one-shot generator** has a single stage: interview answers → one generation.
- A **multi-stage tool** chains stages; later stages pull earlier outputs via
  `consumes`. The Cognitive Architect is the reference example (four stages).

Every stage references a `systemPromptId`, resolved to a localized prompt file by
the [prompt pipeline](Architecture.md#the-prompt-pipeline).

---

## Current tools (MVP — phase 1)

| Tool | Method | Type |
|------|--------|------|
| **Begeleide reflectie & Backward Design** | Backward Design | generator (1 stage) |
| **Cognitive Architect** | Science of Learning (Gagné / Rosenshine) | generator (4 stages) |
| **Authentieke toetsing** | Backward Design + VALUE rubrics | generator (1 stage) |
| **ARCS Reactor** | ARCS-V motivation model | generator (1 stage) |

The Cognitive Architect's four stages: **Instructional Analyst** → **Student Prompt
Generator** → **Quality Validator** → **Analyst Prompt Generator**, with later
stages consuming earlier artifacts (the Instructional Coordinates Document, the
Student System Prompt).

---

## Planned tools (roadmap)

See the [Roadmap](Roadmap.md) for sequencing.

- **Instructor generators:** Bloom by Design, Forum Autograder, handwritten-math
  marking (with image input).
- **Student-facing tools (phase 3):** MentorAI, Think-Pair-Share, Socratic tutor —
  built on the existing chat infrastructure. This is where
  [compliance & safeguarding](Internationalization.md#5-compliance--safeguarding)
  for minors becomes load-bearing.

---

## Why this scales to the vision

Because tools are data and prompts are externalized per language, the *same* tool
serves every level, sector, and country once the [context model](Context-Model.md)
feeds it the right profile and the prompt phrasing reads the
[learner profile](Context-Model.md#the-learner-noun-problem-a-concrete-near-term-task)
rather than hard-coding it.

## Related

- [Adding a Tool or Pack](Adding-a-Tool-or-Pack.md) · [Architecture](Architecture.md) ·
  [Roadmap](Roadmap.md)
