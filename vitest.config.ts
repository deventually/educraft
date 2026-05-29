import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = { "~": fileURLToPath(new URL("./app", import.meta.url)) };

// Standalone vitest config (avoids loading the React Router Vite plugin).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          globals: true,
          environment: "node",
          include: ["tests/**/*.test.ts"],
          setupFiles: ["tests/setup.ts"],
        },
        resolve: {
          alias,
        },
      },
      {
        test: {
          globals: true,
          environment: "happy-dom",
          include: ["tests/**/*.test.tsx"],
          setupFiles: ["tests/setup.ts"],
        },
        resolve: {
          alias,
        },
      },
    ],
  },
});
