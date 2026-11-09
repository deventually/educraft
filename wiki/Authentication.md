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
| `teacher` | what the three layers give them (see below) |
| `admin`   | every tool and part the instance has not Off, plus the admin console |

The roles live in **one place** — `ROLES`/`isRole` in
[`app/lib/registry/access.ts`](../app/lib/registry/access.ts). Which tools a user
may use is decided by `isToolAvailable` in `availability.server.ts` (the three layers,
P28.3) and enforced server-side in three spots:
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

Since P28.1 the list (`/admin/users`) searches and filters people and holds the one **Add**
button (invite link, or for the owner a direct account); everything about one account lives on
its person page (`/admin/users/:id`), whose action takes the user from the URL, never from the
form. **With selected** on the list (intent `bulk`) puts ticked accounts in a team or takes them
out, and for the owner deactivates or reactivates them. Per person it applies the same rules as
the person page (`mayManage`, owner only, never yourself); whoever is out of reach is skipped and
counted (`{ bulk: { done, skipped } }`).

**Paste a list** (P28.5, intent `mintList`, every admin) is the third way to add: one person per
line, a name and an e-mail address. `parsePastedPeople` (`app/lib/people/pasteList.ts`, pure, Zod)
judges each line; the action then refuses an address that already has an account or an open
invite (`findClaimedEmails`) and mints one teacher invite per accepted line, with the note
`Name <email>` and the chosen team. It returns `{ pasted }`: per line the link, or the reason. No
mail is sent; the admin copies the links from the result table.

| On `/admin/users` and `/admin/users/:id` | Admin | Super admin |
|---|---|---|
| Invite a teacher, revoke an invite, models and BDB/BKE per teacher | yes | yes |
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

## Teams and team leads (P28.2)

A **team** (`teams`, `team_members`) is a group of colleagues; joining shares nothing. **Team
lead** is a stand per team (`team_members.is_lead`), not a role: `users.role` stays
`teacher | admin`. All access goes through `app/server/repositories/teams.server.ts`:

