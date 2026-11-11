import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A real SQLite file, so the database has a size on disk.
const dir = mkdtempSync(join(tmpdir(), "health-"));
const dbFile = join(dir, "limeonit.db");
process.env.DATABASE_URL = `file:${dbFile}`;

type Health = typeof import("~/server/health.server");
type Backup = typeof import("~/server/backup.server");
type DbMod = typeof import("~/server/db.server");
let health: Health;
let backup: Backup;
let db: DbMod;

beforeAll(async () => {
  backup = await import("~/server/backup.server");
  health = await import("~/server/health.server");
  db = await import("~/server/db.server");
  db.getDb(); // creates and migrates the file
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const at = (iso: string) => new Date(iso);
const name = (iso: string) => backup.backupFileName(at(iso));

describe("latestBackupTime", () => {
  it("is the newest backup by its name, ignoring half copies and foreign files", () => {
    const names = [
      name("2026-11-07T02:00:00Z"),
      name("2026-11-08T02:00:00Z"),
      `${name("2026-11-09T02:00:00Z")}.partial`,
      "notes.txt",
    ];
    expect(backup.latestBackupTime(names)).toEqual(at("2026-11-08T02:00:00Z"));
  });

  it("is null without any backup", () => {
    expect(backup.latestBackupTime([])).toBeNull();
    expect(backup.latestBackupTime(["notes.txt"])).toBeNull();
  });
});

describe("databaseBytes", () => {
  it("counts the database file and its write-ahead log", () => {
    const bytes = db.databaseBytes(dbFile);
    expect(bytes).toBeGreaterThan(0);
  });

  it("is null for an in-memory or missing database", () => {
    expect(db.databaseBytes(":memory:")).toBeNull();
    expect(db.databaseBytes(join(dir, "nope.db"))).toBeNull();
  });
});

describe("adminHealth", () => {
  const now = at("2026-11-09T12:00:00Z");

  it("says the built-in backup is off when there is no backup folder", () => {
    const h = health.adminHealth({ env: { NODE_ENV: "development" }, dbPath: dbFile, now });
    expect(h.backup).toEqual({ state: "off" });
    expect(h.databaseBytes).toBeGreaterThan(0);
    expect(h.freeDiskBytes).toBeGreaterThan(0);
  });

  it("warns when the folder has no backup yet", () => {
    const empty = join(dir, "empty");
    const h = health.adminHealth({ env: { BACKUP_DIR: empty }, dbPath: dbFile, now });
    expect(h.backup).toEqual({ state: "none" });
  });

  it("is fine with a backup younger than 36 hours", () => {
    const fresh = join(dir, "fresh");
    mkdirSync(fresh);
    writeFileSync(join(fresh, name("2026-11-08T02:00:00Z")), "");
    const h = health.adminHealth({ env: { BACKUP_DIR: fresh }, dbPath: dbFile, now });
    expect(h.backup).toEqual({ state: "ok", at: "2026-11-08T02:00:00.000Z", ageHours: 34 });
  });

  it("warns when the newest backup is older than 36 hours", () => {
    const old = join(dir, "old");
    mkdirSync(old);
    writeFileSync(join(old, name("2026-11-07T23:00:00Z")), "");
    const h = health.adminHealth({ env: { BACKUP_DIR: old }, dbPath: dbFile, now });
    expect(h.backup).toEqual({ state: "stale", at: "2026-11-07T23:00:00.000Z", ageHours: 37 });
  });

  it("knows no size or free space for an in-memory database", () => {
    const h = health.adminHealth({ env: {}, dbPath: ":memory:", now });
    expect(h).toMatchObject({ backup: { state: "off" }, databaseBytes: null, freeDiskBytes: null });
  });

  it("names the running version, from package.json", () => {
    const h = health.adminHealth({ env: {}, dbPath: ":memory:", now });
    expect(h.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
