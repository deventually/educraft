# Deployment

How to run LimeOnIt in production. The app is a single Node process (React Router
7 + `react-router-serve`) backed by a local SQLite file, so it deploys as one
container with one persistent volume. No external SaaS is required.

---

## Container

The [`Dockerfile`](../Dockerfile) is a multi-stage build on `node:26-alpine`
(aligned with the Volta pin), run with [`docker-compose.yml`](../docker-compose.yml)
and a `.env` (from `.env.example`). The installer's guide, in Dutch, is
[`docs/installatie-docker.md`](../docs/installatie-docker.md). The final image ships
only what runs, as the non-root `node` user with `NODE_ENV=production`:

- the production `build/`, including the **ops scripts** bundled to plain JS
  (`build/ops/{migrate,create-admin,set-owner,invite}.js`, built by
  `scripts/ops.config.ts` as part of `npm run build`), so they run with bare `node`
  (no tsx, no TypeScript source);
- production `node_modules`;
- the **`drizzle/` migrations folder** (`MIGRATIONS_DIR=/app/drizzle`).

Migrations apply automatically on the first DB access (`getDb()` runs the
drizzle migrator on connect, see `app/server/db.server.ts`), so a fresh volume is
provisioned on boot; `node build/ops/migrate.js` runs the same migrator by hand.
`CMD` is `npm run start`; a `HEALTHCHECK` probes `/healthz`. `tests/deploy/` pins
the image shape and runs the ops bundle against a throwaway database.

Production cookies are `Secure`: serve the container behind HTTPS (a reverse proxy)
unless it is only opened on `localhost`.

## Volume (production DB shape)

The image defaults to `DATABASE_URL=file:/data/limeonit.db` and declares `/data` a
volume; `docker-compose.yml` pins that URL and mounts the named volume
`limeonit-data` (or the host folder in `LIMEONIT_DATA`, writable by uid 1000) there. The SQLite file (plus its WAL sidecars) lives there and survives
redeploys. Without a mounted volume the database is ephemeral and every deploy
starts empty.

```
DATABASE_URL=file:/data/limeonit.db   # volume mounted at /data
```

## Several institutions (one app, a database each)

Set `TENANTS` (JSON) to serve several institutions from one container, each on its own SQLite
file on the same volume, chosen by the address the request comes in on:

```
TENANTS=[{"id":"hsl","hosts":["hsl.limeonit.nl"]},{"id":"hhs","hosts":["hhs.limeonit.nl"]}]
```

- Without `database`, an institution's file is `<id>.db` next to `DATABASE_URL` (`/data/hsl.db`).
- Every host name points at the same container (DNS + the reverse proxy, which must pass the
  original `Host`). Any other address gets a 404; only `/healthz` answers everywhere.
- Each database is migrated at boot and backed up daily into `backups/<id>/`.
- Ops scripts need the institution: `LIMEONIT_TENANT=hhs node build/ops/create-admin.js …`.
- Sessions are host-only cookies, so a login at one address is not one at the other.

Adding an institution: a line in `TENANTS`, a DNS record, a restart; then its first admin with
`create-admin`. Details: [Tenancy & Admin](../docs/Tenancy-and-Admin.md).

## Back-up vóór een destructieve migratie

Migraties draaien automatisch bij de eerste database-toegang na een deploy. Migratie `0008`
(P17.3) wist studentaccounts en hun data definitief en laat de cohort- en inzichttabellen vallen.
Migratie `0010` (P18.8) laat de tabellen `chat_sessions`, `messages` en `projects` en de kolommen
`allowed_tool_slugs` en `project_id` vallen, ruimt verouderde instellingssleutels op en verwijdert
open beheerdersuitnodigingen. Doe daarom vooraf:

1. Stop de app eerst, zodat de aantallen niet meer veranderen tussen tellen en back-up.
2. Tel de rollen: `SELECT role, COUNT(*) FROM users GROUP BY role;` en noteer de aantallen.
   Voor `0010` ook: `SELECT COUNT(*) FROM chat_sessions;`, `SELECT COUNT(*) FROM messages;`,
   `SELECT COUNT(*) FROM projects;` en `SELECT COUNT(*) FROM generations;`. Kijk ook of er oude
   uitzonderingen per docent zijn (die verdwijnen in `0010`):
   `SELECT COUNT(*) FROM users WHERE allowed_tool_slugs IS NOT NULL;` en
   `SELECT key, value_json FROM instance_settings WHERE key LIKE 'contextCustomAccess:%' OR key LIKE 'assignedSectors:%' OR key LIKE 'assignedDomains:%';`.
   Staat er iets, zet dan eerst de instelling ruim genoeg op `/admin/context`.
