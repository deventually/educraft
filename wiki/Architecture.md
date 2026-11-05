# Architecture

How LimeOnIt is built today, and why the design already supports the global
[Vision](../docs/VISION.md). For the canonical current-state summary see the
[README](../README.md); this page goes deeper and connects the pieces.

---

## The one idea: **tools are data, not code**

A *tool* is a declarative description, not a hand-written page. A `Tool`
(`app/lib/registry/types.ts`) carries:

- **`inputs`** — the fields, from which the form is rendered automatically
  (see `DynamicForm`).
- **`stages[]`** — one or more generation steps. A one-shot generator has a single
  stage; a multi-step tool (e.g. the 4-stage Cognitive Architect) chains stages,
  where later stages pull earlier outputs via **`consumes`**.

Adding a tool is therefore *authoring data*, not writing a feature — see
[Adding a Tool or Pack](Adding-a-Tool-or-Pack.md). This is the property that lets
one app scale to many tools, sectors, and countries (see [Context Model](Context-Model.md)).

---

## The prompt pipeline

Prompts live **outside** the code as Markdown, per tool and per language:

```
app/lib/prompts/files/<id>.{nl,en}.md      # the runtime prompt, with {{placeholders}}
app/lib/prompts/book/<id>.md               # the book's prompt, word for word (verbatim)
app/lib/prompts/<id>.prompt.ts             # PromptDef: verbatim original + runtime ref
```

- Each `PromptDef` keeps a **verbatim** original (shown in the UI for CC BY fidelity
  to the Promptbook) and a **runtime** prompt (interview→one-shot, localized,
  with `{{placeholders}}`).
- `getRuntimePrompt(id, lang)` selects the language variant.
- **`buildSystemPrompt`** (`app/lib/template/`) merges: runtime prompt +
  `{{contextProfile}}` + `{{outputLanguage}}` + any consumed prior-stage outputs.
- `validate.ts` checks that **every `{{placeholder}}` has a source** — enforced by
  the test suite.

Generation is streamed to the browser via SSE through the resource route
`app/routes/api.stream.tsx`. That route is also the **access boundary**: it parses
the body with `StreamBodySchema` (Zod), authenticates, and refuses via
`isToolAvailable` (`app/server/availability.server.ts` — instance settings) before any provider call. The registry is
validated at boot (`registry/boot.server.ts`): dev fails fast, prod excludes the bad tool.

---

## Providers (model-agnostic)

LimeOnIt is not tied to one model vendor.

- **Vercel AI SDK v7** adapter (`app/lib/ai/adapters/aisdk.ts`) — Anthropic, LM Studio,
  and any configured OpenAI-compatible endpoint.
- **Native Ollama** adapter (`app/lib/ai/adapters/ollama.ts`) — streams `/api/chat`, because the
  AI SDK's `/v1` path ignores Ollama's `think` switch. It honours `GenerateOptions.thinking`
  (`false` = answer directly, much faster for chat; `undefined` = model default), drops the
  `thinking` field from the stream so raw chain-of-thought never reaches the answer, and
  attaches images as raw base64. The per-chat toggle sits in `AdvancedSettings` ("Geavanceerd")
  in `ChatView`, shown only for models whose `/api/show` capabilities include `thinking`
  (`PickerModel.supportsThinking`).
- **CLI** adapter (`app/lib/ai/adapters/cli.ts`) — drives local agent CLIs
  (Claude Code, opencode, codex, gemini) as subprocesses (prod-guarded).
- **Dynamic discovery** (`app/lib/ai/discover.server.ts`) — local Ollama/LM Studio
  models are discovered at runtime (queried per `/v1/models`), not hard-coded.
- **Configured endpoint** — a `compat::<model>` id points at any frontier or
  self-hosted model that speaks the OpenAI API (ChatGPT, Gemini, Mistral, GLM,
  DeepSeek, OpenRouter, vLLM, …), via `OPENAI_COMPAT_BASE_URL` /
  `OPENAI_COMPAT_API_KEY` in `.env`. It's a *paid remote* model, so — like Opus —
  it is **not** client-selectable: reachable only as a configured default, never forced from a request body.
