# S4 — Image-input pipeline + Math Grading (#7)

**Goal:** wire image input **fully end-to-end** as a deep module, and prove it with the
handwritten-math grading tool ("Leveraging LLMs for Grading and Feedback on Handwritten Math
Assessment Responses").

**Prerequisites:** S1. Independent of S2/S3 (can run in parallel) but **touches shared files**
(`api.stream.tsx`, `DynamicForm.tsx`) — coordinate/land before S5–S7 if they're concurrent.
**Master plan:** `/Users/bastiaandressen/.claude/plans/can-you-make-a-atomic-bee.md` (Workstreams D + E-image).

## What already exists (reuse — do not reinvent)
- The AI-SDK adapter already maps an **array** of `opts.images` onto the last user message
  (`app/lib/ai/adapters/aisdk.ts:40-52`).
- `ImageInput` type (`app/lib/ai/types.ts:5` — `{ mediaType, dataBase64 }`) and
  `GenerateOptions.images` already exist.
- `ModelInfo.supportsImages` already exists (`app/lib/ai/models.ts:26`; Claude = true, CLI/local = false).

## Scope
- **API** — `app/routes/api.stream.tsx`: add `images?: ImageInput[]` to `StreamBody`; forward to
  `provider.streamChat`. Zod-validate: MIME against the field's `accept`, image count, size cap;
  reject otherwise.
- **Vision-model gating (the real gap):** image tools must only run on `supportsImages: true`
  models. Filter the `ToolControls` (`app/components/ToolControls.tsx`) model picker to vision-capable
  models when the stage has an image input, **and** guard server-side in `api.stream` — return a
  localized error if images are sent to a non-vision model (otherwise the image is silently dropped).
- **UI** — implement the `image`/`file` branch in `app/components/DynamicForm.tsx:163` (replace the
  "coming soon" stub): accept **multiple files**, `FileReader` → base64, client-side downscale of
  large images, preview thumbnails, remove control, accessible labeling.
- **Math Grading tool** — read the chapter appendix; author prompt files + `PromptDef` + `Tool`
  with an `image` input field (`accept: "image/png,image/jpeg"`) plus text inputs (rubric, etc.).
  Default to a vision model (e.g. `claude-sonnet-4-6`).

## TDD order
1. RED `tests/components/DynamicForm.image.test.tsx`: selecting files yields base64 values,
   preview + remove work, oversized/wrong-MIME rejected, `axe` = 0 violations.
2. RED a small `tests/api/stream-images.test.ts` (or unit on the validation helper): non-vision
   model + images → localized error; vision model + valid images → forwarded.
3. GREEN the pipeline + gating.
4. RED `tests/tools/math-grading.test.ts` (registry/prompt validation) → GREEN by authoring the tool.
5. REFACTOR: keep the image helper (validate + downscale + encode) a single narrow module.

## Done when
- `npm test` green (incl. new image + tool tests); `npm run typecheck` && `npm run check` green.
- In `npm run dev`: Math Grading accepts image upload(s), the picker only offers vision models,
  generation streams feedback, and a non-vision model is blocked with a clear message.

## Start prompt
> Read `docs/implementation/S4-image-infra-math-grading.md` and the master plan it references. Wire
> the image-input pipeline (multi-file → base64 + downscale + validation, forwarding, vision-model
> gating) and author the Math Grading tool, test-first per the `/tdd` skill. Verify with `npm test`,
> `npm run typecheck`, `npm run check`, and an image-upload generation in the running app.
