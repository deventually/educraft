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

### What is (and isn't) prepared now

Prepared:

- `getDb()` indirection — the single point a per-tenant resolver will hook into.
- Admin creation is centralised behind `createUser` + `scripts/create-admin.ts`,
  so the control-plane seeder reuses one code path (no second "make an admin"
  implementation to keep in sync).
- P4 instance settings (`tool_settings`, `instance_settings`) live in the tenant
  DB, so per-tenant configuration comes for free with database-per-tenant — no
  settings-sync layer to build.

Deliberately **not** built yet (out of P4 scope, avoids speculative schema that
could conflict with database-per-tenant):

- Control-plane tables (`super_user`, `tenant`) and a `super_user` role token.
- A tenant-provisioning / DB-per-tenant resolver and its migrations runner.
- Cross-tenant super-user UI.

When the control plane is built, add it as a **separate** store/service; do not
add a `tenantId` to the tenant-local schema (it contradicts the isolation model).