- Admins work on every team: `/admin/teams` is the list (search on team or person, one
  "New team" button) and `/admin/teams/:id` the team page (rename, delete, add several accounts
  at once by ticking them, remove, lead on/off, the team's choices); and per person on the
  person page (section Teams).
- A lead works on `/teams/:id` (teacher side). Every lead function goes through
  `getTeamForLead(callerId, teamId)`, which is `null` unless the caller leads that team, so the
  route answers a 404 to everyone else, admins included. A lead adds a colleague by **exact**
  e-mail, removes a plain member, makes a member lead, steps down, and mints a team invite.
  A lead never removes another lead or takes the stand away; an admin does.
- An invite with a `team_id` makes the new teacher a member on redeem (`joinTeamFromInvite`).
  Invites stay `teacher` (BESLUIT-2026-07-03-2). Deleting a team keeps the accounts and turns
  its open invites into plain ones; deleting an account removes its memberships.

## Parts, tools and models per team (P28.3)

One rule, three layers (`app/lib/features/rule.ts`, BESLUIT-2026-11-05-5):

```
effective = instance is Off              → off
          | the teacher has an exception → that exception
          | one of their teams says on   → on
          | one of their teams says off  → off
          | otherwise                    → the instance default (On = on, On request = off)
```

- **Register as data:** `app/lib/features/` lists the four parts (`portfolio` On request,
  `courses`, `roleAgents`, `utilities` On), validated at boot. No `if (feature === …)`.
  `roleAgents` is `instanceOnly`: a team has no say and does not see it; a stored team choice
  never counts (BESLUIT-2026-11-05-11). An admin's exception per teacher still applies.
- **Storage:** the instance stand of a tool in `tool_settings.stand`, of a part in
  `instance_settings` (`featureStand:<id>`); a team's choices as JSON on `teams.settings_json`
  (`features`, `tools`, `models`); a teacher's exceptions in `feature_exceptions`
  (`feature:<id>` / `tool:<slug>`). Migrations 0016/0017 carried every `enabled` flag and every
  P27.2 `portfolioEnabled:<id>` switch over.
- **One deep module:** `availability.server.ts` (`effectiveFeatures`, `effectiveTools`,
  `getAvailableTools`, `isToolAvailable`, `requireFeature`, the model gates). Routes use
  `requireFeatureUser` / `requireCourseUser`, so a part that is off is a 404; the menu and the
  tools page only hide. Switching off deletes nothing.
- **Models:** the teacher's own set (P18) → the union of their teams' sets, kept within the
  instance (nothing left = the instance) → the instance.
- **Admins** have everything the instance has not Off, and always BDB/BKE (P27.2).
  `portfolioAccess` keeps the transition: no choice and a dossier → on.
- **Who sets what:** the admin sets instance stands on `/admin/tools` (one at a time, or every
  tool shown after a search or stand filter at once: intent `toolsBulk`) and any team's choices on
  `/admin/teams/:id`; a lead sets their own team's choices on `/teams/:id`; only an admin sets an
  exception, on the person page (section *Parts and tools*, which shows the source). A team only
  sees what the instance has not Off; a stored choice for an Off item stays but never counts.

## Sharing with your team (P28.4)

Everything stays private until its owner shares it (BESLUIT-2026-11-05-5). One table, `shares`
(`ownerUserId`, `kind`, `itemId`, `teamId`; unique on kind + item + team, migration 0019), and one
repository, `app/server/repositories/shares.server.ts`.

- **Shareable kinds** are data: `SHARE_KINDS` in `app/lib/sharing.ts` is `course`, `rubric`,
  `contextProfile`. A dossier, rubric fill-ins (`rubric_scores`) and chats are never among them.
- **Read rule:** a team-mate reads an item when its owner shares it with a team that **both** are
  in, as one condition in the WHERE clause (`sharedWith`). Writing, linking and deleting stay in
  the owner-scoped repositories, so `updateCourse`, `deleteRubric` and `linkGeneration` find
  nothing for a team-mate.
- **Student work never travels:** `Tool.handlesStudentWork` (Studentwerk beoordelen, Wiskunde
  nakijken, Toetsanalyse, Forum nakijken; validated at boot) and `isShareableWork` (no student
  work, no chat, no dossier work) give `SHAREABLE_WORK_SLUGS`, which `listSharedCourseWork` puts
  in its WHERE. A shared course shows only that linked work.
- **Pages:** "Delen met je team" (`ShareWithTeam`, intents `share` / `unshare`, parsed with Zod in
  `app/server/sharing.server.ts`) on the course page, the rubric page and per context profile.
  "Van mijn team" (`SharedWithMe`) on `/courses`, `/utilities/rubric` and `/context-profiles`,
  with "Maak een kopie" (`copySharedItem`: own copy, no links, no shares, no context profile).
  A colleague's course or rubric opens read only on `/courses/shared/:id` and
  `/utilities/rubric/shared/:id`; not shared (any more) is a 404.
- **When a share lapses:** stopping, leaving the team (`removeMember`, `setUserTeams`: the
  leaver's shares for that team go), removing the team, deleting the item or the account. A copy
  stays with whoever made it.

## Sessions & passwords

- Cookie sessions via React Router's `createCookieSessionStorage`
  ([`session.server.ts`](../app/server/session.server.ts)). The cookie stores
  `{ userId, sessionVersion }`; the **role is read fresh from the DB on every
  request**; a real role change additionally logs that user out everywhere (P18.9).
- **Several devices at once, one switch to sign them all out.** Logging in never
  invalidates other sessions (laptop and phone can both be signed in). Only a new
  password (`updateUserPassword`), a deactivation (`setUserDisabled`) or a real role change
  (`setUserRole`) bumps
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
other users from their person page (`/admin/users/:id`). (Deactivating, below, is the reversible
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
- **Create an account** (owner only, **Add** on `/admin/users`): name, e-mail (required, logging in
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

## Audit log of admin actions (P1)

Every admin action that changes someone's access writes one row to `admin_audit`
(`recordAdminAction`, `app/server/repositories/auditLog.server.ts`), **after** the change
succeeded; a refusal writes nothing. The actions (`AUDIT_ACTIONS`, `app/lib/auditLog.ts`): a role
change (from → to), a password set by the owner, a reset link minted, (de)activation (per person or
via the selection), an account created or deleted, invites created (with a count) or revoked, and
the model choice of the instance or of one teacher.

- **Facts, not secrets:** a row holds ids, the action and a small `detail` (`from`/`to`, `count`,
  `role`, `models`, `bulk`). Never a password, a link, a token or an invite's note.
- **No names stored:** the page joins the current names. A deleted account stays in the log as
  "Deleted account"; the fact remains, the person does not.
- **Append-only:** nothing edits or deletes a row. `/admin/audit` (admins) shows the newest 200.
  There is no retention period yet.

## What SSO will (and won't) replace

Institutional SSO (SURFconext / SAML / OIDC) later replaces **only** the login /
invite front door and the role mapping. The permanent parts built here —
`createCookieSessionStorage` sessions, `requireUser`/`requireRole`, the two roles,
and per-user data scoping — stay. The `getDb()` seam
([`db.server.ts`](../app/server/db.server.ts)) also keeps the door open for a hosted
database-per-tenant model without a rewrite.
