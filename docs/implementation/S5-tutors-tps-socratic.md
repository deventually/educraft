# S5 — Chat tutors: Think-Pair-Share (#3) + Socratic Partner (#14)

**Goal:** author two chat tutors as **data** on the chat infrastructure built in S3.

**Prerequisites:** S1 + **S3 (chat infra must be merged)**. No engine changes — pure data.
**Master plan:** `/Users/bastiaandressen/.claude/plans/can-you-make-a-atomic-bee.md` (Workstream F).
**Reference chat tool to copy:** MentorAI (from S3) — same `Tool` shape with `mode: "chat"`.

## Source material (`book/Pedagogical Promptbook.pdf`)
- **Think-Pair-Share** — "Rethinking Think-Pair-Share: Generative AI as a Collaborative Peer in
  Technology Education".
- **Socratic Partner** — "From Oracle to Socratic Partner: Redesigning Instruction with AI Through
  the Science of Learning".
Confirm each is chat (it should be). If a chapter is actually one-shot, model it as a generator instead.

## Per tool (do twice, red → green → refactor)
1. **RED** — `tests/tools/<id>.test.ts`: `getToolBySlug` resolves it; `buildSystemPrompt` from
   the sandbox inputs leaves no `{{…}}`; NL/EN placeholder parity. Optionally a
   `tests/components/<id>.test.tsx` smoke test reusing the MentorAI test pattern.
2. **GREEN** —
   - `app/lib/prompts/files/<id>.nl.md` + `<id>.en.md` (placeholders for every context value).
   - `app/lib/prompts/<id>.prompt.ts` (verbatim + runtime), registered in `prompts/index.ts`.
   - `app/lib/registry/tools/<id>.ts`: `mode: "chat"`, `chat: { greeting, starters, allowStop,
     allowRegenerate }` (all `LocalizedText`), tool-level `inputs` = the Task Sandbox; register in
     `registry/index.ts`; `enabled: true`. Include the book's *Voice & Bounds* boundaries section.
3. **REFACTOR** — keep pure data; extract shared option sets only if duplicated.

## Conventions (enforced)
- `LocalizedText` for displayed strings; **option `value`s = stable English slugs**, labels bilingual.
- Every `{{placeholder}}` sourced (inputs / injected / consumed) or `validate.ts` fails the build.
- Minors-safeguarding stays deferred (audience is hbo/adults); leave a comment marker per tool.

## Done when
- `npm test` green (new tool tests); `npm run typecheck` && `npm run check` green.
- In `npm run dev`: each tutor shows greeting + starters and holds a multi-turn exchange with
  stop + regenerate working.

## Start prompt
> Read `docs/implementation/S5-tutors-tps-socratic.md` and the master plan it references. Confirm S3's
> chat infra is present, then author the Think-Pair-Share and Socratic Partner chat tutors as data,
> test-first per the `/tdd` skill (copy the MentorAI tool shape). Verify with `npm test`,
> `npm run typecheck`, `npm run check`, and a multi-turn exchange in the running app.
