import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every package we import must be declared in package.json, not just arrive through another
 * package. A transitive dependency can vanish on any upgrade (vite-node did with React Router 8).
 */
const root = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);
const builtins = new Set(builtinModules);

const sourceFiles = (dir: string): string[] =>
  readdirSync(resolve(root, dir), { recursive: true, encoding: "utf8" })
    .filter((f) => /\.(m?[jt]sx?)$/.test(f) && !f.includes("node_modules"))
    .map((f) => join(dir, f));

// Static and side-effect imports, dynamic import() and vi.mock() of a bare package name.
const specifier =
  /(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+|\bvi\.mock\(\s*)["']([^"'./~][^"']*)["']/gm;

const packageName = (spec: string) =>
  spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];

describe("declared dependencies", () => {
  it.each([
    "app",
    "scripts",
    "evals",
    "tests",
  ])("every package imported in %s/ is in package.json", (dir) => {
    const undeclared = new Set<string>();
    for (const file of sourceFiles(dir)) {
      for (const [, spec] of readFileSync(resolve(root, file), "utf8").matchAll(specifier)) {
        if (spec!.startsWith("node:") || spec!.startsWith("virtual:") || spec!.startsWith("+types"))
          continue;
        // Skip prose that happens to follow "from" (prompt text), keep real package names.
        if (!/^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(\/\S*)?$/.test(spec!)) continue;
        const name = packageName(spec!);
        if (!builtins.has(name!) && !declared.has(name!)) undeclared.add(`${name} (${file})`);
      }
    }
    expect([...undeclared]).toEqual([]);
  });
});
