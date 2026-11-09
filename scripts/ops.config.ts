import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * Bundles the ops scripts into plain ES modules (`build/ops/<name>.js`) so the production image
 * runs them with bare `node`: no tsx, no TypeScript source, no dev dependencies. Packages stay
 * external (SSR default) and come from the image's production node_modules.
 *
 *   node build/ops/migrate.js
 *   node build/ops/create-admin.js --name "…" --email …
 *   node build/ops/backup.js
 */
export const OPS_SCRIPTS = [
  { name: "migrate", entry: "app/server/migrate.ts" },
  { name: "create-admin", entry: "scripts/create-admin.ts" },
  { name: "set-owner", entry: "scripts/set-owner.ts" },
  { name: "reset-2fa", entry: "scripts/reset-2fa.ts" },
  { name: "invite", entry: "scripts/invite.ts" },
  { name: "backup", entry: "scripts/backup.ts" },
  { name: "restore", entry: "scripts/restore.ts" },
] as const;

const root = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root,
  publicDir: false,
  resolve: { alias: { "~": fileURLToPath(new URL("../app", import.meta.url)) } },
  build: {
    ssr: true,
    outDir: "build/ops",
    emptyOutDir: true,
    target: "node24",
    minify: false,
    rollupOptions: {
      input: Object.fromEntries(OPS_SCRIPTS.map((s) => [s.name, s.entry])),
      output: { format: "es", entryFileNames: "[name].js", chunkFileNames: "chunks/[name]-[hash].js" },
    },
  },
});
