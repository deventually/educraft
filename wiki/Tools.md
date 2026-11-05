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

## Current tools (20)

All 14 tools from the book plus six originals are shipped. *For* = who the tool speaks to
(`Tool.userType`): the teacher, or the learner through a tutor the teacher sets up.

| # | Chapter | Tool (slug) | Mode | For |
|---|---------|-------------|------|-----|
| 1 | From Model to Mentor | MentorAI (`mentorai`, prompt `@v2`: the book's Cognitive Apprenticeship Coach) | chat | learner |
| 2 | Contextualization | Contextualization (`contextualization`) | one-shot | teacher |
| 3 | Think-Pair-Share | Think-Pair-Share (`think-pair-share`) | chat | learner |
| 4 | Guided Reflection | Guided Reflection (`guided-reflection`, prompt `@v2`: the book's Step 3, three stages apart) | one-shot | teacher |
| 5 | Dialogic Encounters | Dialogic Encounters (`dialogic-encounters`, prompt `@v2`: the book's interview with a theorist) | chat | learner |
| 6 | Forum Autograder | Forum Autograder (`forum-autograder`) | one-shot | teacher |
| 7 | Handwritten Math | Math Grading (`math-grading`) | one-shot + image | teacher |
| 8 | Authentic Assessment | Authentic Assessment (`authentic-assessment`) | one-shot | teacher |
| 9 | ARCS Reactor | ARCS Reactor (`arcs-reactor`) | one-shot | teacher |
| 10 | Bloom by Design | Bloom by Design (`bloom-by-design`) | chat | teacher |
| 11 | Peer Tutoring | Peer Tutoring (`peer-tutoring`) | chat | learner |
| 12 | Oracle to Socratic (Appendices A–D) | Cognitive Architect (`cognitive-architect`) | multi-stage (4) | teacher |
| 13 | Scaffolding | Scaffolding Feedback (`scaffolding-feedback`) | chat | learner |
| 14 | Oracle to Socratic (Appendix E.3) | Socratic Partner (`socratic-partner`) | chat | learner |
| 15 | — (original) | Assess student work (`stage-assessment`, prompt `@v2`) | one-shot | teacher |
| 16 | — (original, P24.2) | Create an assessment rubric (`rubric-builder`) | one-shot | teacher |
| 17 | — (original, P24.3) | Write test questions and a blueprint (`test-items`, two stages: blueprint → questions) | one-shot | teacher |
| 18 | — (original, P24.4) | Prepare a lesson (`lesson-plan`) | one-shot | teacher |
| 19 | — (original, P24.5) | Explain a test analysis (`test-analysis`; the numbers come from the item-analysis utility, the AI computes nothing) | one-shot | teacher |
| 20 | — (original, P24.6) | Write a clear assignment (`clear-assignment`) | one-shot | teacher |

The Cognitive Architect's four stages: **Instructional Analyst** → **Student Prompt
Generator** → **Quality Validator** → **Analyst Prompt Generator**, with later
stages consuming earlier artifacts (the Instructional Coordinates Document, the
Student System Prompt).

The **utilities** (`/utilities`, P23) compute without AI: the grade calculator, rubrics, and the
item analysis (`item-analysis`, P24.5: p-value, Rit, Rir and Cronbach's alpha from a pasted,
anonymous score list). A utility can name an explaining tool (`Utility.explainWith`): its
"Explain this" button hands only the per-question numbers to that tool's form through
sessionStorage (`app/lib/forms/handoff.ts`).

Next to the tools, the **BDB/BKE workplace** (`/portfolio`) helps a teacher build their
teaching-qualification dossier (see [Architecture](Architecture.md#feature-modules)).

---

## Planned tools

See the [Roadmap](Roadmap.md): utilities without AI (brief P23) and eight new AI tools
(brief P24).

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
