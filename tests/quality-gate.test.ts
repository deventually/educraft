import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The gate (`npm run check`, also in CI) fails on Biome warnings, not only on errors, so warnings
 * such as dead code cannot pile up. Fix a warning; don't suppress it.
 */
const root = resolve(__dirname, "..");
const scripts = (
  JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  }
).scripts;

describe("quality gate", () => {
  it.each(["check", "lint"])("npm run %s treats Biome warnings as errors", (name) => {
    expect(scripts[name]).toMatch(/^biome \w+ .*--error-on-warnings/);
  });

  it("CI runs the check script", () => {
    expect(readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8")).toContain(
      "npm run check",
    );
  });
});
