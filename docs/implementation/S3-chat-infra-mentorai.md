# S3 — Chat infrastructure + MentorAI (#1)

**Goal:** make multi-turn chat **fully functional** as a deep module, and prove it by shipping
the reference chat tool (MentorAI, from "From Model to Mentor: Cognitive Apprenticeship").

**Prerequisites:** S1. Independent of S2/S4 (can run in parallel) but **touches shared files**
(`api.stream.tsx`, `registry/types.ts`, `tool.tsx`) — land this before S5/S6/S7.
**Master plan:** `/Users/bastiaandressen/.claude/plans/can-you-make-a-atomic-bee.md` (Workstreams C + E-chat).

## What already exists (reuse — do not reinvent)
- `streamPost` (`app/lib/streamClient.ts`) — POST + AbortController + token/done/error SSE frames.
- `ChatMessage` type (`app/lib/ai/types.ts:12`) and `provider.streamChat({ messages })`
  (`app/lib/ai/provider.ts`) already accept a message array.
- `buildSystemPrompt` (`app/lib/template/buildSystemPrompt.ts`) is reused unchanged.
- `home.tsx` is already `mode`-aware, so a chat tool surfaces by `enabled: true` — no catalog change.

## Scope
### Infrastructure
- **types** — `app/lib/registry/types.ts`: refactor `ChatConfig.greeting`/`starters` from
  `string` → `LocalizedText`. Do **not** redefine `ChatMessage` (import from `ai/types`).
- **API** — `app/routes/api.stream.tsx`: add `messages?: ChatMessage[]` to `StreamBody`; branch on
  `tool.mode`. Chat: build the system prompt **once** from tool-level inputs (the "Task Sandbox") +
  context profile, then stream with the **full `messages` history**. One-shot/multi-stage: unchanged.
  Zod-validate the message array (roles, non-empty, length cap).
- **persistence** — save each completed transcript via `app/server/repositories/generations.server.ts`
  (or a `conversations` table in `schema.server.ts`) so chats show under `projects._index.tsx`.
- **route** — `app/routes/tool.tsx`: add the `ChatView` branch (currently only Generator/Stage).
- **i18n** — add chat UI strings to `app/lib/i18n/messages/nl.ts` + `en.ts` (parity test enforces both).

### UI — `app/components/ChatView.tsx`
Mirror `GeneratorView.tsx`: `ToolControls` + one-time sandbox `DynamicForm` + message thread
(markdown per turn) + composer + localized `greeting`/`starters` chips. Client loop: append user
turn → open empty assistant turn → stream tokens into it → re-POST full history next turn.
**Stop** (`allowStop`) aborts, keeps partial turn marked interrupted. **Regenerate**
(`allowRegenerate`) drops last assistant turn and re-sends. Graceful notice on very long threads.
Accessibility: `aria-live="polite"` thread, focus returns to composer after each turn, full keyboard path.

### Reference tool — MentorAI
Read the chapter appendix; author prompt files + `PromptDef` + `Tool` (`mode: "chat"`, with
`chat: { greeting, starters, allowStop, allowRegenerate }`). Include the book's *Voice & Bounds*
boundaries section in the prompt. Note (comment) that minors-safeguarding is deferred (hbo/adults now).

## TDD order
1. RED `tests/components/ChatView.test.tsx`: renders greeting/starters, send a message (mock
   `streamPost`/fetch), assistant turn streams in, stop + regenerate behave, `axe` = 0 violations.
2. GREEN the infra + component to pass.
3. RED `tests/tools/mentorai.test.ts` (registry/prompt validation) → GREEN by authoring the tool.
4. REFACTOR: keep the chat engine surface narrow; `ChatView` holds UI state, `api.stream` holds wiring.

## Done when
- `npm test` (incl. new `.tsx` + tool tests) green; `npm run typecheck` && `npm run check` green.
- In `npm run dev`: MentorAI shows greeting + starters, holds a multi-turn exchange, stop and
  regenerate work, transcript persists. (Live call needs `ANTHROPIC_API_KEY` or a local model.)

## Start prompt
> Read `docs/implementation/S3-chat-infra-mentorai.md` and the master plan it references. Build the
> multi-turn chat infrastructure and the MentorAI reference tool, test-first per the `/tdd` skill.
> Reuse `streamPost`, `ChatMessage`, and `provider.streamChat`. Verify with `npm test`,
> `npm run typecheck`, `npm run check`, and a multi-turn exchange in the running app.
