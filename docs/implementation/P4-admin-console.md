# Phase 4 — Admin Console & Instance Configuration

> **Status: ✅ shipped** on branch `p4-admin-console`. Beyond this brief, the following was added at the owner's request: a **per-teacher tool allow-list** on admin-minted invites; **teacher-only invites** (admins are created via `npm run create-admin` or in-place promotion — never by invite, see [`docs/Tenancy-and-Admin.md`](../Tenancy-and-Admin.md)); **admin cohort oversight** (`/admin/cohorts` — list all, delete any); **multi-teacher cohorts** (assign/remove co-teachers, `cohort_teachers` table); and an **admin↔teacher "view as" switch** (`getEffectiveRole` + `/set-view`). `/admin/cohorts` was added to the route list below.

## Context & goal

The tool catalog will keep growing, and per the product model **admins configure what's available on their instance**: which tools end users see, for which audience, and which LLMs may be selected. Today availability is hardcoded (registry `enabled` flag; Phase 0's `clientSelectable` model flag). This phase makes availability **DB-backed instance configuration** with an admin console, and gives admins the operational views (invites, usage, feedback) that Phases 1–2 created data for.

Principle: **code defines what exists, the DB configures what's available.** New tools still ship as registry code (AGENTS.md recipe); admins switch them on/off. Because settings live in the instance's own database, per-tenant configuration in the future hosted SaaS comes for free with database-per-tenant.

## Constraints

- `AGENTS.md`: TDD, gates, bilingual UI, axe test per new interactive component, tools-as-data (resolution logic is generic — never `if (slug === ...)`).
- All admin routes gated by `requireRole("admin")` (server-side, loader + action).
- Availability must be enforced **server-side** (loader/action/api.stream), not just hidden in the UI.
- Safe defaults: with zero rows in settings tables, behavior is identical to Phase 3's (registry `enabled` + `clientSelectable` catalog flags). An admin misclick must never brick the instance (see 4.2 guard).
- **Revised order — runs after P6/P7:** cohorts, curated invites, and cohort-aware `canUseTool` already exist. Instance availability here is an **independent gate** that composes *on top* of cohort provisioning — a student sees `available ∩ audience ∩ cohort allowlist`. Do **not** rebuild P6's provisioning flow.

## Features

### 4.1 Settings storage

New tables (drizzle-kit migration):

```ts
export const toolSettings = sqliteTable("tool_settings", {
  toolSlug: text("tool_slug").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }),          // null = registry default
  audienceOverride: text("audience_override"),               // null | "student" | "instructor" | "both"
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const instanceSettings = sqliteTable("instance_settings", {
  key: text("key").primaryKey(),                             // e.g. "enabledModels"
  valueJson: text("value_json").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
```

**New file:** `app/server/repositories/settings.server.ts` (async, `getDb()`): `getToolSettings()`, `setToolSetting(slug, patch)`, `getEnabledModels(): Promise<string[] | null>` (null = default), `setEnabledModels(ids)`.

### 4.2 Effective-availability resolution

**New file:** `app/server/availability.server.ts` — the single module every consumer uses:

