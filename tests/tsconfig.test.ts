import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Stricter TypeScript, phased (one flag set per PR). Once a flag is on it stays on: this test
 * keeps a later change from quietly switching it off again.
 */
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "..", "tsconfig.json"), "utf8")) as {
  compilerOptions: Record<string, unknown>;
};

describe("tsconfig strictness", () => {
  it.each(["strict", "noUnusedLocals", "noFallthroughCasesInSwitch", "noUncheckedIndexedAccess"])(
    "%s is on",
    (flag) => {
      expect(tsconfig.compilerOptions[flag]).toBe(true);
    },
  );
});
