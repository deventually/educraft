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

  // Biome 2.6 formats Markdown too. Prompt files hold the book's verbatim text and help pages are
  // hand-written, so the formatter must not touch them.
  it("keeps Markdown (prompts and help pages) out of Biome", () => {
    const biome = JSON.parse(readFileSync(resolve(root, "biome.json"), "utf8")) as {
      files: { includes: string[] };
    };
    expect(biome.files.includes).toContain("!**/*.md");
  });

  // Two a11y rules were off. A button without a type submits its form by accident; a label
  // without a control is read without the field it names. Both stay on.
  it("keeps every Biome a11y rule on", () => {
    const biome = JSON.parse(readFileSync(resolve(root, "biome.json"), "utf8")) as {
      linter: { rules: { a11y?: Record<string, string | { level: string }> } };
    };
    const off = Object.entries(biome.linter.rules.a11y ?? {})
      .filter(([, v]) => (typeof v === "string" ? v : v.level) === "off")
      .map(([rule]) => rule);
    expect(off).toEqual([]);
  });

  it("CI runs the check script", () => {
    expect(readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8")).toContain(
      "npm run check",
    );
  });
});
