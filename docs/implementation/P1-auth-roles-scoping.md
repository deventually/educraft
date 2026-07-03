# Phase 1 — Invite Auth, Roles & Per-User Scoping

## Context & goal

There is no user concept: any visitor can read and delete every context profile and project (`app/routes/context-profiles.tsx:25`, `app/routes/projects._index.tsx:11`), and the LLM endpoint is anonymous. The schema scaffolds nullable `user_id` columns that are never populated (`app/server/schema.server.ts:6,47`).

This phase introduces **invite-link authentication** (token URL → account with password → session cookie) with **three roles** (`student`, `teacher`, `admin`), scopes all data to its owner, adopts **real drizzle-kit migrations**, and installs two future-proofing seams: fully **async repositories** (so a Postgres/MySQL port stays a port, not a rewrite) and a **`getDb()` indirection** instead of a module-level DB singleton (so the hosted database-per-tenant model stays open).

Design intent: institutional SSO (SURFconext/SAML/OIDC) later replaces *only* the login/invite front door and role mapping. Sessions, `requireUser`, roles, and data scoping built here are permanent.

Audit findings closed: #1 (completes Phase 0), #2, #12, #14.

## Constraints

- `AGENTS.md` contract: TDD, gates, bilingual UI strings, axe test for every new interactive component.
- No auth framework/dependency (no better-auth, no Auth.js): React Router's `createCookieSessionStorage` + `node:crypto` scrypt. Rationale: minimal surface, SSO replaces the front door later anyway.
- No new native dependencies (no bcrypt/argon2 packages) — `crypto.scrypt` is built in and sufficient at this scale.
- Do not build multi-tenancy or org structures. Roles are instance-level.
- Dev databases are disposable pre-launch: it is acceptable that developers delete `./data/limeonit.db` once when migrations land. Say so in the commit message.

## Features

### 1.1 Schema additions & real migrations

**File:** `app/server/schema.server.ts` — add:

```ts
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),                       // crypto.randomUUID()
  name: text("name").notNull(),
  email: text("email").unique(),                     // nullable; invites may be nameless
  passwordHash: text("password_hash").notNull(),     // "scrypt:<saltHex>:<hashHex>"
  role: text("role").notNull().default("teacher"),   // "student" | "teacher" | "admin"
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const invites = sqliteTable("invites", {
  token: text("token").primaryKey(),                 // 32+ random bytes, base64url
  role: text("role").notNull().default("teacher"),
  note: text("note"),                                // who this was for
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  usedByUserId: text("used_by_user_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
```

**Migrations:** `drizzle.config.ts` already targets `./drizzle`. Do:
1. Delete `ensureSchema()` from `app/server/db.server.ts`.
2. `npm run db:generate` to produce the baseline migration covering **all** tables (existing five + new two).
3. Run migrations automatically on boot: in `db.server.ts`, after `drizzle(sqlite, { schema })`, call `migrate(db, { migrationsFolder })` from `drizzle-orm/better-sqlite3/migrator`. Resolve the folder robustly for both dev and the built server bundle (test `npm run build && npm start` — if path resolution in the bundle is brittle, copy `drizzle/` into the Docker image and read the path from env `MIGRATIONS_DIR` with a sensible default).
4. `npm run db:migrate` (tsx `app/server/migrate.ts`) stays as the manual/CI entry point; have it call the same migrator.

### 1.2 `getDb()` seam (tenancy insurance)

**File:** `app/server/db.server.ts` — stop exporting a `db` const. Export `getDb(): Db` that today returns the lazily-created singleton (keep the `globalThis` HMR cache). All repository files switch from `import { db }` to calling `getDb()` at use time. One indirection, zero behavior change — later, the hosted SaaS resolves it per tenant.

### 1.3 Async repositories (portability insurance)

