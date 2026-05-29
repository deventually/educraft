import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Standalone vitest config (avoids loading the React Router Vite plugin).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) },
  },
});
