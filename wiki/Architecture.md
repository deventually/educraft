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
  A stage's output can name a **`computed`** note (`app/lib/template/computations.ts`): a
  line computed in code from the finished result and shown under it, labelled as not from
  the AI, such as the leercheck's `engagement-index` (the score out of 18, P31.3). A number
  never depends on the AI's arithmetic.

- **`mode`** — `one-shot` or `chat`. How a tool runs is one **strategy** per kind
  (`modeOf(tool)` in `app/lib/registry/modes.ts`): `chat`, `multiStage` (one-shot with more
  than one stage) or `oneShot`. The strategy knows the turns the model answers (a chat's
  history or one trigger), the language reminder on the last chat turn, the row a run is kept
  in (a chat's session id), whether the workspace fills the page, and whether the work may be
  shared. The tool page picks its workspace from `ToolWorkspace` by that kind. No route or
  component branches on `tool.mode` itself (`tests/architecture.test.ts`).

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

The stream (`app/lib/ai/sse.ts`) sends a `: keep-alive` comment every 15 s
(`SSE_HEARTBEAT_MS`), so a proxy such as Cloudflare (100 s without data) never drops a
long answer before its first token. When the teacher closes the tab, the route aborts
the model call: `request.signal` and the stream's `cancel` both reach the provider as
`GenerateOptions.signal`; nothing is saved and the log line says `aborted`.
Leaving inside the app asks first. `AiLeaveGuard` (in `root.tsx`) blocks a navigation to
another page while AI work runs and offers *Laten doorlopen*, *Afbreken* and *Op deze pagina
blijven*. A view that streams (`GeneratorView`, `StageStepper`, `useChatSession`) takes its
signals from `useStreamAborts(busy)`, which registers them with the guard: "keep" lets the
stream finish (the route saves it as usual), "stop" aborts it. A view that closes any other
way aborts its calls, like closing the tab. An aborted call is still counted once, as failed
(`failedCalls`, tokens unknown).

AI actions without streaming (Reviewteam, coach, proofread, framework and course import)
carry a call id from their form (`AiCallField`). `saveIntent` and `saveCourseIntent` run
under it (`runAiCall`, `app/server/aiCalls.server.ts`), and `callPortfolioModel` hands that
signal to `generate`. Leaving alone never stops them, so "keep" saves the result; "stop" posts
the id to `/api/ai-cancel`, which aborts only the caller's own call.

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
  **Prompt caching:** a chat sends the same system prompt and history every turn, so the stream
  sets `GenerateOptions.cacheKey` (teacher and tool) when `modeOf(tool).cachesPrompt`. The adapter
  then follows the provider's `cache`: `"markers"` puts Claude's `cacheControl` on the system
  prompt and on the turn before the last (the last turn carries the language reminder, which is
  gone next turn); `{ key }` sends a SHA-256 of the key in that body field; `"auto"` sends
  nothing. A one-off generation is never cached (a cache write costs more than it saves there).
  Changes made on the admin screen go to the database on top of the file, never into it. `models.ts` holds the `compat::`/local id schemes;
  `provider.ts` routes a model id to an adapter; `credentials.ts` maps a provider
  to the `.env` var it needs (or none, for local/CLI). All keys come from
  `.env` through `env.server` — never hardcoded or read ad hoc.
- Default model: `default` in `config/models.json`, read as `DEFAULT_MODEL` (`models.ts`). It is the
  only place a model is chosen: every tool's `defaultModel` and the eval judge point at it, and
  `tests/model-ids.test.ts` fails on a model id written anywhere else in `app/` or `scripts/`.
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
  `modelAvailability.server.ts#servedModelFor` (via `availability.server`) decides the model of a stream request.
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
  empty after filtering counts as not set. `modelAvailability.server.ts#isModelSelectableForUser`
  is a membership walk, so it also gates a volatile `ollama::…` id without
  enumerating any local server. Opus-class + `compat::` stay server-only.
  **CLI agents and local (Ollama/LM Studio) models exist only outside production**
  (`localModelsEnabled()` in `env.server.ts`, i.e. `NODE_ENV !== "production"`): in
  production they are not offered, not discovered and not executed. The pilot runs on
  `npm run dev`, so they work there; `npm start` and the Docker image do not have them.
  The gates only bound what an admin/teacher may *offer*.

- **Measuring AI use (usage dashboard, PR A).** Every adapter reports a call's tokens in one
  shape, `TokenUsage` (`input` uncached, `cacheRead`, `cacheWrite`, `output`, `reasoning`), via
  `normalizeUsage` (`app/lib/ai/usage.ts`): Anthropic reports uncached input apart from cache
  reads and writes, OpenAI-compatible providers a total with a cached share, Ollama no cache;
  `input + cacheRead + cacheWrite` is always the whole prompt. `generate` returns it; a stream
  hands it to `GenerateOptions.onUsage` once it ends. `meterCall` (`app/server/aiMeter.server.ts`)
  is the one place a call is counted: the daily quota (`usage`, now with real output tokens) and
  `ai_usage`, one row per user, UTC day, source (tool slug or a fixed source such as
  `portfolio-coach`) and model. Counters only, never content or a time of day. A call without a
  token report counts as `unmeteredCalls`; a failed or aborted call as `failedCalls`. CLI agents
  report no tokens. Rows per person stay thirteen months; an hourly timer
  (`aiUsageRetention.server.ts`, started in `entry.server.tsx`) rolls older ones up into
  `ai_usage_rollup` (month totals for the institution and per team, no person) and deletes them
  (BESLUIT-2026-11-11-6).

- **Prices (usage dashboard, PR B).** Each catalog model has a list price per million tokens in
  `config/models.json` (`price`: currency, input, output, cacheRead, cacheWrite, `checked`,
  `source`), turned into euros with `exchangeRate`; `parseModelsConfig` refuses a price without a
  date or source and a dollar price without a rate. An admin can set an own price per model on
  the models tab (`modelPriceAdmin.server.ts`, `instance_settings` key `modelPrices`, logged as
  `modelPriceChanged`); it wins (`effectivePrice` in `models.ts`). `meterCall` prices each call
  when it is counted (`callCost`, `ai_usage.costMicros`, a snapshot); a local model costs 0, a
  model without a price adds to `unpricedCalls`. The skill `/model-prices` keeps the list
  prices and the rate current, from the providers' own pages.

- **Usage page (PR C).** `/usage` is one page for every role; `usageDashboard.server.ts`
  decides the circles (BESLUIT-2026-11-11-1) and leaves out of the loader data what a viewer
  may not see. Everyone: own calls per week, tool and model. A team lead:
  each led team's totals (`teamAiUsage` returns `null` for anyone else), never per person or
  money, and no split per tool or model below `MIN_TEAM_BREAKDOWN` (3) active members. An
  admin: everyone, per person, team, provider, model and tool, with costs and the unpriced
  calls. The owner: the month forecast and the cache savings at today's prices. The sums come
  from `aiUsageReports.server.ts` (grouped in SQL, capped at 500 rows); the arithmetic
  (months, weeks, forecast, savings) is pure in `app/lib/usage/summary.ts`. Help topic `usage`
  ("Wat we meten"). Beheer → *Feedback en pilot* keeps feedback and the pilot only.
- **Monthly AI limits (PR D, BESLUIT-2026-11-11-8).** The owner sets a monthly budget for the
  institution, an admin a monthly limit in euros per team and per teacher, stored as one JSON
  value in `instance_settings` (`aiLimits.server.ts` repository; `parseAiLimits` drops a broken
  entry, never the set). `applicableLimit` (`app/lib/usage/limits.ts`, pure) picks the limit
  that binds: a teacher's own limit replaces their teams' limits, the budget always counts, the
  highest share wins; from 80% `warn`, at 100% `stop`. `aiLimitFor` (`app/server/aiLimits.server.ts`)
  feeds it this month's spend (`monthSpend`) and returns `null` for an admin. The stream and
  `quotaGate` refuse at `stop`, after the quiet daily brake on output tokens (`checkQuota`; the
  number of calls is not limited, and nobody sees the brake on a page). A teacher
  sees only a share, never euros: on *Gebruik* and above a tool's workspace (`LimitNotice`).
  Changes go through the `/usage` action (`setLimitFromForm`: budget owner-only, never a limit
  on an admin) and the audit log (`aiLimitChanged`).

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
- **Announcements** (`app/lib/announcements.ts`, `announcements.server.ts`). The admin posts a
  banner on `/admin/announcements` for everyone, one team or one person, as `info` or `warning`,
  with an optional last day (`endsOn`, Europe/Amsterdam, inclusive) and an optional
  `remindAfterDays` (1-30) after which a closed banner comes back. The root loader brings the
  user's banners (`announcementsFor`, scoped to the user in the WHERE clause, warnings first, at
  most 5); `AnnouncementBanner` renders them in `AppShell` as a named region before `<main>`, not
  a live region, with the level in words. Closing posts JSON to `/api/announcements/dismiss`
  (Zod), which stores a dismissal only for an announcement the user can see; focus moves to
  `<main>`. A deleted team or account takes its announcements along.
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
- **Figures from the document** (`app/lib/documents/figures.ts`,
  `app/components/documents/DocumentFigurePicker.tsx`). An image field with `imagesFrom: "<document
  field>"` offers the figures of the files uploaded there: Word images the model can read (icons
  dropped, EMF/WMF counted as skipped) and each figure-sized PDF image cut out of its rendered page
  (tiles merge; an image on the same spot of 3+ pages or covering a text page is skipped). A
  thumbnail enlarges in a dialog. Nothing is ticked by default: anonymisation covers text only.