**Files:** `app/server/repositories/profiles.server.ts`, `generations.server.ts` (and any repo added later). Every exported function becomes `async` and returns a `Promise`, even though better-sqlite3 resolves synchronously. Update all call sites (loaders/actions are already async): `app/routes/context-profiles.tsx`, `projects._index.tsx`, `api.stream.tsx`, `tool.tsx`, and any component-test mocks. **Rule going forward (add to the repo file header comment): all DB access goes through repositories; repository signatures are async; no better-sqlite3 API outside `db.server.ts`.**

### 1.4 Password hashing & sessions

**New file:** `app/server/password.server.ts` — `hashPassword(pw)` / `verifyPassword(pw, stored)` using `crypto.scrypt` (N=16384, r=8, p=1, 32-byte key, random 16-byte salt, `timingSafeEqual`; store as `scrypt:<saltHex>:<hashHex>`). Enforce a minimum length of 10 chars at the form boundary (Zod).

**New file:** `app/server/session.server.ts` — `createCookieSessionStorage` with `{ name: "__session", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", secrets: [env.SESSION_SECRET], maxAge: 60 * 60 * 24 * 30 }`. Session data: `{ userId: string }` only — role is always read fresh from the DB (role changes take effect without re-login).

**File:** `app/server/env.server.ts` — add `SESSION_SECRET: z.string().min(32)` with a dev-only default (`.default()` guarded: refuse to boot in production without a real value — e.g. `.refine` when `NODE_ENV === "production"`).

### 1.5 Auth helpers

**New file:** `app/server/auth.server.ts`:

```ts
export async function getUser(request: Request): Promise<User | null>;
export async function requireUser(request: Request): Promise<User>;          // throws redirect("/login")
export async function requireRole(request: Request, ...roles: Role[]): Promise<User>; // throws 403 Response
export async function createUserSession(userId: string, redirectTo: string): Promise<Response>;
export async function logout(request: Request): Promise<Response>;
```

Plus **new file** `app/server/repositories/users.server.ts` (async, via `getDb()`): `createUser`, `getUserById`, `getUserByEmail`, `createInvite`, `getInvite`, `consumeInvite` (mark `usedByUserId`, single-use, atomic — reject if already used or expired), `deleteUser` (Phase 2 wires cascade).

### 1.6 Routes: invite, login, logout — and gating everything else

**File:** `app/routes.ts` — add outside the AppShell layout: `route("invite/:token", "routes/invite.tsx")`, `route("login", "routes/login.tsx")`, `route("logout", "routes/logout.tsx")` (resource route, POST only).

- `invite.tsx`: loader validates the token (unknown/used/expired → friendly localized error page). Form: name, optional email, password (+ repeat). Action: re-validate token, create user with the invite's role, consume invite, `createUserSession` → redirect `/`.
- `login.tsx`: email + password; on success session → `/`. Generic failure message (no user enumeration). Localized, accessible (labels/`htmlFor`, `aria-describedby` on errors).
- `logout.tsx`: POST action destroying the session → redirect `/login`. Add a logout button + current-user name to the `AppShell` user area.
- **Gating:** loaders run in parallel in React Router — a layout loader does NOT protect children. Add `await requireUser(request)` to the **loader of every protected route**: `home.tsx`, `tool.tsx`, `projects._index.tsx`, `context-profiles.tsx`, `help._index.tsx`, `help.$id.tsx`, `about.tsx`, `contact.tsx` — and to the **actions** of `context-profiles.tsx`, `projects._index.tsx`, and `api.stream.tsx`. Public: `login`, `invite/:token`, `set-locale`, `legal`, `cookies`, `devtools-probe` (decide: legal/cookies public is correct — visitors must be able to read them).
- `api.stream.tsx`: `requireUser` at the top of the action; **the Phase 0 rate-limit key becomes the userId**.

### 1.7 Role-gated tool visibility

The registry already carries `userType: "instructor" | "student"` per tool (`app/lib/registry/types.ts:22,183`). Mapping:
- role `student` → sees/uses only tools with `userType === "student"`.
- roles `teacher`/`admin` → see/use all tools (teachers need to preview student tools).

