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
ANTHROPIC_API_KEY=sk-… npm run eval -- --judge-model <model-id>  # default judge: the app default (config/models.json)
ANTHROPIC_API_KEY=sk-… npm run eval -- --tool mentorai --runs 3   # mean + spread
ANTHROPIC_API_KEY=sk-… npm run eval -- --tool mentorai,guided-reflection --label d  # one report, evals/reports/<date>d.md
ANTHROPIC_API_KEY=sk-… npm run eval -- --tool rubric-builder --batch   # half price, Message Batches API
npm run eval -- --cases-only     # regenerate raw outputs, skip the judge
npm run eval -- --judge-only     # re-judge the latest raw outputs, skip generation
```

### Without an API key: Claude Code on a subscription

`claude-code::<model>` runs every call through Claude Code (`claude -p`) on the signed-in
Claude subscription, pinned to that model. It sends the app's request, not Claude Code's own:
our system prompt replaces Claude Code's, tools, `CLAUDE.md`, skills, hooks and MCP are off, and
the model's effort and answer budget come from `config/models.json`
(`app/lib/ai/adapters/cli.ts`). A cut-off answer is still seen (`stop_reason`).

```bash
npm run eval -- --tool lesson-plan --runs 3 \
  --model claude-code::claude-sonnet-5-5 --judge-model claude-code::claude-sonnet-5-5 --label cc
```

- No `ANTHROPIC_API_KEY`, and no `--batch` (that is the API's half price). The calls run one
  after another, so a `--runs 3` of one tool takes roughly half an hour to an hour.
- A worker session in the cloud is signed in too, so it can run the eval itself and commit the
  report in its PR.
- What still differs from the app: temperature cannot be set, and Claude Code adds a short
  prompt of its own (about 1,400 tokens). The report's model column says
  `claude-code::…`, so compare it with an API report of the same prompt version once
  (`--runs 3`); a difference smaller than the spread is noise.
- Images (`imagePath` cases, math-grading) are not sent through the CLI.

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

## Hard checks (yes/no, with a cap)

A judge scores a 1–5 scale leniently: in the second measurement (2026-11-04) it gave
an empty answer 3.6. A rubric can therefore add a `## Hard checks` section, one line
per check:

```
- **gaveAnswer** (cap 2): Did the mentor state the final answer to the student's own task?
```

A check marked `counted` — `- **longTurn** (cap 3, counted): …` — is decided in code
(`COUNTED_CHECKS`: words, question marks, lists and headings per tutor turn, the fixed
greeting excluded), because in meting e the judge failed a 118-word turn as "over 150
words". Only checks that need judgement go to the judge.

The judge answers each check true (the failure happened) or false. A failed check
caps **every** score at its cap, in code (`applyHardChecks`), so a good-looking
conversation that hands over the answer still scores at most 2. The report lists
the failed checks per case. Concrete yes/no questions are what the Promptbook
recommends for LLM judges (p. 17–18). A test checks that every check line parses.

A cut-off answer (the model hit its token limit) is capped at 3 on every criterion
(`capTruncated`): in meting d a guided-reflection lesson that stopped mid-text still
got 4.67 from the judge.

## Several runs (`--runs N`)

The same case varies from run to run (Authentic Assessment: 14.7k vs 22k
characters). `--runs 3` generates and judges each case three times; the report shows
the mean per criterion and the spread of the run averages (`3 (4.20–4.80)`). Run 1
is written as `<case>.md`, later runs as `<case>.run2.md` etc. Use `--runs 3` for a
before/after measurement of a prompt change: a difference smaller than the spread
is noise.

Intermediate rounds use one run; only the final measurement of a tool uses
`--runs 3` (BESLUIT-2026-11-04-25).

## Half price (`--batch`)

`--batch` sends every one-shot stage and every judge call through the Anthropic
Message Batches API, which costs half (`scripts/eval-batch.ts`). All cases and runs
start at once, so all first stages share one batch, all second stages the next, and
all judge calls the one after. A batch usually ends well within an hour; the script
polls every 30 seconds. The request is the one the app sends (same model, system
prompt, messages and output budget; temperature only for models that accept it,
as the AI SDK does). Chat tools keep the direct API,
because every turn waits on the previous one; their judging is still batched.

```bash
npm run eval -- --tool test-items --runs 3 --batch --label q
```

## Another model (`--model`)

The prompts were tuned on Claude. To see how another model does on the same cases,
`--model` makes that model answer every stage of every case, while the judge stays the
same (`--judge-model`, Claude by default), so the scores are comparable:

```bash
npm run eval -- --tool mentorai,socratic-partner,test-items --model gpt-6.1-sol --runs 3 --label gpt
npm run eval -- --tool mentorai --model ollama::qwen3:32b --label qwen   # a local model
npm run eval -- --tool mentorai --model gpt-6.1-sol --dry-run            # free: checks the id
```

- The id is one from `config/models.json` (or `ollama::…`, `compat::…`); an unknown id
  stops the run before any call. The generating model's key must be in `.env`
  (e.g. `OPENAI_API_KEY`), plus `ANTHROPIC_API_KEY` for the judge.
- Use a `--label`, so the report does not land on top of a Claude report of the same day.
  The report's model column shows which model answered.
- `--batch` still halves the judge's cost; another model's answers go through its own
  API, because the Message Batches API is Anthropic's.
