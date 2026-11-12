import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterAll, describe, expect, it } from "vitest";
import { backupAllTenantsIfDue, backupDir, tenantBackupDir } from "~/server/backup.server";
import { migrateAllTenants } from "~/server/db.server";
import { adminHealth } from "~/server/health.server";
import { createUser } from "~/server/repositories/users.server";
import { runWithTenant, type Tenant } from "~/server/tenants.server";

// Real files: the online backup API needs a database on disk.
const dir = mkdtempSync(join(tmpdir(), "tenant-backup-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const hsl: Tenant = { id: "bk-hsl", hosts: ["hsl.test"], dbPath: join(dir, "hsl.db") };
const hhs: Tenant = { id: "bk-hhs", hosts: ["hhs.test"], dbPath: join(dir, "hhs.db") };
const both = [hsl, hhs];

const emails = (file: string) => {
  const db = new Database(file, { readonly: true });
  const rows = db.prepare("SELECT email FROM users").all() as { email: string }[];
  db.close();
  return rows.map((r) => r.email);
};

describe("tenantBackupDir", () => {
  const env = { BACKUP_DIR: "/srv/backups" };

  it("is the one backup folder when there is one institution", () => {
    const only: Tenant = { id: "default", hosts: [], dbPath: "/data/limeonit.db" };
    expect(tenantBackupDir(env, only, [only])).toBe(backupDir(env, only.dbPath));
  });

  it("gives every institution its own folder inside it", () => {
    expect(tenantBackupDir(env, hsl, both)).toBe("/srv/backups/bk-hsl");
    expect(tenantBackupDir(env, hhs, both)).toBe("/srv/backups/bk-hhs");
  });

  it("is off when backups are off", () => {
    expect(tenantBackupDir({ BACKUP_DIR: "off" }, hsl, both)).toBeNull();
  });
});

describe("backupAllTenantsIfDue (the app's daily backup)", () => {
  it("backs up each institution's own database into its own folder", async () => {
    for (const [tenant, email] of [
      [hsl, "docent@hsl.nl"],
      [hhs, "docent@hhs.nl"],
    ] as const) {
      await runWithTenant(tenant, () =>
        createUser({ id: `u-${tenant.id}`, name: "D", email, passwordHash: "x", role: "teacher" }),
      );
    }
    const env = { BACKUP_DIR: join(dir, "backups") };
    const done = await backupAllTenantsIfDue(env, both, new Date("2026-11-12T03:00:00Z"));
    expect(done).toHaveLength(2);

    const [hslFile] = readdirSync(join(dir, "backups", "bk-hsl"));
    const [hhsFile] = readdirSync(join(dir, "backups", "bk-hhs"));
    expect(emails(join(dir, "backups", "bk-hsl", hslFile ?? ""))).toEqual(["docent@hsl.nl"]);
    expect(emails(join(dir, "backups", "bk-hhs", hhsFile ?? ""))).toEqual(["docent@hhs.nl"]);

    // Within the day nothing is due.
    expect(await backupAllTenantsIfDue(env, both, new Date("2026-11-12T09:00:00Z"))).toEqual([]);
  });

  it("goes on with the next institution when one fails", async () => {
    const broken: Tenant = { id: "bk-broken", hosts: ["x.test"], dbPath: join(dir, "no", "x.db") };
    const env = { BACKUP_DIR: join(dir, "backups2") };
    const list = [broken, hsl];
    // The broken one has an unwritable backup folder: a file where its folder should be.
    const { writeFileSync, mkdirSync } = await import("node:fs");
    mkdirSync(join(dir, "backups2"), { recursive: true });
    writeFileSync(join(dir, "backups2", "bk-broken"), "not a folder");
    const done = await backupAllTenantsIfDue(env, list, new Date("2026-11-12T03:00:00Z"));
    expect(done.map((d) => d.tenant)).toEqual(["bk-hsl"]);
  });
});

describe("adminHealth", () => {
  it("looks at the database and backups of the institution it is asked on", () => {
    const env = { BACKUP_DIR: join(dir, "backups") };
    const h = runWithTenant(hhs, () =>
      adminHealth({ env, now: new Date("2026-11-12T10:00:00Z"), tenants: both }),
    );
    expect(h.backup.state).toBe("ok");
    expect(h.databaseBytes).toBeGreaterThan(0);
  });
});

describe("migrateAllTenants (at boot and from db:migrate)", () => {
  it("creates and migrates every institution's database", () => {
    const fresh: Tenant[] = [
      { id: "mig-a", hosts: ["a.test"], dbPath: join(dir, "new", "a.db") },
      { id: "mig-b", hosts: ["b.test"], dbPath: join(dir, "new", "b.db") },
    ];
    expect(migrateAllTenants(fresh)).toEqual(fresh.map((t) => t.dbPath));
    for (const t of fresh) expect(emails(t.dbPath)).toEqual([]);
  });
});