- `getAvailableTools(user)`: registry tools where `(setting.enabled ?? tool.enabled) === true`, filtered by audience: `audienceOverride ?? tool.userType` matched against the user's role via the Phase 1 `canUseTool` logic (extended to honor `"both"`). **Compose with P6:** for a student in a cohort, also pass the cohort `allowedSlugs` into `canUseTool` — instance availability and cohort provisioning are independent gates and a tool must pass both.
- `getSelectableModels()`: catalog models where `clientSelectable && (enabledModels === null || enabledModels.includes(id))`, plus discovered local models (always allowed — they're free). **Guard:** if the intersection is empty, fall back to the catalog default (`DEFAULT_MODEL`) and log a warning — an admin can't lock everyone out.
- Consumers to rewire: `home.tsx` loader (tool list), `tool.tsx` loader (404 when unavailable), `api.stream.tsx` (refuse generation for disabled tool / non-selectable model — the Phase 0 `isClientSelectable` check's implementation moves here, call sites unchanged), model pickers (`pickableModels` gets its allow-list from the loader instead of module scope — check how `ToolControls` receives models today via `localModels` prop and extend that data flow).

### 4.3 Admin routes

Add under a layout `route("admin", "routes/admin.tsx", [...])` in `routes.ts`; the layout loader does `requireRole("admin")` **and every child loader/action repeats it** (loaders run in parallel — same rule as Phase 1). Link "Beheer / Admin" in AppShell for admins only.

- **`/admin/tools`** — table of all registry tools: name, userType, mode, phase, effective status; toggle enabled; audience override select (default/student/instructor/both). Form-post actions (no JS-only interactions), optimistic UI optional.
- **`/admin/models`** — catalog models with checkboxes (only `clientSelectable` ones listed); empty-selection guard surfaced in UI ("at least one model required").
- **`/admin/invites`** — **student/cohort provisioning lives in P6** (`/cohorts`); this admin view is instance-wide **oversight + role-only ops invites**: list all invites (status open/used/expired, creator, cohort if any), revoke open ones, and mint **teacher/admin** invites (role select, note, expiry) with a copy button. Link out to P6's provisioning for student invites — don't duplicate the cohort flow. Also list users (name, role, created, last-activity if cheaply available) with a role-change select (admin cannot demote themselves — guard).
- **`/admin/usage`** — per-user per-day table from the `usage` table (last 14 days), totals per tool from the generation log if cheaply queryable (else per-user only; don't build analytics infrastructure).
- **`/admin/feedback`** — restyle the Phase 2 plain list into the console layout; filter by tool.

### 4.4 UI conventions

Follow the existing app shell/component idiom (check `AppShell.tsx`, `ui.tsx`, home tables/cards; Grove theme tokens in `app.css`). All strings bilingual through `messages/{nl,en}.ts`. Semantic tables (`<caption>`, `th scope`), labeled controls, focus-visible — every route gets an axe test.

## Test plan (write these first — RED)

- `tests/api/settings-repo.test.ts`: tool setting upsert; enabledModels roundtrip; null semantics (absent row = default).
- `tests/lib/availability.test.ts`: matrix — registry-enabled tool with no row → available; row `enabled:false` → hidden for everyone incl. admin tool page 404; `audienceOverride:"both"` exposes an instructor tool to students; empty enabledModels intersection → fallback to default model + warning.
- `tests/api/admin-access.test.ts`: every `/admin/*` loader and action rejects teacher/student (403) and anonymous (redirect).
- Route behavior: disabling a tool takes effect immediately for a *different* user's next request (no caching bug — if availability is cached, bust it on write; simplest is no caching).
- `tests/api/stream-availability.test.ts` (extend stream harness): generation refused (localized SSE error) for a disabled tool; model outside enabledModels falls back to default.
- Component + axe: `tests/components/admin-tools.test.tsx`, `admin-models.test.tsx`, `admin-invites.test.tsx`, `admin-usage.test.tsx`, `admin-feedback.test.tsx` — render with mocked loader data, exercise one mutation each, zero axe violations.
- Guards: self-demotion blocked; empty model list blocked.

## Acceptance criteria

- [ ] Admin disables a tool → it vanishes from another user's home on refresh, its URL 404s, and a hand-crafted `api.stream` POST is refused. Re-enabling restores it. Same flow for models.
- [ ] Fresh instance with empty settings tables behaves exactly as before this phase (regression: existing home/tool tests still pass unmodified except for loader wiring).
- [ ] Invites can be minted, copied, and revoked in the UI; a revoked invite's URL shows the friendly error; user roles can be changed and take effect on next request (Phase 1 reads role from DB per request — verify).
- [ ] Usage and feedback views render real data; no admin route is reachable as teacher/student/anonymous.
- [ ] An admin cannot lock the instance: at least one selectable model always resolves; admin cannot demote themselves.
- [ ] All gates green; every new interactive component has a zero-violation axe test.

## Out of scope

Per-*cohort* student tool assignment (**delivered by P6**, not this phase's per-instance availability), tool *configuration* beyond enabled/audience (no per-instance prompt editing), analytics dashboards/charts, audit trail of admin actions, multi-tenant settings sync.
