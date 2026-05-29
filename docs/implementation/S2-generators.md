# S2 — Generators: Forum Autograder (#6) + Contextualization (#2)

**Goal:** author the two remaining **one-shot generators** test-first on the existing
runtime. Doing both together nails the generator recipe as the copy-me template and clears
all generators except image-based Math Grading (that's S4).

**Prerequisites:** S1 (test harness + `/tdd` skill). No new infrastructure needed.
**Master plan:** `/Users/bastiaandressen/.claude/plans/can-you-make-a-atomic-bee.md` (Workstreams E-gen + F-gen).
**Recipe:** `wiki/Adding-a-Tool-or-Pack.md`; reference implementation: `app/lib/registry/tools/arcs-reactor.ts`.

## Source material
Read these chapters from `book/Pedagogical Promptbook.pdf` for the verbatim appendix prompts:
- **Forum Autograder** — "AI-Supported Forum Autograder: A Community of Inquiry Approach".
- **Contextualization** — "Making Pedagogical Intent Visible: AI-Supported Contextualization
  in Higher Education Course Design".
Confirm each is genuinely one-shot (it should be — both produce a single artifact). If a
chapter reads as multi-stage, model it with chained `stages[]` + `consumes` like Cognitive Architect.

## Per tool (do twice, red → green → refactor)
1. **RED** — `tests/tools/<id>.test.ts`: `getToolBySlug` resolves it; `buildSystemPrompt`
   with representative inputs contains the right anchors and leaves no `{{…}}`; required
   fields enforced; NL/EN placeholder parity.
2. **GREEN** —
   - `app/lib/prompts/files/<id>.nl.md` + `<id>.en.md` (placeholders for every context value;
     end with the output-language line like the existing prompt files).
   - `app/lib/prompts/<id>.prompt.ts` — `verbatim` (exact appendix text) + `runtime: { nl, en }`
     loaded via `?raw`; register in `app/lib/prompts/index.ts`.
   - `app/lib/registry/tools/<id>.ts` — `inputs` + single `stages[0]`, `attribution(...)` with
     the chapter's title/authors/pages; register in `app/lib/registry/index.ts`. Set `enabled: true`.
3. **REFACTOR** — extract shared option sets/groups only if duplicated; keep the tool pure data.

## Conventions (enforced)
- Displayed text is `LocalizedText`; **option `value`s are stable English slugs**, labels bilingual.
- Every prompt `{{placeholder}}` must be sourced from `inputs`, injected (`contextProfile`,
  `outputLanguage`), or a consumed prior stage — `validate.ts` will fail the build otherwise.

## Done when
- `npm test` green (existing suites + the two new `tests/tools/*.test.ts`).
- `npm run typecheck` && `npm run check` green.
- Both tools appear on the home catalog (auto via `getEnabledTools`) and generate streamed
  markdown end-to-end (`npm run dev` + preview tools; live call needs `ANTHROPIC_API_KEY` or a
  local model).

## Start prompt
> Read `docs/implementation/S2-generators.md` and the master plan it references. Implement the
> Forum Autograder and Contextualization generators test-first per the `/tdd` skill. Verify with
> `npm test`, `npm run typecheck`, `npm run check`, then confirm each generates in the running app.
