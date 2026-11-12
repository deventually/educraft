# Tenancy & Admin model

Status: **living design note.** Records how admin accounts are created today and
how that generalises to the planned multi-tenant SaaS, so the boundary is not
lost as features land. Cross-refs: `docs/implementation/P4-admin-console.md`
(admin console), `docs/Improvement-Plan.md` (database-per-tenant decision).

## Roles (today, single instance)

Two roles, stored on `users.role` and read fresh from the DB every request
(`app/server/auth.server.ts`):

| Role      | Created by                              | Scope                                              |
|-----------|-----------------------------------------|----------------------------------------------------|
| `teacher` | Admin-minted invite (`/admin/users`) | Uses every tool (instructor + student tutors) |
| `admin`   | **Ops script or promotion by the super admin, never an invite** | Configures the whole instance (tools, models, context, teachers) |
| super admin (**owner**, not a third role) | `npm run set-owner -- --email …` | An admin who is also the only one who creates, demotes and deletes admins |

The owner is one key in `instance_settings` (`ownerUserId`), not a role: `isOwner(user)`
(`auth.server.ts`) is `role === "admin"` and the stored id matches. A key that points at a
demoted or deleted account counts as "no owner". It is **not** the *super user* of the future
control plane below: the owner administers one instance (one tenant database); the super user
sits above all of them and lives in the control plane, outside every tenant DB.

(P17 removed the `student` role and cohorts; see BESLUIT-2026-11-03-3.)

**Admins are never minted by an invite link** (P18.6: `consumeInvite` and `/invite/:token`
accept teacher invites only; `scripts/invite.ts` has no `--role`). Two supported paths:

1. `npm run create-admin -- --name "…" --email …@… --password …` — direct seed
   (`scripts/create-admin.ts`). If `--password` is omitted a strong one is
   generated and printed once.
2. Promotion — **only the super admin** changes a teacher's role to `admin` in the
   admin console (`/admin/users` user list), and only he demotes or deletes an admin,
   or resets an admin's password or changes an admin's e-mail (a regular admin could
   otherwise take over any admin account, the owner's included). The server refuses
   with `ownerOnly`. Guard: nobody can demote or delete **themselves** there, so the
   last admin can't lock the instance out of admin; the owner also cannot delete their
   own account on `/account` (hand over with `set-owner` first).

## Future: multi-tenant SaaS (database-per-tenant)

The hosted product is **database-per-tenant**: each customer (school, faculty)
gets its own isolated database. The `getDb()` seam
(`app/server/db.server.ts`) already anticipates this — today it returns one
singleton; in production it resolves the tenant's handle per request. No
`tenantId` column is needed inside a tenant DB: **the database _is_ the tenant
boundary.** Everything in this repo's schema is already "tenant-local".

### Super user (control plane)

Above the tenant databases sits a small **control plane** with its own store:

- **`super_user`** — a platform operator. Creates tenants and seeds each
  tenant's first `admin`. Lives in the control plane, **not** in any tenant DB.
- **`tenant`** — a customer: name, status, and the connection info / path for
  that tenant's database.

Flow: super user provisions a tenant → the control plane creates the tenant DB
(runs the same drizzle migrations) → seeds the first admin by calling the exact
primitive `create-admin` uses today (`createUser({ role: "admin", … })`). A
tenant `admin` is therefore always "admin **of their own tenant**" — the DB
they connect to — and has no visibility into any other tenant. The super user
is the only cross-tenant identity.

### What is (and isn't) built now

Built (BESLUIT-2026-11-12-4, "pilot op twee databases"):

- **Database per address.** `TENANTS` (`app/server/tenants.server.ts`) lists the
  institutions: id, host names and SQLite file. The root middleware runs every request on the
  institution of its address (unknown address: 404); `getDb()` opens that institution's
  database, once per institution. Without `TENANTS`: one instance on `DATABASE_URL`, as before.
- **Everything per database:** migrations at boot (`migrateAllTenants`), the daily backup into
  `backups/<id>/`, the AI-usage roll-up, the admin's model registry and the recent-errors list.
  `/healthz` answers on any address and checks every database.
- **Ops scripts per institution:** `LIMEONIT_TENANT=<id>` names the institution; with several
  and no name, a script refuses rather than guess (`currentTenant()` throws).
- Admin creation is centralised behind `createUser` + `scripts/create-admin.ts`,
  so the control-plane seeder reuses one code path.
- Instance settings (`tool_settings`, `instance_settings`) live in the tenant DB, so
  per-tenant configuration comes for free.

Built (BESLUIT-2026-11-12-5, platform layer):

- **`PLATFORM_HOST`** gives the platform its own address and its own database (tenant
  `platform`, `platform.db`). The platform owner is an ordinary admin + owner *in that database*
  (`LIMEONIT_TENANT=platform npm run create-admin` / `set-owner`; lost 2FA:
  `LIMEONIT_TENANT=platform npm run reset-2fa`), so no institution's admin can reach it.
- **The list of institutions** (`app/server/institutions.server.ts`) lives in the data folder as
  `institutions.json`, outside every institution's database, and is taken over from `TENANTS`
  on the first start. `allTenants()` reads it; it changes without a restart.
- **Router:** the platform's address serves only `/platform`, signing in and two-step
  verification (anything else redirects to `/platform`); an institution's address has no
  `/platform`; a deactivated institution answers 503.
- **Server API for /platform** (`app/server/platformAdmin.server.ts`): list, add (database +
  first admin who is also owner + a 48-hour set-password link on the institution's address),
  activate/deactivate, remove (deactivated only, confirmed by typing the id), archive and put
  back. A removed institution's database and backups move to `archive/<id>-<time>/` and are
  wiped after 60 days by an hourly job.
- **Own container:** `LIMEONIT_SERVES=platform|institutions` (`servedTenants`) splits one image
  into a platform container and a schools container on one data folder; routing, migrations,
  backups and the jobs follow it. The schools' container re-reads `institutions.json` on change
  and closes a deactivated institution's database (`startDbSync`).

Not built yet:

- The `/platform` screen itself (its own PR, on the API above).
- A database other than SQLite for a large institution: see
  [`implementation/maatwerk-database.md`](implementation/maatwerk-database.md).
- One login across institutions (a teacher at two institutions has an account at each).

When the control plane is built, add it as a **separate** store/service; do not
add a `tenantId` to the tenant-local schema (it contradicts the isolation model).
