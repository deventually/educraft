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
| `teacher` | every tool the instance enables |
| `admin`   | every tool, plus the admin console |

The roles live in **one place** — `ROLES`/`isRole` in
[`app/lib/registry/access.ts`](../app/lib/registry/access.ts). Which tools a user
may use is decided by `isToolAvailable` in `availability.server.ts` (instance
settings) and enforced server-side in three spots:
the home loader (list filter), the tool loader (404), and the `/api/stream` action
(refuse with a localized SSE error). No per-tool branching. A legacy `student` row
(from before P17) can neither log in nor redeem an invite.

## How accounts are created

There is **no public sign-up**. An operator mints an invite:

```bash
npm run invite -- --note "Jan de Vries" [--expires-days 14]
```

This prints `${APP_ORIGIN}/invite/<token>`. The recipient opens it, sets a name
(optional email) and a password (min 10 chars), and lands signed in. Invites are
**single-use** (claimed atomically) and honour an optional expiry. P4 adds an admin
UI for this; the script stays for headless ops.

## Superbeheerder (owner, P18.6)

One admin is the **super admin** (code: *owner*). It is not a third role but one key in
`instance_settings` (`ownerUserId`); `isOwner(user)` in
[`auth.server.ts`](../app/server/auth.server.ts) is "role is `admin` **and** the stored id
matches". Set or hand over with:

```bash
npm run set-owner -- --email <e-mail of an existing admin>
```

The script refuses an unknown e-mail or a non-admin. The key is read per request, so the app
can keep running. Until it has run there is **no owner** and nobody can change a role.

| On `/admin/users` | Admin | Super admin |
|---|---|---|
| Invite a teacher, revoke an invite, models per teacher | yes | yes |
| E-mail, reset link, delete — on a **teacher** | yes | yes |
| E-mail, reset link, delete — on an **admin** | no | yes |
| Change a role (teacher ↔ admin) | no | yes |
| Create an account directly, set a password, deactivate / reactivate | no | yes (not on their own account) |
| Anything on their own account | no (use `/account`) | no (use `/account`) |

Every refusal is made in the action (`{ error: "ownerOnly" }`); the page only hides the
controls and marks the owner with a badge. **Invites never make admins**: `/invite/:token` and
`consumeInvite` redeem teacher invites only, and `npm run invite` has no `--role`. The owner
cannot delete their own account on `/account` until ownership is handed over.
A role change voids the user's open reset links (`setUserRole`), so a link a regular admin
minted for a teacher never opens that account once it is an admin.

## Sessions & passwords

- Cookie sessions via React Router's `createCookieSessionStorage`
  ([`session.server.ts`](../app/server/session.server.ts)). The cookie stores
  `{ userId, sessionVersion }`; the **role is read fresh from the DB on every
  request**, so a role change takes effect without re-login.
- **Several devices at once, one switch to sign them all out.** Logging in never
  invalidates other sessions (laptop and phone can both be signed in). Only a new
  password (`updateUserPassword`) or a deactivation (`setUserDisabled`) bumps
  `users.sessionVersion`; `getUser` rejects any cookie with an older version, and the
  device that changed its own password gets a fresh cookie so it stays signed in.
- Passwords hashed with Node's built-in `scrypt`
  ([`password.server.ts`](../app/server/password.server.ts)) — no native
  bcrypt/argon2 dependency. Stored self-describing as `scrypt:<saltHex>:<hashHex>`.
- `SESSION_SECRET` (min 32 chars) signs the cookie. A dev default keeps local/test
  boots frictionless; **production refuses to boot** with the dev default.

## Account removal (P17)

Every user (teacher or admin) deletes their own account on `/account`: type the
confirmation word and `deleteUserCascade` removes the account and everything it owns,
immediately and permanently. There is no request/holding state. An admin can remove
other users from the user list in `/admin/users`. (Deactivating, below, is the reversible
alternative, owner only.)

## Data scoping

Repositories are the only DB access point, every signature is `async`, and every
query is scoped to its owning `userId` in the `WHERE` clause — deletes/reads never
trust a client-supplied id alone. See the header comment in
[`profiles.server.ts`](../app/server/repositories/profiles.server.ts) /
[`generations.server.ts`](../app/server/repositories/generations.server.ts).

Abuse budgets (rate + concurrency) are keyed by **user id**, so limits follow the
account rather than a spoofable IP.

## Passwords and accounts (P18.7)

There is **no e-mail sending**: a mail service is a new provider, which needs Bastiaan's
approval first. Every link below is shown on the page for the admin to copy and pass on.

- **Reset link** (since P4): an admin mints a single-use `/reset/:token` for a user
  (`createPasswordReset`, 48 h); the user chooses their own new password and is signed in.
  A role change, a new password (`updateUserPassword`: reset, `/account`, the owner's
  `setPassword`) and a deactivation void the user's open links.
- **Create an account** (owner only, `/admin/users`): name, e-mail (required, logging in
  uses it), role teacher or admin, and either a **link** (default: the account exists with
  `passwordHash = NO_PASSWORD`, which no typed password matches, plus a 7-day single-use
  reset link) or an **initial password** (at least 10 characters, hashed by
  `hashPassword`, never shown again).
- **Set a password** (owner only): `setPassword` writes a hash through
  `updateUserPassword`, so the user is signed out on every device. The password is never
  returned to the client.
- **Deactivate / reactivate** (owner only): `users.disabled_at` is set or cleared. A
  deactivated account cannot log in (a correct password gets the "deactivated" message,
  a wrong one the generic one), `getUser` returns `null`, the data stays. Deactivating
  bumps `sessionVersion` and voids the open reset links, so reactivating revives neither
  old cookies nor old links. A link minted while the account is deactivated is invalid and
  stays unspent (`reset.$token.tsx`) until the account is reactivated.
- Nobody uses these on their own account; they use `/account`.

## What SSO will (and won't) replace

Institutional SSO (SURFconext / SAML / OIDC) later replaces **only** the login /
invite front door and the role mapping. The permanent parts built here —
`createCookieSessionStorage` sessions, `requireUser`/`requireRole`, the two roles,
and per-user data scoping — stay. The `getDb()` seam
([`db.server.ts`](../app/server/db.server.ts)) also keeps the door open for a hosted
database-per-tenant model without a rewrite.
