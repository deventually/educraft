import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * knip finds unused files, exports and dependencies. It runs as part of `npm run check`, so the
 * gate (and CI) fails when dead code comes back.
 */
const root = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe("knip (dead code)", () => {
  it("is a dev dependency with a config", () => {
    expect(pkg.devDependencies.knip).toBeDefined();
    expect(existsSync(resolve(root, "knip.json"))).toBe(true);
  });

  it("runs in the gate: npm run check calls knip", () => {
    expect(pkg.scripts.knip).toMatch(/^knip\b/);
    expect(pkg.scripts.check).toContain("npm run knip");
  });

  it("knows the entry points it cannot infer (vite-node config, fixture generator)", () => {
    const config = JSON.parse(readFileSync(resolve(root, "knip.json"), "utf8")) as {
      entry: string[];
    };
    expect(config.entry).toEqual(
      expect.arrayContaining(["scripts/eval.config.ts", "tests/fixtures/generate.mjs"]),
    );
  });
});