3. Maak een back-up: `node build/ops/backup.js` (of `npm run backup`); hij komt in `backups/`
   naast de database.
4. Bewaar de back-up buiten de repo. Hij bevat verwijderde data (studentdata vóór `0008`, oude
   chattranscripten vóór `0010`): verwijder hem na een korte, door de beheerder gekozen termijn.
5. Deploy (of start de app weer). Tel daarna opnieuw: geen `student`, dezelfde aantallen docenten
   en beheerders, en voor `0010` hetzelfde aantal `generations`. Een docent logt in en ziet zijn
   het resultaat onder Mijn werk.
6. Terugdraaien = de app stoppen, de back-up terugzetten op het volume en de vorige image deployen.

## Environment checklist

| Var | Required | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | for Claude | Omit only if using a local model exclusively. |
| `SESSION_SECRET` | **yes (prod)** | 32+ chars. Boot refuses the dev default when `NODE_ENV=production`. |
| `APP_ORIGIN` | recommended | Absolute origin, e.g. `https://limeonit.example.eu` (used for invite URLs). |
| `DATABASE_URL` | yes | `file:/data/limeonit.db` with a mounted volume (see above). |
| `NODE_ENV` | yes | `production`. |
| `MIGRATIONS_DIR` | no | Defaults to `./drizzle` (already in the image). |
| `BACKUP_DIR` | no | Daily online backup (rotation 7 days, 4 weeks). Unset: `backups/` next to the database in production (`/data/backups`), off in development. `off` turns it off. `npm run backup` / `node build/ops/backup.js` makes one now; `restore` puts one back with the app stopped. The admin console shows the age of the newest backup (a warning after 36 hours), the database size and the free disk space. See [installatie-docker.md](../docs/installatie-docker.md#6-back-up-en-terugzetten). |
| `RATE_LIMIT_PER_MINUTE` | no | Default 10 (per user). |
| `RATE_LIMIT_CONCURRENT` | no | Default 3 (per user). |
| `DAILY_OUTPUT_TOKEN_LIMIT` | no | Default 200000 output tokens per user per day, a quiet brake on a runaway day; admins exempt, the number of calls is not limited (the tool stream and the dossier calls report tokens; CLI agents do not). |
| `CLIENT_IP_HEADER` | no | Header with the real client IP, set by your reverse proxy (e.g. `x-real-ip`). Login then also caps one IP at 30 failures per 15 minutes, on top of the always-on 5 per email address. Leave unset if the proxy does not overwrite the header. |
| `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` / `MISTRAL_API_KEY` | no | Only if those providers are offered. |
| `OPENAI_COMPAT_BASE_URL` / `OPENAI_COMPAT_API_KEY` | no | A configured OpenAI-compatible endpoint (ChatGPT, Gemini, Mistral, GLM, DeepSeek, OpenRouter, vLLM, …), referenced by a `compat::<model>` id. Key optional for a keyless self-hosted endpoint. |
| `OLLAMA_BASE_URL` / `LMSTUDIO_BASE_URL` | no | Local model endpoints. Used only in development (`NODE_ENV` not `production`); a production process (`npm start`, Docker) does not discover or offer local or CLI models. |

### EU hosting / data residency

For an EU-hosted deployment (AVG/GDPR data residency), **Fly.io `ams`
(Amsterdam)** or **Hetzner** both fit. The host choice is the owner's. Note that
Anthropic/OpenAI inference leaves the EU unless a local model (Ollama/LM Studio,
development mode only)
is used — see [`Compliance.md`](Compliance.md).

## Health probe

`GET /healthz` is public (no auth) and returns `200 {"ok":true}` after a trivial
DB probe, or `503 {"ok":false}` if the database is unreachable. Wire it to the
orchestrator's healthcheck (Docker `HEALTHCHECK`, Fly `[[services.http_checks]]`,
a load-balancer probe).

## Errors and request ids

