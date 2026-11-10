import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "../vitest.config";
import { needsIsolation } from "./helpers/isolation";

/**
 * The suite runs in four projects: node and happy-dom, each split in a shared part (`isolate:
 * false`: the app's modules load once per worker) and an isolated part (a fresh module graph per
 * file). Loading the app again for every file cost over half the run.
 */
type Project = {
  test?: {
    name?: string;
    environment?: string;
    isolate?: boolean;
    include?: string[];
    setupFiles?: string | string[];
    env?: Record<string, string>;
  };
};
const projects = ((config.test?.projects ?? []) as Project[]).map((p) => p.test ?? {});
const byEnvironment = (env: string) => projects.filter((p) => p.environment === env);
const setupFiles = (p: Project["test"]) => [p?.setupFiles ?? []].flat();
const shared = projects.filter((p) => p.isolate === false);
const isolated = projects.filter((p) => p.isolate !== false);
const filesIn = (ps: typeof projects) => ps.flatMap((p) => p.include ?? []);

describe("vitest config", () => {
  it("has a shared and an isolated project for node and for happy-dom", () => {
    for (const env of ["node", "happy-dom"]) {
      const ps = byEnvironment(env);
      expect(ps.filter((p) => p.isolate === false)).toHaveLength(1);
      expect(ps.filter((p) => p.isolate !== false)).toHaveLength(1);
    }
  });

  it("runs every test file exactly once, so the split loses no test", () => {
    const all = globSync("tests/**/*.test.{ts,tsx}").map((f) => f.replaceAll("\\", "/"));
    const included = filesIn(projects);
    expect([...included].sort()).toEqual([...all].sort());
    expect(new Set(included).size).toBe(included.length);
  });

  it("puts a .tsx file in a happy-dom project and a .ts file in a node project", () => {
    expect(filesIn(byEnvironment("happy-dom")).every((f) => f.endsWith(".tsx"))).toBe(true);
    expect(filesIn(byEnvironment("node")).every((f) => f.endsWith(".ts"))).toBe(true);
  });

  it("isolates exactly the files that need their own modules", () => {
    expect(filesIn(isolated)).toContain("tests/api/stream.test.ts"); // vi.mock
    expect(filesIn(isolated)).toContain("tests/scripts/set-owner.test.ts"); // a database file
    expect(filesIn(shared)).toContain("tests/i18n.test.ts");
    expect(filesIn(shared)).toContain("tests/api/users-repo.test.ts"); // in-memory database
  });

  it("loads the DOM test setup only for the happy-dom projects", () => {
    for (const p of byEnvironment("happy-dom")) expect(setupFiles(p)).toContain("tests/setup.ts");
    for (const p of byEnvironment("node")) expect(setupFiles(p)).not.toContain("tests/setup.ts");
  });

  it("gives every file in a shared project a fresh database and no leftover stubs", () => {
    for (const p of shared) expect(setupFiles(p)[0]).toBe("tests/setup.shared.ts");
  });

  it("never lets a test reach the real database in data/", () => {
    for (const p of projects) expect(p.env?.DATABASE_URL).toBe("file::memory:");
  });
});

describe("needsIsolation", () => {
  it("is true for a module mock, which would leak into the next file's imports", () => {
    expect(needsIsolation(`vi.mock("~/server/auth.server", () => ({}));`)).toBe(true);
  });

  it("is true for a setting that env.server reads once, at import", () => {
    expect(needsIsolation(`process.env.DAILY_REQUEST_LIMIT = "2";`)).toBe(true);
    expect(needsIsolation(`process.env.NODE_ENV ??= "production";`)).toBe(true);
    expect(needsIsolation(`vi.stubEnv("ANTHROPIC_API_KEY", "x");`)).toBe(true);
  });

  it("is true for a database in a file", () => {
    expect(needsIsolation("process.env.DATABASE_URL = `file:/tmp/test.db`;")).toBe(true);
    expect(needsIsolation("DATABASE_URL: `file:/tmp/test.db` },")).toBe(true);
  });

  it("is false for the in-memory database, which every project already sets", () => {
    expect(needsIsolation(`process.env.DATABASE_URL = "file::memory:";`)).toBe(false);
    expect(needsIsolation(`process.env.DATABASE_URL ??= "file::memory:";`)).toBe(false);
  });

  it("is false for a plain test, a spy or a reading of process.env", () => {
    expect(needsIsolation(`it("adds", () => expect(1 + 1).toBe(2));`)).toBe(false);
    expect(needsIsolation(`const spy = vi.spyOn(console, "error");`)).toBe(false);
    expect(needsIsolation(`const key = process.env.ANTHROPIC_API_KEY;`)).toBe(false);
    expect(needsIsolation(`expect(process.env.X === "1").toBe(false);`)).toBe(false);
  });
});
