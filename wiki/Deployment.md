# Deployment

How to run LimeOnIt in production. The app is a single Node process (React Router
7 + `react-router-serve`) backed by a local SQLite file, so it deploys as one
container with one persistent volume. No external SaaS is required.

---

## Container

The [`Dockerfile`](../Dockerfile) is a multi-stage build on `node:24-alpine`
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
3. Kopieer `limeonit.db` **plus** `limeonit.db-wal` en `limeonit.db-shm` van het volume (of maak
   een back-up met `sqlite3 limeonit.db ".backup limeonit-voor-p18.db"`).
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
| `RATE_LIMIT_PER_MINUTE` | no | Default 10 (per user). |
| `RATE_LIMIT_CONCURRENT` | no | Default 3 (per user). |
| `DAILY_REQUEST_LIMIT` | no | Default 50 (per user/day; admins exempt). |
| `DAILY_OUTPUT_TOKEN_LIMIT` | no | Default 200000 (enforced only once token data is surfaced). |
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
do not fall back to `default-src`. If you later add an external resource (a new font host,
analytics, an image CDN, a cross-origin API), extend the relevant directive in
`securityHeaders.server.ts` or it will be blocked.

## Smoke checklist (run after each deploy)

1. `GET /healthz` → `200 {"ok":true}`.
2. Log in with a seeded invite (`npm run invite` locally to mint one; see
   [`Authentication.md`](Authentication.md)).
3. Generate with a cheap model (e.g. Haiku) → tokens stream into the result.
4. Open **My work** → the generation was saved.
5. Rate a generation 👍/👎 with a comment → it lands on `/admin/usage`
   (as an admin).
6. Set `DAILY_REQUEST_LIMIT=1`, restart, generate twice → the 2nd trips the
   localized "daily limit reached" error; an admin is exempt.
7. Check container logs → one structured JSON line per generation
   (`{"event":"generation",...,"outcome":"ok"}`), **no prompt/response content**.
8. Browser console shows **no CSP violations** → flip CSP to enforcing.
