# Phase 0 — Security Hardening (deploy blockers)

## Context & goal

`/api/stream` (`app/routes/api.stream.tsx`) is the app's only expensive endpoint: it streams LLM output billed to the owner's API keys. Today it accepts any POST from anyone: the body is cast (`as StreamBody`, line 49) instead of validated, `body.model` lets a caller force any resolvable model including Opus-class (lines 69–70), there are no input length caps, no rate limits, and no concurrency limits. There is also no CI enforcing the project's quality gates, no security headers, an unpatched `drizzle-orm` advisory, and hardcoded EN/NL error strings inside the route.

This phase makes the endpoint abuse-resistant *before* authentication exists (Phase 1 adds auth on top) and puts the quality gates under CI.

Audit findings closed: #1 (partially — Phase 1 completes it), #3, #5, #10, #11, #13 (server half).

## Constraints

- Follow `AGENTS.md`: TDD (failing test first), gates green before done, i18n for all user-facing strings, no per-tool control flow.
- Do not change the SSE wire format (`app/lib/ai/sse.ts`) — the client (`app/lib/streamClient.ts`) depends on it. Errors keep flowing as SSE error events with a 200 response, as today.
- Do not add authentication in this phase (Phase 1).
- Single-instance deployment is a given; in-memory rate limiting is sound. Do not add Redis.

## Features

### 0.1 Zod validation of the stream body

**File:** `app/routes/api.stream.tsx`. Replace the `StreamBody` interface + cast with a Zod schema (keep a `type StreamBody = z.infer<typeof StreamBodySchema>` export if the type is referenced elsewhere).

```ts
const MAX_VALUE_CHARS = 20_000;      // per form field (documents land here as text)
const MAX_VALUES_KEYS = 40;
const MAX_MESSAGE_CHARS = 20_000;    // per chat message
const MAX_MESSAGES = 100;
const MAX_PRIOR_OUTPUT_CHARS = 60_000; // multi-stage outputs can be long

const TemplateValueSchema = z.union([
  z.string().max(MAX_VALUE_CHARS),
  z.number(),
  z.boolean(),
  z.array(z.string().max(MAX_VALUE_CHARS)).max(50),
]);

const StreamBodySchema = z.object({
  slug: z.string().min(1).max(100),
  stageId: z.string().max(100).optional(),
  values: z.record(z.string().max(100), TemplateValueSchema)
    .refine((v) => Object.keys(v).length <= MAX_VALUES_KEYS)
    .optional(),
  contextProfileId: z.string().max(100).nullish(),
  outputLanguage: z.enum(["nl", "en"]).optional(),
  priorOutputs: z.record(z.string().max(100), z.string().max(MAX_PRIOR_OUTPUT_CHARS)).optional(),
  model: z.string().max(200).optional(),
  messages: z.array(ChatMessageSchema.extend({ content: z.string().max(MAX_MESSAGE_CHARS) }))
    .max(MAX_MESSAGES).optional(),
  sessionId: z.string().min(8).max(100).optional(),
  images: z.array(ImageInputSchema).max(10).optional(),
});
```

- Check `TemplateValues` in `app/lib/template/interpolate.ts` for the exact value union and align `TemplateValueSchema` with it.
- On parse failure: return `sseError` with a **localized** message (new `error.invalidRequest` key, see 0.7). Do not echo Zod details to the client; `console.error` them server-side.
- The existing inline image-count check (`validated.data.length > 10`, lines 97–103) moves into the schema. Keep the vision-capability check (`supportsImages`) where it is.
- Also guard the raw body size: if `request.headers.get("content-length")` exceeds ~25 MB (images are base64), reject early with the same localized error. (10 images × ~1.9 MB base64 ≈ 19 MB + text.)

### 0.2 Server-side model allow-list

Callers must not be able to force expensive models. **Files:** `app/lib/ai/models.ts`, `app/routes/api.stream.tsx`.