- **Assessment models** at `/assessment-models` (`app/lib/assessment-models/`,
  `assessmentModels.server.ts`). A model is a framework (required) plus an optional scale for some
  document types. A tool opts in with data: `Tool.assessmentModels.byField` (the select that
  chooses) and `InputField.prefillFromAssessmentModel` on the fields it fills. The teacher's own
  model for the chosen type fills in by itself (`useAssessmentModel`), a starter only when picked,
  and text the teacher typed is never overwritten. An empty scale means feedback only
  (`stage-assessment@v3`). Starters are files in `starters/`; a rubric can be taken over.
- **BDB/BKE workplace (P25)** at `/portfolio`. Pure domain in `app/lib/portfolio/` (`schema` with
  `LIMITS`, immutable `edit`, `progress`, `intents.ts` → `applyIntent`, Zod per intent); routes stay
  thin via `app/server/portfolio.server.ts`; storage is one JSON graph per dossier in
  `portfolio_dossiers`. Only the teacher sets a criterion status. The coach (`coach.ts`,
  `portfolioCoach.server.ts`) drops quotes that are not verbatim in the chapter and advice that
  cites a source not in the teacher's references. `toolHints.ts` suggests at most two available
  tools per step.
  Proofreading ("Lees proef", next to "Laat beoordelen", `portfolio-proofread@v1`, `proofread.ts`):
  proposals for language and form only, each a span that `locateQuote` finds literally in the saved
  chapter (else dropped), stored per outcome in `proofreads`. "Overnemen" (`takeProofread`) replaces
  exactly that span; "Negeren" (`skipProofread`) drops the proposal. Needs no confirmed framework.
  "Beoordeel het hele dossier" in step 5 (`reviewAll`, `reviewDossier`) runs the same coach over
  every chapter with text, in parallel, and keeps the reviews that worked.
  Framework extraction (P25.4, intent `extract` on the framework page): the teacher pastes the
  form or picks one or more PDF/DOCX files (`fileToText`, in the browser); `portfolio-framework@v2`
  returns JSON and `extract.ts` clips it to `LIMITS`, marks a criterion that is not verbatim in the
  form as `unverified` ("Controleer dit"; saving the criterion clears it) and refuses to replace a
  framework that work depends on (`frameworkInUse`). The proposal is stored unconfirmed. The model
  call is shared with the coach in `portfolioAi.server.ts`.
  Per outcome @v2 also reads the chapter outline the form prescribes (`Outcome.outline`: sections
  with what each asks and the criteria it covers, named by number in the model's list and mapped
  to ids in code) and the sources the form names (`Outcome.literature`). No outline when the form
  gives none; a section name not verbatim in the form is `unverified`, a source not in the form is
  dropped. The chapter tab shows both above the editor (`ChapterOutline`). Removing a criterion
  takes it out of the sections; the schema refuses a section that covers another outcome's
  criterion. Eval: `npm run eval:framework` (deterministic, `evals/portfolio-framework/`).
  Finishing (P29). "Klaar om in te leveren?" in step 5 (`readiness.ts`, `readinessCheck`): one list
  of advisory points from the confirmed framework only, each with a "Los op" target; four points
  are ticked by the teacher (`tickReadiness`). It blocks only one thing: while an open spot is left (`openSpots.ts`: `[aanvullen: …]`, TODO, an empty chapter, evidence without text) the export gives a draft version, marked CONCEPT on every page, never the final one (BESLUIT-2026-11-07-4; otherwise advice, BESLUIT-2026-11-05-9).
  Export: `dossierDoc` (`export.ts`) is the one in-between model; the Word writer and the print
  page (`/portfolio/:id/print`, PDF through the browser) both read it. `dossierExport`
  (`portfolioExport.server.ts`) reads `?lu=` (one outcome via `dossierPart`, handed in on its
  own), `?draft=1` and `?ai=1`, and applies the open-spot rule to what is exported.
  Back from Word (`wordImport.ts`): the browser reads an edited export (`docxToSafeNodes`),
  `readBack` finds each chapter under the Heading 1 the export wrote and compares it with
  `sameChapter` (heading levels and table rules ignored). The teacher ticks what to take over; the
  `importChapters` intent writes only that. Appendices are never read back.
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
  the top of the form. Opened from a lesson or test (`?item=`), `learningOutcomes` gives only that
  item's own outcomes, `itemTitle` its title and `earlierLessons` the (at most five) lessons in the
  weeks before it; the tool loader sends each course's items for this. The optional
  `CourseData.schedule` (weeks, sessions per week, `sessionMinutes`, group size, delivery mode)
  feeds `sessionMinutes`, `groupSize` and `deliveryMode`; optional `disciplines` (name, teacher,
  `hoursPerWeek`) with `Activity.disciplineId` turn `sessionMinutes` into that discipline's hours
  in the lesson's week over its lessons that week (rounded to 5, capped at a session). An activity has an optional
  `goal` (one sentence, `COURSE_LIMITS.goal`): what the student can do after that lesson. `/api/stream` takes an optional `courseId` and links the saved generation;
  "Mijn werk" links and unlinks afterwards; the course page lists "Gekoppeld werk".
