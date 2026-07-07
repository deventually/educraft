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
`isToolAvailable` (`app/server/availability.server.ts` — instance settings + role/cohort
`canUseTool` + per-teacher allow-list) before any provider call. The registry is
validated at boot (`registry/boot.server.ts`): dev fails fast, prod excludes the bad tool.

---

## Providers (model-agnostic)

LimeOnIt is not tied to one model vendor.

- **Vercel AI SDK v7** adapter (`app/lib/ai/adapters/aisdk.ts`) — Anthropic, Ollama,
  LM Studio, and any configured OpenAI-compatible endpoint.
- **CLI** adapter (`app/lib/ai/adapters/cli.ts`) — drives local agent CLIs
  (Claude Code, opencode, codex, gemini) as subprocesses (prod-guarded).
- **Dynamic discovery** (`app/lib/ai/discover.server.ts`) — local Ollama/LM Studio
  models are discovered at runtime (queried per `/v1/models`), not hard-coded.
- **Configured endpoint** — a `compat::<model>` id points at any frontier or
  self-hosted model that speaks the OpenAI API (ChatGPT, Gemini, Mistral, GLM,
  DeepSeek, OpenRouter, vLLM, …), via `OPENAI_COMPAT_BASE_URL` /
  `OPENAI_COMPAT_API_KEY` in `.env`. It's a *paid remote* model, so — like Opus —
  it is **not** client-selectable: reachable as a configured default (e.g. the
  summary sweep's `--model`), never forced from a request body.
- `models.ts` holds the static catalog + the `compat::`/local id schemes;
  `provider.ts` routes a model id to an adapter; `credentials.ts` maps a provider
  to the `.env` var it needs (or none, for local/CLI). All keys come from
  `.env` through `env.server` — never hardcoded or read ad hoc.
- Default model: `claude-sonnet-4-6`.
- **Availability (P4/P13/P14).** Which models a caller may *pick* is governed by a
  three-level INTERSECT — instance `enabledModels` → per-teacher `assignedModels` →
  per-cohort `allowedModelsJson` (each level narrows, never widens; unset = inherit).
  Since **P14** this also governs local/CLI/discovered models (still free, now
  curatable — no silent free-pass): `availability.server.ts#isModelSelectableForUser`
  is a membership walk over the three levels, so it gates a volatile `ollama::…` id
  without enumerating any local server. Opus-class + `compat::` stay server-only.
  Students never pick; the gates only bound what admin/teacher may *offer*.

This matters for the vision: institutions in different countries can run LimeOnIt on
**their** chosen engine and infrastructure (local-first included).

---

## Stack

React Router 7.15 (framework mode, SSR) · TypeScript · Tailwind v4 (CSS-first) ·
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
    i18n/            messages/{nl,en}.ts · index · format · localized
    registry/        … · access.ts (roles + canUseTool) · boot.server.ts (boot validation)
    hooks/           useSandbox (shared values/profile/locked-mode across the tool surfaces)
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
- [Authentication](Authentication.md) · [Mentor Insight](Mentor-Insight.md) ·
  [Deployment](Deployment.md) · [Compliance](Compliance.md)
- Program docs: [audit](../docs/Audit-2026-07.md) · [improvement plan](../docs/Improvement-Plan.md) ·
  [phase briefs](../docs/implementation/README.md)