Every request gets a fresh random id from the first root middleware
(`app/server/requestId.server.ts`), returned as the `X-Request-Id` response header. An id the
client sends is ignored. An unexpected error in a loader, an action or while rendering
(React Router's `handleError` in `entry.server.tsx`) becomes one JSON line on stderr:
`{"ts":…,"event":"unexpected_error","requestId":…,"method":…,"path":…,"name":…,"message":…,"stack":…}`
(`app/server/errorLog.server.ts`). The path has no query string, message and stack are capped,
and a request body is never logged. A thrown `Response` (404, 403, redirect) and an aborted
request are not errors.

The owner (super admin) sees the newest 50 on **Beheer → Recente fouten** (`/admin/errors`);
another admin gets a 404. That list lives in memory, so it starts empty after a restart; the
server log keeps the full history. When a teacher reports a problem, search the log for the
request id or the time. The error page a teacher sees (`ErrorReportHint` under the root
`ErrorBoundary`, not on a 404) shows the exact time to the second and the page, to pass on;
"Recente fouten" shows its times in the school's time zone, so the two match.

## Security headers

Every response the app produces carries the baseline headers from
`app/server/securityHeaders.server.ts`: pages (via `entry.server.tsx`) and,
through the root route's `middleware`, data requests and resource routes
(`/api/*`, exports, prints, `/healthz`, redirects). That is CSP,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy`, `Permissions-Policy` and, in production only,
`Strict-Transport-Security: max-age=31536000` (no `includeSubDomains`). Static
build assets under `/assets/*` are served before the app runs and carry no
user content; a reverse proxy may add headers there too.

## Content-Security-Policy

CSP is **enforcing** (`Content-Security-Policy`, see
`app/server/securityHeaders.server.ts`). It shipped report-only in Phase 0 and
was flipped to enforcing during the P2 deploy after a clean browser
click-through of every app surface (login, home, one-shot/grader/chat tools,
projects, account, admin) plus a live generation and feedback submit — all with
zero CSP violations. `frame-ancestors 'none'`, `base-uri 'self'`,
`form-action 'self'` and `object-src 'none'` are set explicitly because they
do not fall back to `default-src`.

**Scripts need a nonce (P2).** `script-src` is `'self'` plus `'nonce-…'`, without
`'unsafe-inline'`. The root middleware picks a fresh 128-bit nonce per request and puts it
in the router context (`cspNonceContext`); `entry.server.tsx` hands it to
`<ServerRouter nonce>` and `renderToPipeableStream({ nonce })`, so React Router's hydration
scripts, `<Scripts>`, `<ScrollRestoration>` and React's streaming scripts carry the same
nonce the header names. An injected inline script has no nonce and is refused. Never write
an inline `<script>` yourself; put code in a module. Responses without a page (API,
exports, redirects) allow no inline script at all. Zod runs jitless (`app/lib/zodCsp.ts`),
because its `new Function` probe would otherwise be reported as a violation (there is no
`'unsafe-eval'`). Styles keep `'unsafe-inline'`: React renders `style` attributes, which a
nonce cannot cover. `tests/server/cspNonceRender.test.ts` renders a page through the real
entry.server and checks that every `<script>` carries the header's nonce.

If you later add an external resource (a new font host,
analytics, an image CDN, a cross-origin API), extend the relevant directive in
`securityHeaders.server.ts` or it will be blocked.

## Smoke checklist (run after each deploy)

1. `GET /healthz` → `200 {"ok":true,"version":"X.Y.Z"}`, with the version you just rolled out.
2. Log in with a seeded invite (`npm run invite` locally to mint one; see
   [`Authentication.md`](Authentication.md)).
3. Generate with a cheap model (e.g. Haiku) → tokens stream into the result.
4. Open **My work** → the generation was saved.
5. Rate a generation 👍/👎 with a comment → it lands on `/admin/usage`
   (as an admin).
6. Set `DAILY_OUTPUT_TOKEN_LIMIT=1`, restart, generate twice → the 2nd trips the
   localized "used a lot of AI today" error; an admin is exempt.
7. Check container logs → one structured JSON line per generation
   (`{"event":"generation",...,"outcome":"ok"}`), **no prompt/response content**.
8. Browser console shows **no CSP violations** (in particular no refused inline script:
   then hydration failed and buttons do nothing).
