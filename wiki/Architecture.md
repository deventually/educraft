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
  where later stages pull earlier outputs via **`consumes`**. A dependency can name a
  **`derive`** (`app/lib/template/derivations.ts`): the placeholder then gets something
  computed in code from that output, such as Toetsvragen's `question-plan` (one line per
  question with its row, level, type and points, from the blueprint table).

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
- The API providers (id, `api`: `anthropic` | `openai-compatible`, `baseURL`, the *name* of the
  key setting `keyEnv`), the built-in catalog, each model's `settings` (`effort`, `temperature`
  — `null` = never sent —, `maxTokens`) and the default model live in **`config/models.json`**
  (fields in `config/README.md`), validated with Zod when `models.ts` loads: a broken file stops
  the boot with a message naming the problem. Keys stay in `.env`; `env.server#providerSetting`
  reads only `*_API_KEY` / `*_BASE_URL` names. The AI SDK adapter serves every config provider
  and maps `effort` to `providerOptions.anthropic.effort` or `providerOptions.<id>.reasoningEffort`.
  Changes made on the admin screen go to the database on top of the file, never into it. `models.ts` holds the `compat::`/local id schemes;
  `provider.ts` routes a model id to an adapter; `credentials.ts` maps a provider
  to the `.env` var it needs (or none, for local/CLI). All keys come from
  `.env` through `env.server` — never hardcoded or read ad hoc.
- Default model: `claude-sonnet-5-5` (`DEFAULT_MODEL` in `models.ts`).
- **Model management (admin, "Tools en modellen").** An admin adds a model of any connected
  provider on screen (`app/lib/ai/providers.ts`: Anthropic, OpenAI, Google, Mistral on their
  OpenAI-compatible address, or the own `OPENAI_COMPAT_BASE_URL`); a provider is *connected*
  when its key is in `.env` — keys never enter the database or the screen. An added model gets
  the id `<provider>/<apiId>`. **Upgrade** puts an old model in `retiring` with a successor:
  new work (pickers, tool defaults, stage pins, allow-list, own and team sets) goes to the
  successor at once, a running conversation may finish on the old id. **Finish** makes it
  `retired`: every request naming it is served by the successor. **Undo/restore** makes it
  active again. Nothing is deleted, so old results keep their model's name. The registry is one
  `instance_settings` JSON (`modelRegistry`), parsed by `app/lib/ai/modelRegistry.ts` and
  installed into the catalog by `modelRegistry.server.ts`, so every `resolveModelInfo` call
  sees it; `currentModelId` / `forwardRetired` in `models.ts` follow the upgrade chain and
  `availability.server.ts#servedModelFor` decides the model of a stream request.
  An admin can also **add a provider** (name, API kind, address; `addProvider` in
  `modelRegistry.ts`). It sits in the same registry on top of the config's providers
  (`listProviders`/`getProvider` in `models.ts`). Its id and key setting are derived from the
  name (`<ID>_API_KEY`) and may never equal a config provider's, so a key cannot be sent to
  another address. Internet addresses must be https; plain http only to a host on the own
  network (`isPrivateHost`), which may also need no key. Such a provider is an API provider,
  not a local one, so it works in production. It can be removed while no added model uses it.
  The page has three tabs in the URL (`?tab=tools|models|providers`, `admin.tools.tsx`): one
  page, so no extra admin route (BESLUIT-2026-11-03-14).
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

### Speech

- **Read aloud (TTS)** is browser-only: `ReadAloudButton` uses `speechSynthesis` with a
  device-local voice (`localService`); an online voice would send the text away, so with no
  local voice for the language the button is not shown (`app/lib/speech/readAloud.ts`).
- **Dictation (STT)** goes through the server: `DictateButton` records 16 kHz mono WAV in the
  browser (`app/lib/speech/recorder.ts`, `wav.ts`), posts it to `/api/transcribe`, and
  `speechToText.server.ts` forwards it to the OpenAI-compatible `/audio/transcriptions` of the
  provider named in `speechToText` in `config/models.json` (by default `whisper`, address in
  `WHISPER_BASE_URL`): whisper.cpp in Docker (`--profile speech`), on the machine, or OpenAI.
  No address → `dictationEnabled()` is false and no microphone shows. Nothing is stored;
  never the browser's Web Speech API (it sends audio to Google). The `Permissions-Policy`
  allows the microphone for `self` only.

