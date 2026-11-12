import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import Database from "better-sqlite3";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// The script runs in its own process against a throwaway SQLite file; this test
// process reads that file through the same repositories.
const dir = mkdtempSync(join(tmpdir(), "invite-"));
const dbFile = join(dir, "test.db");
const root = resolve(__dirname, "../..");
process.env.DATABASE_URL = `file:${dbFile}`;

type Users = typeof import("~/server/repositories/users.server");
let users: Users;

beforeAll(async () => {
  users = await import("~/server/repositories/users.server");
  await users.listInvitesWithContext(); // creates and migrates the throwaway database
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", "scripts/invite.ts", ...args], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: `file:${dbFile}` },
    encoding: "utf8",
  });
}

describe("npm run invite — never an admin (P18.6)", () => {
  it("refuses --role admin and mints nothing", async () => {
    const res = run(["--role", "admin", "--note", "Probeer"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/create-admin/);
    expect(res.stdout).not.toMatch(/\/invite\//);
    expect(await users.listInvitesWithContext()).toEqual([]);
  });

  it("mints a teacher invite", async () => {
    const res = run(["--note", "Jan"]);
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/role: teacher/);
    const invites = await users.listInvitesWithContext();
    expect(invites.map((i) => i.role)).toEqual(["teacher"]);
  });
});

describe("npm run invite — with several institutions", () => {
  const tenants = JSON.stringify([
    { id: "hsl", hosts: ["hsl.limeonit.test"], database: `file:${join(dir, "hsl.db")}` },
    { id: "hhs", hosts: ["hhs.limeonit.test"], database: `file:${join(dir, "hhs.db")}` },
  ]);
  const runAt = (tenant: string | undefined) =>
    spawnSync(process.execPath, ["--import", "tsx", "scripts/invite.ts", "--note", "Ans"], {
      cwd: root,
      env: {
        ...process.env,
        TENANTS: tenants,
        APP_ORIGIN: "https://limeonit.test",
        ...(tenant ? { LIMEONIT_TENANT: tenant } : {}),
      },
      encoding: "utf8",
    });

  it("refuses to guess the institution", () => {
    const res = runAt(undefined);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/LIMEONIT_TENANT/);
  });

  it("mints the invite in the named institution, on its own address", () => {
    const res = runAt("hhs");
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/^https:\/\/hhs\.limeonit\.test\/invite\//m);
    const count = (file: string) => {
      const db = new Database(file, { readonly: true });
      const { n } = db.prepare("SELECT count(*) AS n FROM invites").get() as { n: number };
      db.close();
      return n;
    };
    expect(count(join(dir, "hhs.db"))).toBe(1);
    expect(existsSync(join(dir, "hsl.db"))).toBe(false);
  });
});
