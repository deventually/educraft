import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

// A real SQLite file: the online backup API needs one (an in-memory database has no file to copy).
const dir = mkdtempSync(join(tmpdir(), "backup-"));
const dbFile = join(dir, "limeonit.db");
process.env.DATABASE_URL = `file:${dbFile}`;

type Backup = typeof import("~/server/backup.server");
type Users = typeof import("~/server/repositories/users.server");
let backup: Backup;
let users: Users;

beforeAll(async () => {
  backup = await import("~/server/backup.server");
  users = await import("~/server/repositories/users.server");
  await users.createUser({
    id: "bk-1",
    name: "Eerste Docent",
    email: "eerste@school.nl",
    passwordHash: "scrypt:x:y",
    role: "teacher",
  });
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const emails = (file: string) => {
  const db = new Database(file, { readonly: true });
  const rows = db.prepare("SELECT email FROM users ORDER BY email").all() as { email: string }[];
  db.close();
  return rows.map((r) => r.email);
};

const at = (iso: string) => new Date(iso);
const name = (iso: string) => backupFileNameFor(iso);
let backupFileNameFor: (iso: string) => string;
beforeAll(() => {
  backupFileNameFor = (iso) => backup.backupFileName(at(iso));
});

describe("backupFileName", () => {
  it("is a sortable, filesystem-safe UTC timestamp", () => {
    expect(backup.backupFileName(at("2026-11-09T03:04:05.678Z"))).toBe(
      "limeonit-2026-11-09T03-04-05Z.db",
    );
  });
});

describe("backupsToKeep (rotation: 7 days, 4 weeks)", () => {
  const now = at("2026-11-09T12:00:00Z"); // a Monday

  it("keeps the newest backup of each of the last 7 days", () => {
    const names = [
      name("2026-11-09T02:00:00Z"),
      name("2026-11-08T02:00:00Z"),
      name("2026-11-08T14:00:00Z"),
      name("2026-11-03T02:00:00Z"),
    ];
    const keep = backup.backupsToKeep(names, now);
    expect(keep).toContain(name("2026-11-09T02:00:00Z"));
    expect(keep).toContain(name("2026-11-08T14:00:00Z"));
    expect(keep).not.toContain(name("2026-11-08T02:00:00Z"));
    expect(keep).toContain(name("2026-11-03T02:00:00Z"));
  });

  it("keeps one backup per week for 4 weeks, and drops what is older", () => {
    const names = [
      name("2026-11-09T02:00:00Z"),
      name("2026-10-29T02:00:00Z"), // week of 26 Oct
      name("2026-10-30T02:00:00Z"), // same week, newer
      name("2026-10-20T02:00:00Z"), // week of 19 Oct
      name("2026-09-01T02:00:00Z"), // too old
    ];
    const keep = backup.backupsToKeep(names, now);
    expect(keep).toContain(name("2026-10-30T02:00:00Z"));
    expect(keep).not.toContain(name("2026-10-29T02:00:00Z"));
    expect(keep).toContain(name("2026-10-20T02:00:00Z"));
    expect(keep).not.toContain(name("2026-09-01T02:00:00Z"));
  });

  it("always keeps the newest backup, however old", () => {
    const old = name("2025-01-01T02:00:00Z");
    expect(backup.backupsToKeep([old], now)).toEqual([old]);
  });

  it("never touches files it did not make", () => {
    const keep = backup.backupsToKeep(["notes.txt", "limeonit.db"], now);
    expect(keep).toEqual(["notes.txt", "limeonit.db"]);
  });
});

describe("isBackupDue", () => {
  const now = at("2026-11-09T12:00:00Z");
  it("is due without any backup, or when the newest is a day old", () => {
    expect(backup.isBackupDue([], now)).toBe(true);
    expect(backup.isBackupDue([name("2026-11-08T11:00:00Z")], now)).toBe(true);
  });
  it("is not due within a day of the last backup", () => {
    expect(backup.isBackupDue([name("2026-11-09T02:00:00Z")], now)).toBe(false);
  });
});

describe("backupDir", () => {
  it("is off by default outside production", () => {
    expect(backup.backupDir({ NODE_ENV: "development" }, "/data/limeonit.db")).toBeNull();
  });
  it("defaults to a backups folder next to the database in production", () => {
    expect(backup.backupDir({ NODE_ENV: "production" }, "/data/limeonit.db")).toBe("/data/backups");
  });
  it("follows BACKUP_DIR, and BACKUP_DIR=off turns it off", () => {
    expect(backup.backupDir({ BACKUP_DIR: "/srv/b" }, "/data/limeonit.db")).toBe("/srv/b");
    expect(
      backup.backupDir({ NODE_ENV: "production", BACKUP_DIR: "off" }, "/data/limeonit.db"),
    ).toBeNull();
  });
  it("is off for an in-memory database", () => {
    expect(backup.backupDir({ NODE_ENV: "production" }, ":memory:")).toBeNull();
  });
});

describe("runBackup and restoreBackup (against a live database)", () => {
  const backups = join(dir, "backups");

  it("copies the live database while the app keeps writing", async () => {
    const result = await backup.runBackup({ dir: backups, now: at("2026-11-09T02:00:00Z") });
    expect(result.file).toBe(join(backups, "limeonit-2026-11-09T02-00-00Z.db"));
    expect(emails(result.file)).toEqual(["eerste@school.nl"]);
    // No downtime: the app still writes after (and during) a backup.
    await users.createUser({
      id: "bk-2",
      name: "Tweede Docent",
      email: "tweede@school.nl",
      passwordHash: "scrypt:x:y",
      role: "teacher",
    });
    expect(emails(result.file)).toEqual(["eerste@school.nl"]);
    expect(readdirSync(backups).filter((f) => f.endsWith(".partial"))).toEqual([]);
  });

  it("rotates old backups away after a new one", async () => {
    writeFileSync(join(backups, backup.backupFileName(at("2026-08-01T02:00:00Z"))), "old");
    const result = await backup.runBackup({ dir: backups, now: at("2026-11-10T02:00:00Z") });
    expect(result.removed).toEqual(["limeonit-2026-08-01T02-00-00Z.db"]);
    expect(readdirSync(backups).sort()).toEqual([
      "limeonit-2026-11-09T02-00-00Z.db",
      "limeonit-2026-11-10T02-00-00Z.db",
    ]);
  });

  it("restores a backup over a database, keeping the old one aside", () => {
    const target = join(dir, "restored.db");
    writeFileSync(target, "the current database");
    writeFileSync(`${target}-wal`, "stale wal");
    const from = join(backups, "limeonit-2026-11-09T02-00-00Z.db");
    const result = backup.restoreBackup({ from, dbPath: target });
    expect(emails(target)).toEqual(["eerste@school.nl"]);
    expect(existsSync(`${target}-wal`)).toBe(false);
    expect(result.previous && existsSync(result.previous)).toBe(true);
  });

  it("refuses a file that is not a sound database and leaves the target alone", () => {
    const target = join(dir, "untouched.db");
    writeFileSync(target, "keep me");
    const bad = join(dir, "broken.db");
    writeFileSync(bad, "this is not sqlite");
    expect(() => backup.restoreBackup({ from: bad, dbPath: target })).toThrow();
    expect(existsSync(target)).toBe(true);
    expect(readdirSync(dir).filter((f) => f.startsWith("untouched.db."))).toEqual([]);
  });
});

describe("backupIfDue (the daily backup the app runs itself)", () => {
  const own = join(dir, "own-backups");

  it("makes a backup when none is recent, and skips within a day", async () => {
    const first = await backup.backupIfDue(own, at("2026-11-09T02:00:00Z"));
    expect(first?.file).toBe(join(own, "limeonit-2026-11-09T02-00-00Z.db"));
    expect(await backup.backupIfDue(own, at("2026-11-09T20:00:00Z"))).toBeNull();
    expect(await backup.backupIfDue(own, at("2026-11-10T02:30:00Z"))).not.toBeNull();
  });
});

describe("startBackupSchedule", () => {
  it("does not start when backups are off", () => {
    expect(backup.startBackupSchedule({ NODE_ENV: "development" }, dbFile)).toBe(false);
  });
});
