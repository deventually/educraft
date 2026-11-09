import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests (`npm run test:e2e`): the production build against a throwaway database with a
 * seeded teacher and admin. The build is the real thing: same CSP, same headers, same bundles.
 */
const PORT = 4173;
const DATABASE_URL = "file:./e2e/.data/e2e.db";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "nl-NL",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // A pre-installed browser (e.g. a sandbox without `playwright install`).
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command:
      "npm run build && npx tsx e2e/seed.ts && npx react-router-serve ./build/server/index.js",
    url: `http://localhost:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      PORT: String(PORT),
      NODE_ENV: "production",
      DATABASE_URL,
      BACKUP_DIR: "off",
      SESSION_SECRET: "e2e-only-session-secret-not-used-anywhere-else",
      APP_ORIGIN: `http://localhost:${PORT}`,
    },
  },
});
