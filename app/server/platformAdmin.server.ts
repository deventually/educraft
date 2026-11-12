/**
 * The platform owner's actions on institutions (platform layer, BESLUIT-2026-11-12-5): the server
 * side of /platform. Each works on the platform's list (`institutions.server`) and, where it
 * must, inside the institution's own database (`runWithTenant`). The route checks that the
 * caller is the platform's owner; these functions trust that check.
 *
 * Contract with the screen: docs/Tenancy-and-Admin.md ("Platform layer").
 */
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { z } from "zod";
import { tenantBackupDir } from "./backup.server";
import { closeTenantDb, getDb } from "./db.server";
import { DB_PATH } from "./env.server";
import type { InstitutionRegistry } from "./institutions.server";
import { log } from "./log.server";
import { hashPassword } from "./password.server";
import { createPasswordReset } from "./repositories/passwordResets.server";
import { setOwnerUserId } from "./repositories/settings.server";
import { createUser, getUserByEmail } from "./repositories/users.server";
import { allTenants, platformRegistry, runWithTenant, type Tenant } from "./tenants.server";

function platform(): InstitutionRegistry {
  const registry = platformRegistry();
  if (!registry) throw new Error("No platform: set PLATFORM_HOST.");
  return registry;
}

const tenantOf = (id: string): Tenant | undefined => allTenants().find((t) => t.id === id);

/** Every institution on the platform, in the order they were added. */
export async function listInstitutions() {
  return platform()
    .list()
    .map(({ id, name, hosts, active, createdAt }) => ({ id, name, hosts, active, createdAt }));
}

const Email = z.string().trim().toLowerCase().email().max(200);

/**
 * A new institution: its database, its first admin (also its owner, so it can make more admins)
 * and a 48-hour link on the institution's own address where that admin chooses a password.
 */
export async function addInstitution(
  input: { id: string; name: string; host: string; adminName: string; adminEmail: string },
  protocol: string,
): Promise<
  | { ok: true; setPasswordLink: string }
  | { ok: false; error: "id" | "name" | "host" | "taken" | "exists" | "email" }
> {
  const adminName = input.adminName.trim();
  const email = Email.safeParse(input.adminEmail);
  if (!adminName || adminName.length > 100) return { ok: false, error: "name" };
  if (!email.success) return { ok: false, error: "email" };
  const added = platform().add(input);
  if (!added.ok) return added;
  const tenant = tenantOf(added.institution.id);
  if (!tenant) throw new Error(`Institution ${added.institution.id} was not served after adding.`);
  const token = await runWithTenant(tenant, async () => {
    getDb(); // creates and migrates the database
    const existing = await getUserByEmail(email.data);
    const admin =
      existing ??
      (await createUser({
        name: adminName,
        email: email.data,
        // Nobody knows this password: the admin sets their own with the link.
        passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
        role: "admin",
      }));
    await setOwnerUserId(admin.id);
    return (await createPasswordReset(admin.id)).token;
  });
  log("platform.institutionAdded", { institution: tenant.id });
  const scheme = protocol.replace(/:?$/, ":");
  return { ok: true, setPasswordLink: `${scheme}//${tenant.hosts[0]}/reset/${token}` };
}

/** Activate or deactivate an institution; `false` for an unknown id. */
export async function setInstitutionActive(id: string, active: boolean): Promise<boolean> {
  const done = platform().setActive(id, active);
  if (done)
    log(active ? "platform.institutionActivated" : "platform.institutionDeactivated", {
      institution: id,
    });
  return done;
}

/** Remove a deactivated institution, confirmed by its id: 60 days in the archive, then gone. */
export async function removeInstitution(
  id: string,
  confirm: string,
): Promise<{ ok: true } | { ok: false; error: "unknown" | "active" | "confirm" }> {
  const tenant = tenantOf(id);
  if (tenant && !tenant.inactive) return { ok: false, error: "active" };
  if (tenant && confirm.trim() === id) closeTenantDb(tenant);
  const backups = tenant ? tenantBackupDir(process.env, tenant) : null;
  const result = platform().remove(id, confirm, new Date(), backups);
  if (!result.ok) return result;
  log("platform.institutionRemoved", { institution: id, archivedTo: result.archivedTo });
  return { ok: true };
}

/** The removed institutions still in the archive, with the day each is wiped. */
export async function listArchived() {
  return platform().archived();
}

/** Put an archived institution back, deactivated, with its data and backups. */
export async function restoreInstitution(
  key: string,
): Promise<{ ok: true } | { ok: false; error: "unknown" | "taken" }> {
  const entry = platform()
    .archived()
    .find((a) => a.key === key);
  const backups = entry
    ? tenantBackupDir(process.env, {
        id: entry.id,
        hosts: entry.hosts,
        dbPath: join(dirname(DB_PATH), `${entry.id}.db`),
      })
    : null;
  const result = platform().restore(key, backups);
  if (result.ok) log("platform.institutionRestored", { institution: entry?.id });
  return result;
}

/** Wipe what has been in the archive for 60 days (the daily job); the keys that went. */
function purgeArchive(now = new Date()): string[] {
  const registry = platformRegistry();
  if (!registry) return [];
  const gone = registry.purgeArchive(now);
  if (gone.length > 0) log("platform.archivePurged", { removed: gone });
  return gone;
}

const DAY_TIMER = globalThis as unknown as { __limeonitArchiveTimer?: NodeJS.Timeout };

/** Starts the hourly clean-up of the archive, once per process (only with a platform). */
export function startArchivePurge(): void {
  if (!platformRegistry() || DAY_TIMER.__limeonitArchiveTimer) return;
  DAY_TIMER.__limeonitArchiveTimer = setInterval(() => purgeArchive(), 60 * 60 * 1000);
  DAY_TIMER.__limeonitArchiveTimer.unref();
  purgeArchive();
}
