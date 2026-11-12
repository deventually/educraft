import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The prompt evals (`npm run eval`, `npm run eval:coach`) run through vite-node. It used to
 * arrive only as a dependency of vitest 3; vitest 4 dropped it and the evals stopped starting
 * ("vite-node: command not found") without any test noticing. Every command an npm script
 * starts must be one of our own declared dependencies.
 */
const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8")) as {
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);

describe("eval scripts", () => {
  for (const name of [
    "eval",
    "eval:coach",
    "eval:agents",
    "eval:import",
    "eval:framework",
    "eval:guided",
    "eval:evidence",
  ]) {
    it(`${name} starts a command from a declared dependency`, () => {
      const bin = pkg.scripts[name]?.split(" ")[0];
      expect(bin).toBe("vite-node");
      expect(declared.has(bin!)).toBe(true);
    });
  }

  it("declares jszip, which the portfolio export tests import directly", () => {
    // It used to arrive only through another package (mammoth); a later update could drop it.
    expect(declared.has("jszip")).toBe(true);
  });
});