- Compare against a Claude measurement of the same tools with `--runs 3`; a difference
  smaller than the spread is noise. Where to look first: the hard checks of the chat
  tutors (giving the answer away, more than one question per turn).
- `--model` is for `npm run eval` only. The separate runners (`eval:coach`, `eval:import`,
  `eval:agents`, `eval:rehearsal`), which test the JSON answers, still use their own model.

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

## Portfolio coach (`npm run eval:coach`)

The BDB/BKE coach (brief P25, 25.5) is not a registry tool and has its own runner,
`scripts/eval-coach.ts`. It runs the real coach prompt and the real code checks
(`app/lib/portfolio/coach.ts`) on `evals/portfolio-coach/cases.json`: synthetic chapters
whose flaw is known. Scoring is **deterministic** (no judge): per criterion the expected
verdicts, plus no unverified quotes and, per case, the evidence that must be named. See
`evals/portfolio-coach/rubric.md`.

```bash
ANTHROPIC_API_KEY=sk-… npm run eval:coach                       # public cases
ANTHROPIC_API_KEY=sk-… EVALS_PRIVATE_DIR=/pad/naar/map npm run eval:coach -- --repeat 3
npm run eval:coach -- --dry-run                                 # build messages only
```

**Private cases** live outside the repo in `EVALS_PRIVATE_DIR` (`*.json`, same shape as
`cases.json`). The report (`evals/reports/<date>-portfolio-coach.md`) names only their case
ids and scores. `tests/lib/eval-coach.test.ts` fails when a file name from that folder shows
up under `evals/`.

## Proeflezer (`npm run eval:proofread`)

De proeflezer van het BDB/BKE-dossier (`portfolio-proofread@v1`) is geen catalogustool en heeft een
eigen runner, `scripts/eval-proofread.ts`. Hij draait de echte prompt en de echte controle
(`parseProofread`) op synthetische hoofdstukken met ingeplante taalfouten
(`evals/portfolio-proofread/cases.json`). De score is **deterministisch**: elke ingeplante fout
gevonden en verbeterd, geen weggevallen voorstellen (een citaat dat niet letterlijk in het hoofdstuk
staat), feiten intact, en een goed hoofdstuk krijgt hooguit twee voorstellen. Zie
`evals/portfolio-proofread/rubric.md`.

```bash
ANTHROPIC_API_KEY=sk-… npm run eval:proofread                   # elke case één keer
ANTHROPIC_API_KEY=sk-… npm run eval:proofread -- --repeat 3     # consistentie
npm run eval:proofread -- --dry-run                             # alleen de berichten bouwen
```

## Cursusevaluatie (`npm run eval:evaluation`)

De cursusevaluatie (`course-evaluation@v1`, brief P33.2) maakt van een geanonimiseerde enquête
thema's, problemen op hun plek en drie tot vijf verbeterpunten. Vijf fictieve cases, waaronder de
naam van een docent, een uitschieter van één student, tien respondenten met een toetsanalyse en
een ingebedde opdracht. De score is deterministisch; zie `course-evaluation/rubric.md`.

```bash
ANTHROPIC_API_KEY=sk-… npm run eval:evaluation                  # elke case één keer
ANTHROPIC_API_KEY=sk-… npm run eval:evaluation -- --repeat 3    # eindmeting
npm run eval:evaluation -- --dry-run                            # alleen de berichten bouwen
```

## Proefassessment (`npm run eval:rehearsal`)

Het proefassessment (brief P29, 29.2) is geen catalogustool en heeft een eigen runner,
`scripts/eval-rehearsal.ts`. Hij speelt de echte prompt (`portfolio-rehearsal@v2`) tegen een
gescripte docent op synthetische dossiers (`evals/portfolio-rehearsal/cases.json`), draait de echte
controle op de feedback (`parseRehearsalFeedback`) en laat een beoordelaar het hele gesprek scoren
tegen `evals/portfolio-rehearsal/rubric.md`. Drie harde checks worden in code geteld
(`REHEARSAL_COUNTED`: meer dan één vraag per beurt, buiten citaten; feedback niet leesbaar; een
verzonnen citaat). Het gesprek zelf gaat nooit via een batch; `--batch` geldt alleen voor de
beoordelaar.

```bash
ANTHROPIC_API_KEY=sk-… npm run eval:rehearsal                   # elke case één keer
ANTHROPIC_API_KEY=sk-… npm run eval:rehearsal -- --runs 3 --batch   # eindmeting
npm run eval:rehearsal -- --dry-run                             # alleen de prompts bouwen
```

## OER-import (`npm run eval:import`)

De import van leeruitkomsten en toetsen (brief P26, 26.3) is geen registry-tool en heeft een eigen
runner, `scripts/eval-import.ts`. Hij draait de echte prompt `course-import@v1` en de echte controle
(`app/lib/courses/import.ts`) op `evals/course-import/cases.json`: zelf geschreven, fictieve
fragmenten van een OER of studiehandleiding. De score is **deterministisch** (geen beoordelaar):
geldig JSON, niets verzonnen, alles letterlijk. Zie `evals/course-import/rubric.md`.

```bash
ANTHROPIC_API_KEY=sk-… npm run eval:import                  # elke case één keer
ANTHROPIC_API_KEY=sk-… npm run eval:import -- --repeat 3    # eindmeting
npm run eval:import -- --dry-run                            # alleen de berichten bouwen
```