Enforce in three places (server-side, not just UI): `home.tsx` loader filters the tool list; `tool.tsx` loader throws 404 for a student loading an instructor tool; `api.stream.tsx` refuses generation for a student on an instructor tool (localized SSE error `error.notAllowed`). Implement the mapping once, e.g. `canUseTool(user: User, tool: Tool): boolean` in `app/lib/registry/access.ts` — data-driven, no per-tool branching.

### 1.8 Per-user data scoping

- `saveGeneration`/`upsertChatGeneration` take a required `userId`; `api.stream.tsx` passes the authenticated user's id.
- `listGenerations(userId, limit)`, `deleteGeneration(userId, id)` — delete verifies ownership in the WHERE clause (`and(eq(id), eq(userId))`), not by trusting the client.
- Same for profiles: `listProfiles(userId)`, `getProfile(userId, id)`, `createProfile/updateProfile/deleteProfile` all scoped. `api.stream.tsx` resolves `contextProfileId` **scoped to the requesting user** (today `getProfile(body.contextProfileId)` would fetch anyone's profile — that's finding #2).
- Existing rows have `user_id NULL`; dev DBs are disposable (see Constraints). No backfill logic.

### 1.9 Invite minting script

**New file:** `scripts/invite.ts` + package script `"invite": "tsx scripts/invite.ts"`. Usage: `npm run invite -- --role teacher --note "Jan de Vries" [--expires-days 14]`. Generates `crypto.randomBytes(32).toString("base64url")`, inserts, prints `${APP_ORIGIN}/invite/${token}` (add optional `APP_ORIGIN` to env.server, default `http://localhost:5173`). Phase 4 adds a UI for this; the script stays for ops.

## Test plan (write these first — RED)

- `tests/api/password.test.ts`: hash → verify roundtrip; wrong password fails; distinct salts for identical passwords.
- `tests/api/users-repo.test.ts` (pattern-match `tests/api/generations-repo.test.ts` for the in-memory/temp DB harness): create/get user; invite create → consume is single-use; expired invite rejected.
- `tests/api/profiles-repo.test.ts` (**new — this repo currently has zero coverage**): CRUD scoped by user; user B cannot get/delete user A's profile; `listProfiles(userA)` excludes B's rows.
- `tests/api/auth.test.ts`: `requireUser` redirects without session; returns user with valid session cookie; `requireRole("admin")` throws 403 for a teacher.
- Route-level: `tests/api/invite-flow.test.ts` — full flow: mint invite → GET invite page loader ok → POST action creates user+session → invite consumed → second POST rejected.
- `tests/lib/access.test.ts`: `canUseTool` matrix (student×student-tool ✅, student×instructor-tool ❌, teacher×both ✅).
- Component: `tests/components/login.test.tsx` and `invite.test.tsx` — render, labels wired, error state, axe zero violations.
- Update existing component tests whose mocks call now-async repos or now-gated loaders (expect breakage in `home`/`projects`/`context-settings` tests; fix by mocking `auth.server`).

## Acceptance criteria

- [ ] Unauthenticated requests to any app page redirect to `/login`; unauthenticated `api.stream` POST gets a localized SSE auth error (or redirect response — pick one, test it).
- [ ] Invite URL → account creation → landing on home as that user; the invite is single-use and expiry is honored.
- [ ] A `student` account sees only student tools on home, gets 404 on an instructor tool URL, and cannot generate via a hand-crafted `api.stream` POST for an instructor tool.
- [ ] User B cannot list, read, or delete user A's profiles/projects — verified by repo tests *and* one manual two-browser walk-through.
- [ ] Fresh clone: `npm ci && npm run dev` boots, migrations create the schema (no `ensureSchema` left); `npm run build && npm start` also boots with migrations.
- [ ] Rate-limit key is the userId.
- [ ] All gates green; every new component has an axe test.

## Out of scope

SSO of any kind, email sending, password reset (test-drive scale: owner re-invites; note this in `wiki/`), org/tenant structures, admin UI for invites (Phase 4), delete-my-data cascade (Phase 2), quota (Phase 2).
