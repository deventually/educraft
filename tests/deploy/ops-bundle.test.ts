import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "vite";
import Database from "better-sqlite3";

/**
 * The production image has no tsx and no source: the ops scripts ship as plain JS bundles
 * (`build/ops/*.js`, built by `scripts/ops.config.ts`). Build them into a throwaway folder and
 * run them with bare `node`, the way an installer runs them inside the container. The folder sits
 * under the (git-ignored) `build/`, so the bundles resolve the project's node_modules like the image.
 */
const root = resolve(__dirname, "../..");
mkdirSync(join(root, "build"), { recursive: true });
const dir = mkdtempSync(join(root, "build", "ops-test-"));
const outDir = join(dir, "ops");
const dbFile = join(dir, "limeonit.db");

const run = (script: string, args: string[]) =>
  spawnSync(process.execPath, [join(outDir, `${script}.js`), ...args], {
    cwd: dir,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "production",
      SESSION_SECRET: "x".repeat(40),
      DATABASE_URL: `file:${dbFile}`,
      MIGRATIONS_DIR: resolve(root, "drizzle"),
    },
  });

beforeAll(async () => {
  await build({
    configFile: resolve(root, "scripts/ops.config.ts"),
    logLevel: "silent",
    build: { outDir },
  });
}, 120_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("ops bundle", () => {
  it("migrate creates the database with plain node", () => {
    const r = run("migrate", []);
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(existsSync(dbFile)).toBe(true);
  });

  it("create-admin refuses a commonly used password", () => {
    const r = run("create-admin", [
      "--name",
      "Zwak Wachtwoord",
      "--email",
      "zwak@school.nl",
      "--password",
      "Welkom2026!",
    ]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("commonly used");
  });

  it("create-admin and set-owner make the first owner", () => {
    const admin = run("create-admin", [
      "--name",
      "Eerste Beheerder",
      "--email",
      "beheer@school.nl",
    ]);
    expect(admin.status).toBe(0);
    expect(admin.stdout).toContain("beheer@school.nl");

    const owner = run("set-owner", ["--email", "beheer@school.nl"]);
    expect(owner.status).toBe(0);

    const db = new Database(dbFile, { readonly: true });
    const row = db.prepare("SELECT role FROM users WHERE email = ?").get("beheer@school.nl") as {
      role: string;
    };
    db.close();
    expect(row.role).toBe("admin");
  });

  it("reset-2fa runs with plain node (P2-12)", () => {
    const r = run("reset-2fa", ["--email", "beheer@school.nl"]);
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("beheer@school.nl");
  });

  it("backup copies the database into backups/ and restore puts it back", () => {
    const b = run("backup", []);
    expect(b.stderr).toBe("");
    expect(b.status).toBe(0);
    const backups = readdirSync(join(dir, "backups"));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^limeonit-.*Z\.db$/);

    const restored = join(dir, "restored.db");
    const r = run("restore", ["--from", join(dir, "backups", backups[0]!), "--to", restored]);
    expect(r.status).toBe(0);
    const db = new Database(restored, { readonly: true });
    const row = db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE email = ?")
      .get("beheer@school.nl") as {
      n: number;
    };
    db.close();
    expect(row.n).toBe(1);
  });

  it("restore refuses without --from", () => {
    const r = run("restore", []);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--from");
  });

  it("invite prints a link", () => {
    const r = run("invite", ["--note", "Jan"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/\/invite\//);
  });
});
