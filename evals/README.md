# Eval harness

Measures the **output quality** of LimeOnIt's tools — the thing structural tests
(placeholders resolve, NL/EN parity) cannot see. It reuses the real pipeline
(`buildSystemPrompt` + `providerForModel`), so what it scores is exactly what the
app sends.

## ⚠️ Run it by hand — it costs money and is never in CI

The harness calls real Anthropic APIs (~€1–3/run) and needs `ANTHROPIC_API_KEY`.
It is **not** part of `npm test`. Run it yourself:

```bash
ANTHROPIC_API_KEY=sk-… npm run eval                      # every tool that has cases
ANTHROPIC_API_KEY=sk-… npm run eval -- --tool forum-autograder
ANTHROPIC_API_KEY=sk-… npm run eval -- --judge-model claude-sonnet-4-6
npm run eval -- --cases-only     # regenerate raw outputs, skip the judge
npm run eval -- --judge-only     # re-judge the latest raw outputs, skip generation
```

It runs on `vite-node` (not `tsx`): the prompt files use Vite's `?raw` imports,
which plain tsx/Node cannot load — see `scripts/eval.config.ts`.

## Layout

```
evals/<toolId>/cases.json    input scenarios (committed)
evals/<toolId>/rubric.md     judge rubric, English, one per tool (committed)
evals/output/<date>/…        raw model outputs           (gitignored — large/non-deterministic)
evals/reports/<date>.md      scored report + <date>.scores.json (committed)
```

## Cases

- `cases.json` holds 2–3 realistic Dutch scenarios per tool. A case gives `values`
  (form field → value), an `outputLanguage`, and an optional inline `profile`
  fixture (matches `ContextProfile` without the `id`).
- **EQF register contrast:** tools whose output register should track level carry
  a pair of cases at contrasting EQF levels (e.g. `-eqf2` / `-eqf6`). The level
  only actually reaches a tool that injects `{{contextProfile}}` — see the note
  below.
- **Chat tools:** a case supplies `userTurns` (the scripted student side); the
  harness plays them turn by turn and judges the whole transcript.

## Rubrics

`rubric.md` is English (one per tool; it judges output in either language). The
judge scores five shared criteria 1–5 — **taskFidelity, pedagogicalSoundness,
formatAdherence, levelFit, languageQuality** — plus any tool-specific expectations
the rubric adds.

## Reports & deltas

Each run writes `evals/reports/<date>.md` (human) and `<date>.scores.json`
(machine). The next run reads the most recent prior `.scores.json` to fill the
**Δ vs prev** column, so improvement is *measured*, not asserted. To establish a
baseline, run the harness once before editing prompts and commit that report; run
it again after and commit the delta.

> Reports are generated, never hand-written. Do not fabricate scores — a
> fabricated report silently corrupts the only quality instrument the project has.

## Which tools currently receive the EQF level

The EQF adaptation directive rides inside `{{contextProfile}}`. A tool only sees it
if its prompt injects that placeholder. Today that is the context-injecting
(mostly instructor) tools: arcs-reactor, authentic-assessment, cognitive-architect,
guided-reflection, stage-assessment, and — after Phase 3 — contextualization,
forum-autograder, math-grading. The student-facing chat tutors
(mentorai, socratic-partner, scaffolding-feedback, peer-tutoring, think-pair-share,
dialogic-encounters, bloom-by-design) set `usesContextProfile: false` by design and
do **not** currently adapt to EQF — extending level-adaptation to them is a product
decision (attaching teaching context to student sessions), tracked as follow-up.
