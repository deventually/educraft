import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../playwright.config";
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

  it("CI keeps the browser test job", () => {
    expect(read(".github/workflows/ci.yml")).toContain("npm run test:e2e");
  });

  // Temporarily the e2e job runs only when the repository variable E2E_IN_CI is "true" (the
  // runner could not install Chromium); the local run goes in the PR (BESLUIT-2026-11-11-9).
  it("CI runs the browser tests only when the E2E_IN_CI variable switches them on", () => {
    const job = read(".github/workflows/ci.yml").split(/^ {2}e2e:$/m)[1] ?? "";
    expect(job).toMatch(/^ {4}if: vars\.E2E_IN_CI == 'true'$/m);
  });

  it("AGENTS.md has workers run the browser tests themselves while CI does not", () => {
    const agents = read("AGENTS.md");
    expect(agents).toContain("E2E_IN_CI");
    expect(agents).toContain("PLAYWRIGHT_CHROMIUM_PATH");
  });

  it("the PR template asks for the local browser test result", () => {
    expect(read(".github/pull_request_template.md")).toContain("npm run test:e2e");
  });

  it("covers the key pages for a guest, a teacher and an admin", () => {
    const roles = new Set(PAGES.map((p) => p.as));
    expect([...roles].sort()).toEqual(["admin", "guest", "teacher"]);
  });

  it.each(PAGES.map((p) => [p.path, p]))("%s is a real route", (_path, page) => {
    const patterns = flatRoutes().map((r) => r.path.replace(/\/$/, "") || "/");
    expect(patterns.some((pattern) => matches(pattern, page.path))).toBe(true);
  });

  it("signs in once per role, the admin with two-step verification (P2-12)", () => {
    const config = read("playwright.config.ts");
    expect(config).toContain("auth\\.setup\\.ts");
    expect(config).toMatch(/dependencies: \["setup"\]/);
    expect(read("e2e/auth.setup.ts")).toContain("/login/2fa");
    expect(PAGES).toContainEqual({ path: "/account/2fa", as: "teacher" });
  });

  // PLAYWRIGHT_CHROMIUM_PATH must reach the setup project too, or a sandbox with its own browser
  // fails at sign-in before a single page runs.
  it("a pre-installed browser applies to every project, the sign-in setup included", () => {
    expect(config.use).toHaveProperty("launchOptions");
    for (const project of config.projects ?? []) {
      expect(project.use ?? {}).not.toHaveProperty("launchOptions");
    }
  });

  it("each page is listed once", () => {
    const keys = PAGES.map((p) => `${p.as} ${p.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
