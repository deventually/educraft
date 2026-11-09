import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGES } from "../e2e/pages";
import { flatRoutes } from "./helpers/routes";

/**
 * The browser tests (Playwright + axe, `e2e/`) only protect us if they run and if the pages they
 * visit still exist. A renamed route would otherwise turn an axe check into a check of a 404 page.
 */
const root = resolve(__dirname, "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");
const scripts = (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts;

/** `/tools/:slug` matches `/tools/clear-assignment`; a static segment must match exactly. */
const matches = (pattern: string, path: string) => {
  const want = pattern.split("/");
  const got = path.split("/");
  return (
    want.length === got.length && want.every((seg, i) => seg.startsWith(":") || seg === got[i])
  );
};

describe("e2e setup", () => {
  it("has an npm script that runs Playwright", () => {
    expect(scripts["test:e2e"]).toMatch(/^playwright test/);
  });

  it("CI runs the browser tests", () => {
    expect(read(".github/workflows/ci.yml")).toContain("npm run test:e2e");
  });

  it("covers the key pages for a guest, a teacher and an admin", () => {
    const roles = new Set(PAGES.map((p) => p.as));
    expect([...roles].sort()).toEqual(["admin", "guest", "teacher"]);
  });

  it.each(PAGES.map((p) => [p.path, p]))("%s is a real route", (_path, page) => {
    const patterns = flatRoutes().map((r) => r.path.replace(/\/$/, "") || "/");
    expect(patterns.some((pattern) => matches(pattern, page.path))).toBe(true);
  });

  it("each page is listed once", () => {
    const keys = PAGES.map((p) => `${p.as} ${p.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
