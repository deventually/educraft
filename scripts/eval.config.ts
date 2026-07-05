import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

/**
 * Minimal Vite config for the eval harness (run via `vite-node -c`). The harness
 * must reuse the REAL prompt pipeline (buildSystemPrompt → getRuntimePrompt →
 * `?raw` prompt files), which plain tsx/Node cannot load — esbuild chokes on the
 * `?raw` query. vite-node transforms `?raw` natively; this config only adds the
 * `~` → app alias (mirroring vitest.config.ts) without pulling in the React
 * Router plugin, so the script boots fast and side-effect-free.
 */
export default defineConfig({
  resolve: { alias: { "~": fileURLToPath(new URL("../app", import.meta.url)) } },
});