- **Course progress.** `courseProgress(data, findings)` (`app/lib/courses/progress.ts`) is pure
  and advisory like the checks: six backwards-design steps (details, outcomes, assessments,
  lessons, weeks, check), each with its tab, what is done of it and the next open step. The
  course page shows it on the Overview tab and the course list per course. The presentation is
  the domain-neutral `ProgressPanel` (`app/components/progress/`): a bar, the next step with how
  and a button, and every step as a link to go deeper; another domain passes its own steps.
  The BDB/BKE dossier does (`dossierRoute`, `app/lib/portfolio/route.ts`): the framework, each
  learning outcome on its own, then finishing (no blocking point in `readinessCheck`). An outcome
  has four milestones (`outcomeRoute`: evidence, chapter, review, shown); the review counts a
  coach verdict *shown* or the teacher's own mark, so the coach is never required, and only the
  teacher's mark completes an outcome. `DossierProgress` shows it on the overview, `OutcomeProgress`
  on the outcome page, with each milestone a jump to its tab and the part of it. Like a course,
  the dossier and each outcome are split into tabs in the URL (`app/lib/portfolio/tabs.ts`,
  the shared `TabNav`): the dossier has Overview and Finish, an outcome Overview, Evidence,
  Chapter and Review. Links into a tab (`dossierHref`, `outcomeHref`) carry `?tab=` and an anchor.
  The form's required evidence is a checklist on the Evidence tab (`requirementChecklist`,
  `app/lib/portfolio/requirements.ts`): an item counts for a line when the teacher ticked it
  (`EvidenceItem.requirements`, intent `linkRequirement`), or else as a guess from its kind, which
  the teacher confirms; tool-made feedback is never a guess. The evidence milestone and the
  readiness check count the same lines. No migration (the dossier is JSON).
