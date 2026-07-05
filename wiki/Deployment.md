# Deployment

How to run LimeOnIt in production. The app is a single Node process (React Router
7 + `react-router-serve`) backed by a local SQLite file, so it deploys as one
container with one persistent volume. No external SaaS is required.

---

## Container

The [`Dockerfile`](../Dockerfile) is a multi-stage build on `node:24-alpine`
(aligned with the Volta pin). The final image ships:

- the production `build/`,
- production `node_modules`,
- the **`drizzle/` migrations folder** — required at runtime.

Migrations apply automatically on the first DB access (`getDb()` runs the
drizzle migrator on connect, see `app/server/db.server.ts`), so a fresh volume is
provisioned on boot. `CMD` is `npm run start`.

## Volume (production DB shape)

Set `DATABASE_URL=file:/data/limeonit.db` and **mount a persistent volume at
`/data`**. The SQLite file (plus its WAL sidecars) lives there and survives
redeploys. Without a mounted volume the database is ephemeral and every deploy
starts empty.

```
DATABASE_URL=file:/data/limeonit.db   # volume mounted at /data
```

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
| `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` / `MISTRAL_API_KEY` | no | Only if those providers are offered. |
| `OPENAI_COMPAT_BASE_URL` / `OPENAI_COMPAT_API_KEY` | no | A configured OpenAI-compatible endpoint (ChatGPT, Gemini, Mistral, GLM, DeepSeek, OpenRouter, vLLM, …), referenced by a `compat::<model>` id. Key optional for a keyless self-hosted endpoint. |
| `OLLAMA_BASE_URL` / `LMSTUDIO_BASE_URL` | no | Local model endpoints. |

### EU hosting / data residency

For an EU-hosted deployment (AVG/GDPR data residency), **Fly.io `ams`
(Amsterdam)** or **Hetzner** both fit. The host choice is the owner's. Note that
Anthropic/OpenAI inference leaves the EU unless a local model (Ollama/LM Studio)
is used — see [`Compliance.md`](Compliance.md).

## Health probe

`GET /healthz` is public (no auth) and returns `200 {"ok":true}` after a trivial
DB probe, or `503 {"ok":false}` if the database is unreachable. Wire it to the
orchestrator's healthcheck (Docker `HEALTHCHECK`, Fly `[[services.http_checks]]`,
a load-balancer probe).

## Content-Security-Policy

CSP is **enforcing** (`Content-Security-Policy`, see
`app/server/securityHeaders.server.ts`). It shipped report-only in Phase 0 and
was flipped to enforcing during the P2 deploy after a clean browser
click-through of every app surface (login, home, one-shot/grader/chat tools,
projects, account, admin) plus a live generation and feedback submit — all with
zero CSP violations. If you later add an external resource (a new font host,
analytics, an image CDN, a cross-origin API), extend the relevant directive in
`securityHeaders.server.ts` or it will be blocked.

## Smoke checklist (run after each deploy)

1. `GET /healthz` → `200 {"ok":true}`.
2. Log in with a seeded invite (`npm run invite` locally to mint one; see
   [`Authentication.md`](Authentication.md)).
3. Generate with a cheap model (e.g. Haiku) → tokens stream into the result.
4. Open **Projects** → the generation was saved.
5. Rate a generation 👍/👎 with a comment → it lands on `/admin/feedback`
   (as an admin).
6. Set `DAILY_REQUEST_LIMIT=1`, restart, generate twice → the 2nd trips the
   localized "daily limit reached" error; an admin is exempt.
7. Check container logs → one structured JSON line per generation
   (`{"event":"generation",...,"outcome":"ok"}`), **no prompt/response content**.
8. Browser console shows **no CSP violations** → flip CSP to enforcing.
