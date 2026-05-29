# S7 — Chat tutors: Peer Tutoring (#11) + Scaffolding Feedback (#13)

**Goal:** author the final two chat tutors as **data** on the chat infrastructure built in S3.
Completing this session brings the tool count to **14**.

**Prerequisites:** S1 + **S3 (chat infra must be merged)**. No engine changes — pure data.
**Master plan:** `/Users/bastiaandressen/.claude/plans/can-you-make-a-atomic-bee.md` (Workstream F).
**Reference chat tool to copy:** MentorAI (from S3).

## Source material (`book/Pedagogical Promptbook.pdf`)
- **Peer Tutoring** — "Generative AI Peer Tutoring to Support Peer-Reviewed Source Identification
  and Evaluation".
- **Scaffolding Feedback** — "Scaffolding with Formative Feedback: A Deployable AI Tutoring Prompt
  System".
Confirm chat mode against each appendix prompt.

## Per tool (do twice, red → green → refactor)
1. **RED** — `tests/tools/<id>.test.ts`: resolves; `buildSystemPrompt` from sandbox inputs leaves
   no `{{…}}`; NL/EN placeholder parity.
2. **GREEN** — prompt files (`<id>.nl.md` / `<id>.en.md`), `PromptDef` (verbatim + runtime, registered
   in `prompts/index.ts`), and `Tool` (`mode: "chat"`, `chat: {...}` as `LocalizedText`, sandbox
   `inputs`, registered in `registry/index.ts`, `enabled: true`). Include *Voice & Bounds* boundaries.
3. **REFACTOR** — pure data; dedupe shared options only.

## Conventions (enforced)
- `LocalizedText` displayed; **option values = English slugs**, labels bilingual.
- All `{{placeholder}}`s sourced or `validate.ts` fails. Minors-safeguarding deferred (comment marker).

## Done when
- `npm test` green; `npm run typecheck` && `npm run check` green.
- In `npm run dev`: both tutors show greeting + starters and hold multi-turn exchanges with
  stop + regenerate.
- **All 14 tools now present and enabled** — sanity-check the home catalog lists 14.

## Start prompt
> Read `docs/implementation/S7-tutors-peer-scaffolding.md` and the master plan it references. Confirm
> S3's chat infra is present, then author the Peer Tutoring and Scaffolding Feedback chat tutors as
> data, test-first per the `/tdd` skill. Verify with `npm test`, `npm run typecheck`, `npm run check`,
> a multi-turn exchange in the running app, and that the catalog now lists all 14 tools.
