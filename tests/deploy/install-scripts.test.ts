import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * npm 11+ only runs a dependency's install script when package.json `allowScripts` covers it
 * (npm 12 blocks the rest). better-sqlite3 builds its native binding in one, so without an entry
 * the app has no database. The lockfile marks most packages with a script (`hasInstallScript`);
 * better-sqlite3's script is implied by its binding.gyp, so it is named here explicitly.
 */
const root = resolve(__dirname, "../..");
const readJson = <T>(file: string) => JSON.parse(readFileSync(resolve(root, file), "utf8")) as T;

type Lock = { packages: Record<string, { version?: string; hasInstallScript?: boolean }> };
const pkg = readJson<{ allowScripts?: Record<string, boolean> }>("package.json");
const lock = readJson<Lock>("package-lock.json");

const nameOf = (path: string) => path.split("node_modules/").at(-1) ?? path;
const entries = Object.entries(lock.packages).filter(([path]) => path !== "");

const withScripts = new Set([
  "better-sqlite3",
  ...entries.filter(([, p]) => p.hasInstallScript).map(([path]) => nameOf(path)),
]);

const versionsOf = (name: string) =>
  entries.filter(([path]) => nameOf(path) === name).map(([, p]) => p.version ?? "0.0.0");

const parts = (version: string) => (version.split("-")[0] ?? "").split(".").map(Number);
const atLeast = (version: string, minimum: string) => {
  const [a, b] = [parts(version), parts(minimum)];
  for (let i = 0; i < 3; i++) {
    const [x, y] = [a[i] ?? 0, b[i] ?? 0];
    if (x !== y) return x > y;
  }
  return true;
};

describe("install scripts", () => {
  it.each([...withScripts])("allowScripts decides on %s by name, for every version", (name) => {
    expect(typeof pkg.allowScripts?.[name]).toBe("boolean");
  });

  it("lets better-sqlite3 build its native binding", () => {
    expect(pkg.allowScripts?.["better-sqlite3"]).toBe(true);
  });

  it("names no package that has no install script", () => {
    expect(Object.keys(pkg.allowScripts ?? {}).filter((n) => !withScripts.has(n))).toEqual([]);
  });
});

describe("audited dependencies", () => {
  it.each([
    ["qs", "6.17.0"],
    ["minimatch", "11.0.1"],
  ])("every %s in the lockfile is at least %s (moderate advisories)", (name, minimum) => {
    const versions = versionsOf(name);
    expect(versions.length).toBeGreaterThan(0);
    expect(versions.filter((v) => !atLeast(v, minimum))).toEqual([]);
  });
});
