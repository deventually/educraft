# S6 — Chat tutors: Bloom by Design (#10) + Dialogic Encounters (#5)

**Goal:** author two chat tutors as **data** on the chat infrastructure built in S3.

**Prerequisites:** S1 + **S3 (chat infra must be merged)**. No engine changes — pure data.
**Master plan:** `/Users/bastiaandressen/.claude/plans/can-you-make-a-atomic-bee.md` (Workstream F).
**Reference chat tool to copy:** MentorAI (from S3).

## Source material (`book/Pedagogical Promptbook.pdf`)
- **Bloom by Design** — "Bloom by Design: Prompt Engineering an AI Chatbot for Constructive
  Alignment of Outcomes and EdTech" (titled a chatbot → chat).
- **Dialogic Encounters** — "Dialogic Encounters with Learning Theorists: Using AI Role-Play to
  Teach Pre-Service Teachers" (role-play; the sandbox selects which theorist/persona to embody).
Confirm chat mode against each appendix prompt.

## Per tool (do twice, red → green → refactor)
1. **RED** — `tests/tools/<id>.test.ts`: resolves; `buildSystemPrompt` from sandbox inputs leaves
   no `{{…}}`; NL/EN placeholder parity. For Dialogic Encounters, assert the persona/theorist
   selection input flows into the prompt.
2. **GREEN** — prompt files (`<id>.nl.md` / `<id>.en.md`), `PromptDef` (verbatim + runtime, registered
   in `prompts/index.ts`), and `Tool` (`mode: "chat"`, `chat: {...}` as `LocalizedText`, sandbox
   `inputs`, registered in `registry/index.ts`, `enabled: true`). Include *Voice & Bounds* boundaries.
3. **REFACTOR** — pure data; dedupe shared options only.

## Conventions (enforced)
- `LocalizedText` displayed; **option values = English slugs**, labels bilingual.
- All `{{placeholder}}`s sourced or `validate.ts` fails. Minors-safeguarding deferred (comment marker).

## Done when
- `npm test` green; `npm run typecheck` && `npm run check` green.
- In `npm run dev`: both tutors show greeting + starters and hold multi-turn exchanges; for Dialogic
  Encounters the chosen theorist persona is reflected in responses.

## Start prompt
> Read `docs/implementation/S6-tutors-bloom-dialogic.md` and the master plan it references. Confirm S3's
> chat infra is present, then author the Bloom by Design and Dialogic Encounters chat tutors as data,
> test-first per the `/tdd` skill. Verify with `npm test`, `npm run typecheck`, `npm run check`, and a
> multi-turn exchange in the running app.
