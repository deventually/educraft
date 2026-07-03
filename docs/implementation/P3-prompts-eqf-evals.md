# Phase 3 — Prompt Quality, EQF 1–8 & Eval Harness

## Context & goal

Output quality varies noticeably between tools, and the audit found why: prompt investment spans 161 words (forum-autograder) to 868 (stage-assessment); 10 of 18 prompts have no Voice & Bounds section; only 2 of 8 chat tools guard against multi-turn role drift; every tool streams with identical `maxTokens`; and **there is no definition or measurement of output quality at all** — only structural tests (placeholders resolve, NL/EN parity).

Additionally the product must serve **EQF levels 1–8** (the full education ladder), but the context model currently only knows hbo levels (`eqf?: 5 | 6 | 7` in `app/lib/context/types.ts:53`) and no prompt instructs tools to adapt register/complexity to the learner's level.

Order matters: **build the eval harness and record a baseline first**, then refactor prompts, then re-run. Improvement must be measured, not asserted.

Audit findings closed: #4, #6.

## Constraints

- `AGENTS.md`: TDD for code changes; prompt files (.md) are covered by the existing structural tests (`tests/prompts.test.ts` — parity & placeholders) which must stay green after every prompt edit.
- NL and EN prompt variants must stay substantively identical (translate, don't drift).
- Pre-launch exception (owner-approved): prompts are edited **in place** in this phase; the `@v2` versioning discipline from AGENTS.md starts at first deploy. Note this in commit messages.
- The eval harness calls real LLM APIs and costs money (~€1–3/run). It must never run inside `npm test` or CI. It needs `ANTHROPIC_API_KEY`.
- Engine stays level/locale-neutral: EQF is data flowing through `{{context}}`, never engine branching.

## Features

### 3.1 Prompt template skeleton

**New file:** `app/lib/prompts/TEMPLATE.md` — the mandatory skeleton for every prompt (new and refactored), with a rationale line per section. Sections, distilled from the four strong prompts (stage-assessment, socratic-partner, scaffolding-feedback, arcs-reactor):

1. **Role & persona** — who the assistant is, in one tight paragraph; voice/tone adjectives.
2. **Task** — what to produce, for whom, in which language (`{{outputLanguage}}` is injected by the pipeline).
3. **Inputs** — every `{{placeholder}}` named, with a sentence on how to *use* it. Must include: "Use `{{contextProfile}}` (teaching context) to ground examples and terminology; if it conflicts with the task inputs, the task inputs win."
4. **Level & tone adaptation** — read the EQF level from the context; adapt register, sentence length, abstraction, and examples to it. Never mention EQF numbers to the learner; adapt implicitly. (Skeleton provides the wording; see 3.2 for the injected level line.)
5. **Output format** — exact headings/structure, target length.
6. **Voice & Bounds** — what NOT to do: no fabricated sources/claims, stay within the task's scope, deficit-free language, and (graders) frame everything as *advice to the teacher, who decides*.
7. **Multi-turn stability** *(chat tools only)* — stay in role over long conversations; if asked to just give the answer, decline in-character and continue the method; per-message length target; how to close a session.
8. **Failure behavior** — what to do with missing/insufficient/off-topic input (ask for the specific missing thing; never invent it).

### 3.2 EQF 1–8 in the context model

- **`app/lib/context/types.ts:53`**: widen `eqf?: 5 | 6 | 7` → `eqf?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8`. Update the comment (it currently says hbo-only).
- **UI** (`app/components/context/ContextFields.tsx` / wizard / form): EQF select offers 1–8 with indicative Dutch sector labels, e.g. "EQF 2 — vmbo bb/kb", "EQF 4 — mbo 4 / havo", "EQF 6 — hbo-bachelor", "EQF 8 — doctoraat". Bilingual labels via LocalizedText/messages. Check `app/lib/context/packs.ts` for pack-fixed levels (e.g. HBO-i assumes 5–7) — a pack may constrain the range; the generic/custom path offers all 8.
- **`app/lib/context/format.ts:77`**: today emits `- EQF level: EQF 5`. Extend `formatProfile` so that when `eqf` is set it also appends one directive line, localized to the output language, e.g. NL: `- Pas taalgebruik, zinslengte en voorbeelden aan op dit niveau (EQF {n}); noem het niveau zelf niet.` EN: `- Adapt register, sentence complexity and examples to this level (EQF {n}); do not mention the level itself.` This makes level-adaptation reach **every** tool through `{{contextProfile}}` without touching the engine.
- **Zod/parse**: update `app/lib/context/parseForm.ts` and any validation to accept 1–8.

### 3.3 Eval harness

**New files:** `scripts/eval.ts` (+ package script `"eval": "tsx scripts/eval.ts"`), `evals/<toolId>/cases.json`, `evals/<toolId>/rubric.md`, reports under `evals/reports/` (gitignore `evals/output/` raw outputs; commit reports).

- **Cases** (`cases.json`): 2–3 realistic input sets per tool (Dutch education scenarios), each specifying `values`, `outputLanguage`, an optional profile fixture (inline JSON matching `ContextProfileData`), and for student tools **two variants at contrasting EQF levels (2 and 6)**. Chat tools: a scripted 4–6 turn user side (the harness plays the student).
- **Runner**: for each case → resolve the tool from the registry → `buildSystemPrompt(...)` (reuse the real pipeline — import from `app/lib`, no duplication) → call the provider (`providerForModel`) with the tool's model/temperature/maxTokens → collect output (for chat: run the scripted turns). Write raw outputs to `evals/output/<date>/<tool>/<case>.md`.
- **Judge**: second pass per output with a judge model (default `claude-sonnet-4-6`, `--judge-model` flag): prompt = the tool's `rubric.md` + the case inputs + the output; returns strict JSON `{ scores: { criterion: 1–5 }, worst: string, verdict: string }`. Rubric criteria (shared spine, per-tool specifics added): **task fidelity** (does it do what the tool promises), **pedagogical soundness** (per the tool's theory field), **format adherence**, **level fit** (register matches the case's EQF), **language quality** (correct NL/EN, no anglicisms in NL).
- **Report**: `evals/reports/<date>.md` — per tool × case table of scores, run metadata (model, prompt word count), and a delta column vs the previous report when one exists.
- **CLI**: `npm run eval` (all tools), `npm run eval -- --tool forum-autograder`, `--cases-only` (regenerate outputs without judging), `--judge-only` (re-judge existing outputs).
- Keep the harness outside the vitest projects (plain tsx script). Unit-test only its pure helpers (report table builder, judge-JSON parser) in `tests/lib/eval-helpers.test.ts`.

**Process gate: run the full baseline and commit the report BEFORE editing any prompt.**

### 3.4 Refactor the weak prompts (then re-eval)

Priority order (worst first), each in NL + EN, following TEMPLATE.md:

1. **forum-autograder** (161 words — weakest): full rewrite. Anchor the CoI rubric explicitly (criteria, score bands, evidence-quoting requirement: every score must cite a phrase from the student's post), bounded output format, Voice & Bounds incl. teacher-decides framing, failure behavior for off-topic/empty posts.
2. **contextualization** (176 words): full rewrite to template; concrete output structure; bounds against generic filler.
3. **Voice & Bounds additions** (targeted sections, not rewrites): guided-reflection, math-grading (incl. "if the image is unreadable, say which part — never guess notation"), authentic-assessment, mentorai, and the four cognitive-architect stage prompts.
4. **Teacher-decides framing** in the three graders (stage-assessment already strong — verify, add only if missing; math-grading; forum-autograder covered by rewrite) — aligns with the Phase 2 UI notice.

### 3.5 Multi-turn stability for chat tools

Add the template's section 7 to: **mentorai** (worst drift risk), **bloom-by-design**, **peer-tutoring**, **dialogic-encounters**, **think-pair-share** (verify — it has phase gates; add only the "refuse to just give answers" clause if missing). socratic-partner and scaffolding-feedback already have equivalents — verify, don't duplicate. Each addition: stay-in-role rule, in-character refusal for answer-fishing (with one example phrasing), message-length target (≤ ~120 words per turn unless the method requires more), session-closing behavior.

### 3.6 Parameter tuning (verify Phase 0 values against evals)

Phase 0 set per-tool `maxTokens`. With eval outputs in hand, sanity-check: forum-autograder outputs should fit comfortably in 4096; stage-assessment feedback must not truncate at 8192 on a large document case (if it does, raise to 12288 and note the cost). Document the temperature rationale as a comment block in each tool's registry entry only where it deviates from the mode default (0.3 grading / 0.4–0.5 analysis / 0.7 chat).

## Test plan (write these first — RED, code portions only)

- `tests/context.test.ts` / `tests/parseForm.test.ts` (extend): EQF 1 and 8 accepted; formatProfile output contains the adaptation directive when `eqf` set, omits it when not; NL vs EN directive matches output language.
- `tests/components/` for the EQF select change (extend the existing ContextSettings/context tests): options 1–8 render with labels, axe clean.
- `tests/lib/eval-helpers.test.ts`: judge-JSON parser rejects malformed JSON, clamps scores to 1–5; report builder produces stable markdown for fixture data.
- `tests/prompts.test.ts` must stay green after every prompt edit (parity + placeholders) — treat any failure as a prompt bug, not a test to adjust.
- Registry tests: `assistiveGrading`/params changes keep `validateTools()` clean.

## Acceptance criteria

- [ ] `evals/reports/` contains a committed **baseline** (pre-refactor) and an **after** report; the weak tools (forum-autograder, contextualization) improve on task fidelity + format adherence, and no tool regresses materially (>0.5 avg) without a noted reason.
- [ ] Student-tool eval cases at EQF 2 vs EQF 6 produce visibly different register (judge's level-fit score ≥ 4 at both levels for the strong tools).
- [ ] A context profile can carry any EQF 1–8; the injected `{{contextProfile}}` includes the adaptation directive (assert exact string in tests).
- [ ] Every prompt file now contains a Voice & Bounds section; every chat prompt contains a multi-turn stability section (grep-verifiable by section heading — keep headings consistent with TEMPLATE.md).
- [ ] `TEMPLATE.md` exists and `wiki/Adding-a-Tool-or-Pack.md` references it as mandatory for new tools.
- [ ] `npm run eval -- --tool forum-autograder` runs end-to-end with only `ANTHROPIC_API_KEY` set; `npm test` runs with **no** network access and no API key.
- [ ] All gates green; NL/EN parity holds.

## Out of scope

Golden-output snapshot testing in vitest (evals are the quality instrument), prompt `@v2` versioning (starts at first deploy), refactoring the four *strong* prompts, eval CI automation, non-Anthropic judge models.