- Add `clientSelectable: boolean` to `ModelInfo` and set it on every catalog entry: `claude-haiku-4-5` ✅, `claude-sonnet-4-6` ✅, `claude-opus-4-8` ❌ (reachable only via a tool/stage default), CLI agents (`claude-code`, `opencode`, `codex`, `gemini-cli`) ✅ (they run on the caller's own machine in dev; they cost the owner nothing).
- Dynamic local models (`ollama::…`, `lmstudio::…` via `parseDynamicModel`) remain selectable — they are free local inference.
- Add `isClientSelectable(id: string): boolean` beside `isResolvableModel`.
- In `api.stream.tsx` replace the model resolution:

```ts
const model =
  body.model && isResolvableModel(body.model) && isClientSelectable(body.model)
    ? body.model
    : (stage.model ?? tool.defaultModel);
```

- Update `pickableModels()` (used by every model picker) to filter on `clientSelectable` so the UI never offers a model the server will silently swap. In Phase 4 this hardcoded flag becomes the *default* for an admin-configurable list — keep the check in one exported function so Phase 4 swaps its implementation, not its call sites.

### 0.3 Rate limiting

**New file:** `app/server/rateLimit.server.ts` — a small in-memory limiter, unit-testable, no dependencies:

```ts
interface RateLimiterOptions { windowMs: number; max: number; maxConcurrent: number; }
export function createRateLimiter(opts: RateLimiterOptions): {
  /** Throws/returns refusal when over budget. Call release() when the stream ends. */
  acquire(key: string): { ok: true; release: () => void } | { ok: false; retryAfterMs: number };
}
```

- Sliding or fixed window is fine; keep it simple (timestamps array per key, pruned on access). Evict idle keys to avoid unbounded memory.
- Defaults: `10` requests/min, `3` concurrent streams per key. Read overrides from env (`RATE_LIMIT_PER_MINUTE`, `RATE_LIMIT_CONCURRENT`) via `app/server/env.server.ts` (add as `z.coerce.number()` with defaults).
- Key in `api.stream`: client IP (`x-forwarded-for` first value, fallback `x-real-ip`, fallback `"local"`) + `:` + `sessionId ?? ""`. After Phase 1, the key becomes the userId — leave a `// Phase 1: key by userId` note.
- `release()` must be called when the stream completes **or** errors **or** the client disconnects — wire it into the `sseStream` completion/error paths (see `app/lib/ai/sse.ts` for the hooks; extend `onComplete`/add `onFinally` if needed).
- Over-limit response: localized `error.rateLimited` via `sseError` (the client already renders SSE errors).

### 0.4 Per-tool maxTokens

All tools currently stream with a universal 8192 cap (`DEFAULT_MAX_TOKENS`, `app/lib/ai/adapters/aisdk.ts:9`). **Files:** `app/lib/registry/types.ts`, `app/lib/ai/provider.ts` (StreamChatOptions type — verify where `opts.maxTokens` originates), `app/routes/api.stream.tsx`, all `app/lib/registry/tools/*.ts`.

- Add `maxTokens?: number` to `ToolStage` and `defaultMaxTokens?: number` to `Tool` (mirroring the existing `temperature` / `defaultTemperature` pattern).
- Thread through the call in `api.stream.tsx`: `maxTokens: stage.maxTokens ?? tool.defaultMaxTokens` into `provider.streamChat({...})`. The aisdk adapter already honors `opts.maxTokens`.
- Set values (rationale: grading/feedback outputs are bounded; chat turns should be short; design documents are long):
  - Chat tools (mentorai, socratic-partner, peer-tutoring, scaffolding-feedback, think-pair-share, dialogic-encounters, bloom-by-design): **2048**
  - Graders (forum-autograder, math-grading): **4096**; stage-assessment: **8192** (long feedback on large documents)
  - One-shot designers (contextualization, guided-reflection, authentic-assessment, arcs-reactor): **6144**
  - cognitive-architect stages: **6144**
- Registry validation (`app/lib/registry/validate.ts`): reject non-positive or absurd (> 32k) values.

### 0.5 Dependency patch

- `npm install drizzle-orm@^0.45.2` (GHSA-gpj5-g38j-94v9). Run the full gate; the query API is unchanged in that range, but verify `drizzle-kit` compatibility (`npm run db:generate` should still run).

### 0.6 Security headers

**File:** `app/entry.server.tsx` — set on `responseHeaders` in `handleRequest` (both bot and browser branches if split):

- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- `Content-Security-Policy-Report-Only` (report-only until verified in the browser): `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'`. Note: `root.tsx` loads Google Fonts; React Router injects inline scripts for hydration — hence `'unsafe-inline'` for scripts initially (tightening to nonces is out of scope). Verify in dev tools that no report-only violations fire during a full click-through, then keep as report-only; the switch to enforcing happens in Phase 2's deploy checklist.

### 0.7 i18n for api.stream error strings

The route builds EN/NL strings inline (lines 79–103: vision-model error, invalid image format, too many images; line 114: `"Invalid message format"`). Move them to `app/lib/i18n/messages/{nl,en}.ts` under the existing `error` section (e.g. `error.modelNoVision`, `error.invalidImages`, `error.tooManyImages`, `error.invalidMessages`, plus new `error.invalidRequest`, `error.rateLimited`). The route already resolves `m = getMessages(locale)` — use it. For the vision error's model name, use a `{model}` substitution consistent with how other messages interpolate (check existing message usage; simple `.replace("{model}", …)` is acceptable if no helper exists).

### 0.8 CI

**New file:** `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24.14.1", cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run typecheck
      - run: npm run check
```

After merging, enable branch protection on `main` requiring the `ci` check (owner does this in GitHub settings — note it in the PR/commit message).

## Test plan (write these first — RED)

New file `tests/api/stream-validation.test.ts` (node project; mock the provider like `tests/api/stream-images.test.ts` does — read that file first and reuse its harness):
1. Body that is not JSON / missing `slug` → response is an SSE error frame, no provider call.
2. `values` with a 30k-char string → SSE error, no provider call.
3. `messages` array of 101 items → SSE error.
4. `body.model: "claude-opus-4-8"` (resolvable but not client-selectable) → provider called with the tool's default model, not opus.
5. `body.model: "claude-haiku-4-5"` → provider called with haiku (allow-list passes).

New file `tests/lib/rateLimit.test.ts`:
6. 10 acquisitions in a window succeed, the 11th refuses with `retryAfterMs > 0`.
7. `maxConcurrent` refuses a 4th un-released acquire; after `release()` it admits again.
8. Windows expire: after advancing time (inject a clock or `vi.useFakeTimers`), requests are admitted again.

Extend `tests/api/stream-validation.test.ts` (or a small dedicated test) for rate limiting through the route: 11th rapid call returns the localized rate-limit SSE error.

Extend `tests/aisdk.test.ts`: `maxTokens` from options reaches `maxOutputTokens`; absent → 8192 default still applies.

Registry: extend `tests/registry.test.ts` expectations if validation now checks `maxTokens` bounds. `tests/i18n.test.ts` will enforce parity for the new message keys automatically — add both languages.

## Acceptance criteria

- [ ] A malformed or oversized request body never reaches `buildSystemPrompt` or the provider; the client receives a localized SSE error.
- [ ] `curl` with `"model":"claude-opus-4-8"` generates with the tool's default model (verify via server log or mocked provider assertion).
- [ ] The 11th request within a minute from one key receives the rate-limit error; concurrent stream #4 is refused; finished streams release their slot.
- [ ] Every tool's generation uses its configured `maxTokens` (assert via adapter test).
- [ ] `npm audit --omit=dev` no longer reports the drizzle advisory.
- [ ] Responses carry the security headers; CSP report-only shows no violations during a full manual click-through (home → tool → generate → projects → help).
- [ ] No hardcoded EN/NL error strings remain in `api.stream.tsx` (grep for `"Ongeldig`, `"Invalid`, `"Te veel`, `"Too many`).
- [ ] CI runs and passes on GitHub for a pushed branch.
- [ ] All gates green.

## Out of scope

Authentication (Phase 1), admin-configurable model list (Phase 4), quotas/usage accounting (Phase 2), client-side `streamClient.ts` i18n fix (Phase 5), enforcing CSP (Phase 2 deploy checklist).