---

## Feature modules

Bigger features keep the same shape: a pure domain module, a thin route, one server seam.

- **Feedback layer (P15).** Skip link, route announcer and focus-to-main live in `AppShell`.
  Action feedback goes through the toast system (`app/components/Toast.tsx`): a route calls
  `useFormToast(actionData, { result, pending? })` once; admin tables autosave through
  `AutoSaveForm` (fetcher + `useActionToast`, revert on error). Transient confirmations on a wired
  route carry no `role="status"`/`aria-live` of their own, so only the toast announces.
  **Across a redirect (P16):** an action that redirects returns `redirectWithFlash(url, key)`
  (`app/server/flash.server.ts`; `createUserSession` and `logout` take an optional key). The key
  (`FLASH_KEYS` in `app/lib/flash.ts`, text in `toast.flash`) rides a signed one-minute `__flash`
  cookie; the root loader reads and clears it, and `useFlashToast` shows it once per flash id.
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
  Finishing (P29). "Klaar om in te leveren?" in step 5 (`readiness.ts`, `readinessCheck`): one list
  of advisory points from the confirmed framework only, each with a "Los op" target; four points
  are ticked by the teacher (`tickReadiness`). It never blocks the export (BESLUIT-2026-11-05-9).
  The rehearsal assessment (`/portfolio/:id/rehearsal`, `portfolio-rehearsal@v2`) is a chat with a
  played committee of two assessors. It is one registry entry in `WORKPLACE_TOOLS`, outside the
  catalogue (`hiddenFromCatalogue`), governed by the workplace feature instead of tool
  availability. With `contextFrom: "dossier"` the stream takes a `dossierId`, loads the caller's own
  dossier and builds the prompt itself (`dossierPromptValues`: chapters, criteria with short keys,
  evidence titles only); the body only chooses the length and the outcomes. The conversation is not
  saved (`storesConversation: false`). On "Rond af" the model answers with JSON;
  `parseRehearsalFeedback` keeps a quote only when the teacher typed it, drops unknown keys and
  sources, and has no field for a grade. "Bewaar in je dossier" re-checks it on the server and keeps
  only the feedback as evidence `kind: "feedback"` plus an `aiLog` line `rehearsal`
  (BESLUIT-2026-11-05-10). Measurement: `npm run eval:rehearsal`.
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
- **Courses, further (P26).** A test can carry questions (`Assessment.items`: label, outcome, Bloom,
  question type, points). With questions, `effectiveCoverage` derives coverage from them (lowest
  level per outcome) for the matrix, the findings and the role agents; three extra findings
  (`outcome-single-item`, `item-bloom-below-outcome`, `items-without-points`); `items.ts` gives the
  total row. `blueprintImport.ts` reads the blueprint table of a stage marked
  `ToolStage.courseExport = "assessment-items"` (data, no tool branch) and proposes an outcome per
  row only when certain; intent `import-blueprint` (owner- and link-checked). The OER import
  (`import.ts`, `course-import@v1`) is a proposal the teacher ticks. `evidence.ts`
  (`courseAsEvidence`) makes a deterministic Markdown snapshot; `courseEvidence.server.ts` adds it
  to an own dossier as `EvidenceItem.sourceCourse` and "Opnieuw ophalen" refreshes it. No migration.
