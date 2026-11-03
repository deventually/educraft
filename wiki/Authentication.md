# Authentication, Roles & Data Scoping

Introduced in **P1** ([`docs/implementation/P1-auth-roles-scoping.md`](../docs/implementation/P1-auth-roles-scoping.md)).
This page documents the account model as it stands today and the seams left open
for institutional SSO later.

## The model in one line

Invite link → account with a password → signed session cookie → every request is
scoped to its owning user, and every tool is gated by the user's role.

## Roles

Two instance-level roles (no org/tenant structure):

| Role | Sees / uses |
|------|-------------|
| `teacher` | every tool (unless the admin narrows that teacher's allow-list) |
| `admin`   | every tool, plus the admin console |

The roles live in **one place** — `ROLES`/`isRole` in
[`app/lib/registry/access.ts`](../app/lib/registry/access.ts). Which tools a user
may use is decided by `isToolAvailable` in `availability.server.ts` (instance
settings + the per-teacher allow-list) and enforced server-side in three spots:
the home loader (list filter), the tool loader (404), and the `/api/stream` action
(refuse with a localized SSE error). No per-tool branching. A legacy `student` row
(from before P17) can neither log in nor redeem an invite.

## How accounts are created

There is **no public sign-up**. An operator mints an invite:

```bash
npm run invite -- --role teacher --note "Jan de Vries" [--expires-days 14]
```

This prints `${APP_ORIGIN}/invite/<token>`. The recipient opens it, sets a name
(optional email) and a password (min 10 chars), and lands signed in. Invites are
**single-use** (claimed atomically) and honour an optional expiry. P4 adds an admin
UI for this; the script stays for headless ops.

## Sessions & passwords

- Cookie sessions via React Router's `createCookieSessionStorage`
  ([`session.server.ts`](../app/server/session.server.ts)). The cookie stores
  `{ userId, sessionVersion }`; the **role is read fresh from the DB on every
  request**, so a role change takes effect without re-login.
- **Several devices at once, one switch to sign them all out.** Logging in never
  invalidates other sessions (laptop and phone can both be signed in). Only a new
  password does: `updateUserPassword` bumps `users.sessionVersion`, `getUser` rejects
  any cookie with an older version, and the device that changed the password gets a
  fresh cookie so it stays signed in.
- Passwords hashed with Node's built-in `scrypt`
  ([`password.server.ts`](../app/server/password.server.ts)) — no native
  bcrypt/argon2 dependency. Stored self-describing as `scrypt:<saltHex>:<hashHex>`.
- `SESSION_SECRET` (min 32 chars) signs the cookie. A dev default keeps local/test
  boots frictionless; **production refuses to boot** with the dev default.

## Account removal (P17)

Every user (teacher or admin) deletes their own account on `/account`: type the
confirmation word and `deleteUserCascade` removes the account and everything it owns,
immediately and permanently. There is no request/holding state and no `disabledAt`.
An admin can remove other users from the user list in `/admin/invites`.

## Data scoping

Repositories are the only DB access point, every signature is `async`, and every
query is scoped to its owning `userId` in the `WHERE` clause — deletes/reads never
trust a client-supplied id alone. See the header comment in
[`profiles.server.ts`](../app/server/repositories/profiles.server.ts) /
[`generations.server.ts`](../app/server/repositories/generations.server.ts).

Abuse budgets (rate + concurrency) are keyed by **user id**, so limits follow the
account rather than a spoofable IP.

## Password reset — not built (by design)

At test-drive scale there is **no password-reset flow and no email sending**. If a
tester is locked out, the owner simply **mints a fresh invite** (a new account) or,
once the admin UI lands (P4), resets it there. This is a deliberate scope cut, not
an oversight — revisit when the user base grows beyond the invite list.

## What SSO will (and won't) replace

Institutional SSO (SURFconext / SAML / OIDC) later replaces **only** the login /
invite front door and the role mapping. The permanent parts built here —
`createCookieSessionStorage` sessions, `requireUser`/`requireRole`, the two roles,
and per-user data scoping — stay. The `getDb()` seam
([`db.server.ts`](../app/server/db.server.ts)) also keeps the door open for a hosted
database-per-tenant model without a rewrite.
