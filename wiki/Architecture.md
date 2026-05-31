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
`app/routes/api.stream.tsx`.

---

## Providers (model-agnostic)

LimeOnIt is not tied to one model vendor.

- **Vercel AI SDK v6** adapter (`app/lib/ai/adapters/aisdk.ts`) — Anthropic, Ollama,
  LM Studio.
- **CLI** adapter (`app/lib/ai/adapters/cli.ts`) — drives local agent CLIs
  (Claude Code, opencode, codex, gemini) as subprocesses (prod-guarded).
- **Dynamic discovery** (`app/lib/ai/discover.server.ts`) — local Ollama/LM Studio
  models are discovered at runtime (queried per `/v1/models`), not hard-coded.
- `models.ts` holds the static catalog; `provider.ts` routes a model id to an adapter.
- Default model: `claude-sonnet-4-6`.

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
  server/            env · db (auto-schema) · schema · migrate · repositories/*
docs/                VISION.md
wiki/                this wiki
book/                The Pedagogical Promptbook (source material)
```

---

## Quality gates

```bash
npm test           # registry validation, interpolation, buildSystemPrompt, i18n, providers (57 tests)
npm run typecheck  # react-router typegen + tsc
npm run lint       # Biome
npm run build      # production build
```

## Related

- [Context Model](Context-Model.md) · [Tools](Tools.md) ·
  [Internationalization](Internationalization.md) · [Adding a Tool or Pack](Adding-a-Tool-or-Pack.md)