- **Role agents (P21)** on the course page, section "Beoordeling". A hat is registry data in
  `app/lib/agents/` (`registry`, `validate`, `schema`, `input`, `filter`): `buildReviewMessage`
  puts the course under short keys (L1, A1, T1, with Bloom and pack tags), the P20 findings and the
  rejected advice in the message; `parseAgentReview` maps keys back and drops anything unknown,
  duplicated or rejected. Prompts `agent-assessment@v2` (also reads `<linkedWork>`) and
  `agent-design@v1`. `app/server/agentReview.server.ts` runs every hat that watches `"course"` on
  the teacher's chosen (allowed) model, one retry, and stores per hat in `agent_reviews` (findings
  with ids `f1…`, `courseUpdatedAt` for "verouderd"); `review_decisions` holds Akkoord / Niet
  akkoord with a reason. Intents `review` and `decide` behind the `roleAgents` feature. An admin
  switches each hat On or Off for the instance on `/admin/agents` (`instance_settings`
  `agentStand:<id>`, absent = on; `activeAgents` in the registry). A hat that is off is not run,
  not shown and not counted on Start; its stored reviews stay. No hat on = no panel. Linked work
  (only when ticked): the caller's own `test-items` generations linked to the course, newest three,
  clipped. Pack tags (`LearningOutcome.packTags`) come from the pack of the course's own context
  profile and are checked at the editor intent (`packTags.ts`). Eval: `npm run eval:agents`.
- **The teacher's week (P22)** on Start. Derived, never stored, no planner and no AI
  (BESLUIT-2026-11-05-7). `app/lib/calendar/weeks.ts` does ISO-week arithmetic in UTC on whole
  days: `courseWeekDates` maps relative course weeks to Mondays, skipping the institution's break
  weeks (`instance_settings.breakWeeks`, one list, edited on `/admin/context`); "today" is the
  calendar day in `instance_settings.timeZone` (default Europe/Amsterdam). A course has an optional
  `startDate` (no migration). `app/lib/week/teacherWeek.ts` computes per running course *In de
  les*, *Voorbereiden* (no work linked to the item), *Nakijken* (assessments of the previous two
  weeks) and the open findings; `nextWeek` is the same call a week later, shown on Start from
  Friday to Sunday. `app/lib/calendar/ics.ts` writes the course as an RFC 5545 file (whole-week
  events, stable UID per item), served by `/courses/:id/calendar.ics` to the owner only.
- **The course as a workplace (P27.4).** `Tool.courseActions` (`outcome | activity | assessment`)
  says at which kind of course item a tool is a button; `FINDING_TOOLS` in
  `app/lib/registry/courseActions.ts` maps a finding code to the tool for "Los op met…" (checked at
  boot by `validateFindingTools`; the course engine knows nothing of tools). A hat finding gets the
  first tool for the kind of its `targetId`. `courseToolsFor(user)` (`courseTools.server.ts`) keeps
  only available tools. A button opens `/tools/<slug>?course=&item=`; the tool loader takes the item
  only from the own course, `useSandbox` drops it when another course is picked, and `/api/stream`
  links the result to that lesson or test (`itemId`). The course page shows "Per week"
  (`weekPlan`, pure); the week on Start (P22.3) shows one button per row: the preferred tool of
  its kind (`PREFERRED_TOOLS`), or the test analysis in *Nakijken* (`GRADE_TOOL`).

---

- **Pilot feedback.** Pure rules in `app/lib/pilot/` (answer options, `checkinDue`,
  `summarizeByTool`); storage in `feedback.server.ts` and `pilot.server.ts`. Under every saved
  result `ResultActions` shows the `FeedbackWidget`: a thumb, then optionally time saved
  (0/15/30/60+ min), quality 1-5 and a comment (`/api/feedback`). The Start page shows a short
  check-in (helped / annoyed / missing, `/api/checkin`) when the feature `pilotCheckin` is on and
  it is due: after 3 results, then at most once per 14 days; "Niet nu" counts too. `/admin/usage`
  has *Pilot per tool*: uses, thumbs, time, quality and comments since the start, plus the
  check-in answers, filtered per team with `?team=`.

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
    courses/         types · bloom · schema · edit · alignment · intents · links (P20) · items · blueprintImport · import · evidence · findingText (P26) · packTags (P21), all pure
    agents/          types · registry · validate · schema · input · filter (P21 role agents), all pure
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
