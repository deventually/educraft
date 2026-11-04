import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../react-router.config";

/**
 * `npm run dev` should start without warnings: no React Router v8 future-flag warnings and no
 * Vite `envFile` deprecation (that one comes from inside @react-router/dev and is patched).
 */
const root = resolve(__dirname, "..");

describe("dev server config", () => {
  it("opts in to every React Router v8 future flag", () => {
    expect(config.future).toEqual({
      v8_middleware: true,
      v8_passThroughRequests: true,
      v8_splitRouteModules: true,
      v8_trailingSlashAwareDataRequests: true,
      v8_viteEnvironmentApi: true,
    });
  });

  it.each([
    "vite.js",
    "cli/index.js",
    "vite/cloudflare.js",
  ])("@react-router/dev dist/%s uses envDir: false, not the deprecated envFile", (file) => {
    const source = readFileSync(resolve(root, "node_modules/@react-router/dev/dist", file), "utf8");
    expect(source).not.toContain("envFile: false");
    expect(source).toContain("envDir: false");
  });
});

describe("Dockerfile with the patch-package postinstall", () => {
  const dockerfile = readFileSync(resolve(root, "Dockerfile"), "utf8");

  it("skips install scripts for the production deps (patch-package is a devDependency)", () => {
    expect(dockerfile).toContain("npm ci --omit=dev --ignore-scripts");
  });

  it("still builds the one native production dependency", () => {
    expect(dockerfile).toContain("npm rebuild better-sqlite3");
  });
});
