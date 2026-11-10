import { globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type TestProjectInlineConfiguration } from "vitest/config";
import { needsIsolation } from "./tests/helpers/isolation";

const alias = { "~": fileURLToPath(new URL("./app", import.meta.url)) };

/**
 * Standalone vitest config (avoids loading the React Router Vite plugin).
 *
 * Each environment has two projects. Most files run shared (`isolate: false`): the app's modules
 * load once per worker, not once per file, which halves the run. A file that mocks a module or sets
 * the environment (`needsIsolation`) gets a fresh module graph of its own.
 */
function split(glob: string) {
  const files = globSync(glob).map((f) => f.replaceAll("\\", "/"));
  const isolated = files.filter((f) => needsIsolation(readFileSync(f, "utf8")));
  return { isolated, shared: files.filter((f) => !isolated.includes(f)) };
}

function projects(
  name: string,
  environment: "node" | "happy-dom",
  glob: string,
  setupFiles: string[],
): TestProjectInlineConfiguration[] {
  const { isolated, shared } = split(glob);
  const base = {
    globals: true,
    environment,
    // Never the real database in data/, whatever a file imports first.
    env: { DATABASE_URL: "file::memory:" },
  };
  return [
    { resolve: { alias }, test: { ...base, name, include: isolated, setupFiles } },
    {
      resolve: { alias },
      test: {
        ...base,
        name: `${name}-shared`,
        isolate: false,
        include: shared,
        setupFiles: ["tests/setup.shared.ts", ...setupFiles],
      },
    },
  ];
}

export default defineConfig({
  test: {
    projects: [
      // No DOM setup for node: jest-dom and Testing Library are only for the happy-dom projects.
      ...projects("node", "node", "tests/**/*.test.ts", []),
      ...projects("dom", "happy-dom", "tests/**/*.test.tsx", ["tests/setup.ts"]),
    ],
  },
});
