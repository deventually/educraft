import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// The script runs in its own process against a throwaway SQLite file; this test
// process only seeds and reads that file through the same repositories.
const dir = mkdtempSync(join(tmpdir(), "set-owner-"));
const dbFile = join(dir, "test.db");
const root = resolve(__dirname, "../..");
process.env.DATABASE_URL = `file:${dbFile}`;

type Users = typeof import("~/server/repositories/users.server");
type Settings = typeof import("~/server/repositories/settings.server");
let users: Users;
let settings: Settings;

beforeAll(async () => {
  users = await import("~/server/repositories/users.server");
  settings = await import("~/server/repositories/settings.server");
  await users.createUser({
    id: "so-admin",
    name: "Admin Person",
    email: "admin@example.com",
    passwordHash: "scrypt:x:y",
    role: "admin",
  });
  await users.createUser({
    id: "so-admin-2",
    name: "Second Admin",
    email: "second@example.com",
    passwordHash: "scrypt:x:y",
    role: "admin",
  });
  await users.createUser({
    id: "so-teacher",
    name: "Teacher Person",
    email: "teacher@example.com",
    passwordHash: "scrypt:x:y",
    role: "teacher",
  });
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(args: string[]) {
  return spawnSync("npx", ["tsx", "scripts/set-owner.ts", ...args], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: `file:${dbFile}` },
    encoding: "utf8",
  });
}

describe("npm run set-owner (P18.6)", () => {
  it("requires --email", () => {
    const res = run([]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/--email/);
    expect(res.stderr).not.toMatch(/at .*\.ts:\d+/); // a message, not a stack trace
  });

  it("refuses an unknown e-mail address and changes nothing", async () => {
    const res = run(["--email", "nobody@example.com"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/nobody@example\.com/);
    expect(await settings.getOwnerUserId()).toBeNull();
  });

  it("refuses a teacher account", async () => {
    const res = run(["--email", "teacher@example.com"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/admin/i);
    expect(await settings.getOwnerUserId()).toBeNull();
  });

  it("sets the owner to an admin (case-insensitive e-mail) and prints one line", async () => {
    const res = run(["--email", "Admin@Example.com"]);
    expect(res.status).toBe(0);
    expect(res.stdout.trim().split("\n")).toHaveLength(1);
    expect(res.stdout).toMatch(/Admin Person/);
    expect(await settings.getOwnerUserId()).toBe("so-admin");
  });

  it("hands ownership to another admin when run again", async () => {
    const res = run(["--email", "second@example.com"]);
    expect(res.status).toBe(0);
    expect(await settings.getOwnerUserId()).toBe("so-admin-2");
  });
});
