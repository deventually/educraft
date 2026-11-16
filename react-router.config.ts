import type { Config } from "@react-router/dev/config";

export default {
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  future: {
    // Let Vite pre-bundle the dependencies of every route at dev-server start, instead of
    // discovering them on the first visit to a page and reloading (a stale tab then gets
    // "504 Outdated Optimize Dep" and stops working).
    unstable_optimizeDeps: true,
  },
} satisfies Config;