- **Course wizard (step 1).** An empty course (`isEmptyCourse`) opens on "Hoe wil je beginnen?":
  design in broad outline, a document (the import) or empty. Designing posts `design-outcomes`:
  `app/lib/courses/design.ts` reads the brief (description, EC, weeks), builds the message (name,
  study load, weeks, disciplines, the owner's context profile via `formatProfile`, and the number of
  outcomes `outcomeRange` sets from the EC or weeks, so the model does not decide that) and checks the
  answer of `course-design-outcomes@v1` into an `ImportProposal` with `source: "design"` (at most
  eight outcomes, four criteria each, no duplicates, unknown Bloom dropped).
  `app/server/courseDesign.server.ts` keeps the brief in the course where it was empty, calls the
  model once more on a broken answer, and stores no outcome: the teacher reviews them in the same
  `ProposalForm` as an import and `import-apply` adds what is ticked. The feature `courseDesign`
  switches it off (the action is then a 404). Evals: `npm run eval:design`.
- **Course wizard (step 2).** A course with outcomes and no tests (`canDesignAssessments`) shows
  "Volgende stap: het toetsprogramma" on the overview (`CourseDesignAssessments`), posting
  `design-assessments` with the school's assessment forms (optional). `designAssessments.ts` numbers
  the course's own outcomes (with Bloom and criteria) for `course-design-assessments@v1` and checks
  the answer into an `ImportProposal` over those outcomes (`existing: true`, sent as hidden fields):
  coverage only to outcomes that exist, a week inside the course, no weight on a formative test, at
  most eight tests, the form in `details.form`. Weights are never corrected: `weightsOff` and
  `uncovered` (outcomes in no summative test) are shown above the tests, and the weight field reads
  "Weging (voorstel van de AI)". Same server path as step 1 (`propose` in `courseDesign.server.ts`:
  feature, quota, one retry, nothing stored); `import-apply` adds what is ticked. Evals:
  `npm run eval:design-assessments`.
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
  not shown and not counted on Start; its stored reviews stay. No hat on = no panel. Below that, the
  teacher ticks which hats review (BESLUIT-2026-11-10-1): `agent_choices` per (user, hat), absent =
  the hat's `teacherDefault`; `chosenAgents` in the registry. The panel's boxes post with
  `agentsChosen=1`, so "none ticked" differs from "no boxes"; the choice is saved at the review and
  holds for all the teacher's courses. A hat the teacher switched off is run, shown and counted like
  an admin-off hat (not at all). Every hat has a `focus` line and its own section in the help topic
  `review-team` (`tests/help.test.ts`). Linked work
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
    assessment-models/ schema · starters · pick (frameworks per document type), all pure
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
npm run check      # Biome (lint + format); a warning fails it too (--error-on-warnings)
npm run build      # production build
npm run test:e2e   # browser tests: the production build in Chromium, axe (WCAG 2.2 AA) + CSP
npm run test:mutation  # Stryker mutation testing on the core (slow; nightly in CI)
```

**Browser tests** (`e2e/`, Playwright). `npm run test:e2e` builds the app, seeds a throwaway
database (`e2e/.data/`, one teacher and one admin from `e2e/users.ts`) and opens every page in
`e2e/pages.ts` as the right user. Each page must load, have no axe violations at WCAG 2.2 AA and
log no CSP violation. A new key page is one line in `e2e/pages.ts`; `tests/e2e-setup.test.ts`
checks every path against the route table. Locally once: `npx playwright install chromium`.
CI runs it as its own job, next to the gate, but only when the repository variable
`E2E_IN_CI` is `true`. For now it is off (BESLUIT-2026-11-11-9): the GitHub runner could not
install Chromium. Until it is back on, a worker runs `npm run test:e2e` itself on every PR that
touches `app/`, `e2e/`, `playwright.config.ts` or dependencies, and puts the result in the PR (the
template asks for it; `AGENTS.md` says how in a sandbox with its own browser, via
`PLAYWRIGHT_CHROMIUM_PATH`). A skipped job counts as passed for a required
check. To switch it back on: *Settings → Secrets and variables → Actions → Variables*, add
`E2E_IN_CI` = `true`; the next run of a PR or `main` runs the browser tests again.

**Mutation testing** (Stryker, `stryker.config.json`). Stryker makes small changes (mutants) to
the core, the registry logic (not its data: `tools/`, `goals.ts`, `keywords.ts`), auth, the
repositories, the rate limiter and the login throttle, and checks that a test fails for each one. A surviving mutant points at a line no test really pins
down. A full run takes far longer than the gate, so it is not part of it: the workflow
`.github/workflows/mutation.yml` runs it nightly and by hand (*Run workflow*), and keeps the HTML
report as the `mutation-report` artifact. The score is advisory (no `break` threshold yet). One
file locally: `npx stryker run --mutate app/server/rateLimit.server.ts`.
`tests/deploy/mutation-testing.test.ts` checks that every mutate pattern still matches a file, so a
moved module cannot drop out silently.

A Biome warning (dead code, a non-null assertion) fails the gate just like an error
(`tests/quality-gate.test.ts`). Fix the cause; don't add a `biome-ignore`. Every Biome a11y rule
is on; a wrapper that renders a native control (`Select`, `StandSelect`) is listed in
`noLabelWithoutControl.inputComponents`, so a `<label>` around it counts as labelled.

**Security scanning** runs on GitHub itself (`tests/security-scan.test.ts`). The CI job `audit`
runs `npm audit`: production dependencies must be clean from *moderate* up, the whole tree (dev
tools such as Stryker too) blocks only from *high*, so a moderate finding deep in dev tooling
doesn't need an `overrides` workaround. `.github/workflows/codeql.yml` runs CodeQL
(`security-extended`) on every pull request, on `main` and weekly; findings appear under
*Security › Code scanning*. `.github/dependabot.yml` opens weekly update PRs for npm and GitHub
Actions: minor and patch bundled in one PR per ecosystem, each major version apart.

## Related

- [Context Model](Context-Model.md) · [Tools](Tools.md) ·
  [Internationalization](Internationalization.md) · [Adding a Tool or Pack](Adding-a-Tool-or-Pack.md)
- [Authentication](Authentication.md) · [Deployment](Deployment.md) ·
  [Compliance](Compliance.md)
- Program docs: [audit](../docs/Audit-2026-07.md) · [improvement plan](../docs/Improvement-Plan.md) ·
  [phase briefs](../docs/implementation/README.md)