- `models.ts` holds the static catalog + the `compat::`/local id schemes;
  `provider.ts` routes a model id to an adapter; `credentials.ts` maps a provider
  to the `.env` var it needs (or none, for local/CLI). All keys come from
  `.env` through `env.server` — never hardcoded or read ad hoc.
- Default model: `claude-sonnet-5-5` (`DEFAULT_MODEL` in `models.ts`).
- **Availability (P4/P13/P14/P18).** Which models a caller may *pick* is an OVERRIDE:
  the instance sets `enabledModels`; a teacher with their own `assignedModels` gets
  exactly that set instead (it replaces the instance and may be wider); no own set =
  follow the instance; teams can narrow the instance with their own sets (P28.3, see
  [Authentication](Authentication.md#parts-tools-and-models-per-team-p283)); an admin
  always gets the instance set. An own set that is
  empty after filtering counts as not set. `availability.server.ts#isModelSelectableForUser`
  is a membership walk, so it also gates a volatile `ollama::…` id without
  enumerating any local server. Opus-class + `compat::` stay server-only.
  **CLI agents and local (Ollama/LM Studio) models exist only outside production**
  (`localModelsEnabled()` in `env.server.ts`, i.e. `NODE_ENV !== "production"`): in
  production they are not offered, not discovered and not executed. The pilot runs on
  `npm run dev`, so they work there; `npm start` and the Docker image do not have them.
  The gates only bound what an admin/teacher may *offer*.

This matters for the vision: institutions in different countries can run LimeOnIt on
**their** chosen engine and infrastructure (local-first included).

---

## Feature modules

Bigger features keep the same shape: a pure domain module, a thin route, one server seam.

- **Feedback layer (P15).** Skip link, route announcer and focus-to-main live in `AppShell`.
  Action feedback goes through the toast system (`app/components/Toast.tsx`): a route calls
  `useFormToast(actionData, { result, pending? })` once; admin tables autosave through
  `AutoSaveForm` (fetcher + `useActionToast`, revert on error). Transient confirmations on a wired
  route carry no `role="status"`/`aria-live` of their own, so only the toast announces.
- **Document upload** (`app/lib/documents/extract.ts`). `fileToText` lazily loads `unpdf` (PDF) and
  `mammoth` (DOCX) and extracts text in the browser into a `kind: "document"` field (300k chars,
  checked by `fieldCapError`). No server endpoint; fixtures in `tests/fixtures/generate.mjs`.
- **Document viewer (P24.0c)** (`app/components/documents/DocumentViewer.tsx`). Shows the original
  next to the text that goes to the AI. PDF pages via pdf.js, DOCX via mammoth HTML turned into an
  allow-listed `SafeNode` tree (`docxHtml.ts`); `locate.ts` finds quotes for "Toon in document".
  The original is never uploaded or stored.
- **Anonymise before sending (P24.0b)** (`app/components/privacy/`, `app/lib/privacy/redact.ts`).
  A field with `redact: true` shows `RedactReview` before `streamPost`; names, e-mail, phone,
  postcode, IBAN and 6–8-digit numbers become codes. The code → name table lives only in component
  memory; `restoreNames` restores them for the teacher, `generations` keeps the coded version.
- **BDB/BKE workplace (P25)** at `/portfolio`. Pure domain in `app/lib/portfolio/` (`schema` with
  `LIMITS`, immutable `edit`, `progress`, `intents.ts` → `applyIntent`, Zod per intent); routes stay
  thin via `app/server/portfolio.server.ts`; storage is one JSON graph per dossier in
  `portfolio_dossiers`. Only the teacher sets a criterion status. The coach (`coach.ts`,
  `portfolioCoach.server.ts`) drops quotes that are not verbatim in the chapter and advice that
  cites a source not in the teacher's references. `toolHints.ts` suggests at most two available
  tools per step.
  Framework extraction (P25.4, intent `extract` on the framework page): the teacher pastes the
  form or picks one or more PDF/DOCX files (`fileToText`, in the browser); `portfolio-framework@v1`
  returns JSON and `extract.ts` clips it to `LIMITS`, marks a criterion that is not verbatim in the
  form as `unverified` ("Controleer dit"; saving the criterion clears it) and refuses to replace a
  framework that work depends on (`frameworkInUse`). The proposal is stored unconfirmed. The model
  call is shared with the coach in `portfolioAi.server.ts`.
- **Courses and alignment (P20)** at `/courses`. Pure domain in `app/lib/courses/`: `types` (with
  `HOURS_PER_EC = 28`), `bloom`, `schema` (`CourseDataSchema`, `COURSE_LIMITS`, not strict),
  immutable `edit`, `alignment` (`coverageMatrix`, `checkAlignment`: seven advisory finding codes,
  identified by code, outcome and item), `intents.ts` → `applyCourseIntent`, and `links.ts` (link
  targets and links per generation). Routes stay thin via `app/server/courses.server.ts`; storage is
  `courses` (one JSON graph) and `course_links` (generation ↔ course, optional activity or
  assessment). Tools take part through data only: a field with `prefillFromCourse` gets the
  course's outcomes (`coursePrefillValues`, `useSandbox.selectCourse`), and `CoursePicker` sits at
  the top of the form. `/api/stream` takes an optional `courseId` and links the saved generation;
  "Mijn werk" links and unlinks afterwards; the course page lists "Gekoppeld werk".

---

## Stack

React Router 8 (framework mode, SSR) · TypeScript · Tailwind v4 (CSS-first) ·
SQLite via Drizzle + better-sqlite3 (local-first, schema auto-created) ·
multi-provider AI. Dev server on **port 5173** (`npm run dev`).

---

## Repository map

```
app/
  routes/            home · tool · settings · about · projects · api.stream (SSE)
  components/        AppShell · DynamicForm · GeneratorView · StageStepper · ToolControls · ResultPanel · ui
  lib/
    registry/        types.ts (the Tool abstraction) · validate.ts · tools/<tool>.ts · index.ts
    prompts/         <tool>.prompt.ts · index.ts (PROMPTS map) · files/<id>.{nl,en}.md
    ai/              types · models · provider · discover.server · adapters/{aisdk,cli} · sse
    template/        interpolate · buildSystemPrompt
    context/         types · format  (the context profile + hbo-i pack)
    i18n/            messages/{nl,en}/<ns>.ts · index · format · localized
    registry/        … · access.ts (roles + canUseTool) · boot.server.ts (boot validation)
    hooks/           useSandbox (shared values/profile/course/locked-mode across the tool surfaces)
    courses/         types · bloom · schema · edit · alignment · intents · links (P20, pure)
  server/            env · db (getDb seam) · schema · migrate · auth · availability.server · repositories/* (async, userId-scoped)
docs/                VISION.md · Audit-2026-07.md · Improvement-Plan.md · implementation/P0…P7
wiki/                this wiki
book/                The Pedagogical Promptbook (source material)
```

---

## Quality gates

```bash
npm test           # full node + DOM suite: registry, interpolation, buildSystemPrompt, i18n, the api.stream route, components (axe)
npm run typecheck  # react-router typegen + tsc
npm run check      # Biome (lint + format)
npm run build      # production build
```

## Related

- [Context Model](Context-Model.md) · [Tools](Tools.md) ·
  [Internationalization](Internationalization.md) · [Adding a Tool or Pack](Adding-a-Tool-or-Pack.md)
- [Authentication](Authentication.md) · [Deployment](Deployment.md) ·
  [Compliance](Compliance.md)
- Program docs: [audit](../docs/Audit-2026-07.md) · [improvement plan](../docs/Improvement-Plan.md) ·
  [phase briefs](../docs/implementation/README.md)
