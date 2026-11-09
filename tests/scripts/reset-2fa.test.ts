import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// The script runs in its own process against a throwaway SQLite file; this test process
// only seeds and reads that file through the same repositories.
const dir = mkdtempSync(join(tmpdir(), "reset-2fa-"));
const dbFile = join(dir, "test.db");
const root = resolve(__dirname, "../..");
process.env.DATABASE_URL = `file:${dbFile}`;

let repo: typeof import("~/server/repositories/twoFactor.server");
let audit: typeof import("~/server/repositories/auditLog.server");

beforeAll(async () => {
  const users = await import("~/server/repositories/users.server");
  const totp = await import("~/server/totp.server");
  repo = await import("~/server/repositories/twoFactor.server");
  audit = await import("~/server/repositories/auditLog.server");
  await users.createUser({
    id: "r2-owner",
    name: "Owner",
    email: "owner@example.com",
    passwordHash: "scrypt:x:y",
    role: "admin",
  });
  const secret = (await repo.startTwoFactorSetup("r2-owner"))!;
  await repo.confirmTwoFactorSetup(
    "r2-owner",
    totp.totpCode(secret, Math.floor(Date.now() / 30_000)),
  );
}, 30_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(args: string[]) {
  return spawnSync("npx", ["tsx", "scripts/reset-2fa.ts", ...args], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: `file:${dbFile}` },
    encoding: "utf8",
  });
}

describe("reset-2fa (P2-12): the owner lost phone and recovery codes", () => {
  it("refuses without --email or for an unknown address", () => {
    expect(run([]).status).toBe(1);
    const r = run(["--email", "nobody@example.com"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("nobody@example.com");
  });

  it("turns it off and writes 'via the server' in the audit log", async () => {
    const r = run(["--email", "owner@example.com"]);
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("owner@example.com");
    expect(await repo.isTwoFactorEnabled("r2-owner")).toBe(false);
    const [entry] = await audit.listAdminActions();
    expect(entry).toMatchObject({
      action: "twoFactorReset",
      actorUserId: "r2-owner",
      targetUserId: "r2-owner",
      detail: { via: "server" },
    });
  }, 30_000);

  it("says so when it was already off", () => {
    const r = run(["--email", "owner@example.com"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/already off|was not on/i);
  }, 30_000);
});
