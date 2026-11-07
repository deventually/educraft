import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** P30.2: one print stylesheet for the print page, the grade calculator and the rubric. */
const css = readFileSync(resolve(__dirname, "../app/app.css"), "utf8");
const print = css.slice(css.indexOf("@media print"));

describe("print stylesheet (P30.2)", () => {
  it("prints on A4 with margins", () => {
    expect(print).toMatch(/@page\s*\{[^}]*size:\s*A4/);
    expect(print).toMatch(/@page\s*\{[^}]*margin:/);
  });

  it("repeats a table's header row on every page and keeps rows whole", () => {
    expect(print).toMatch(/thead\s*\{[^}]*display:\s*table-header-group/);
    expect(print).toMatch(/tr[^{]*\{[^}]*break-inside:\s*avoid/);
  });
});
