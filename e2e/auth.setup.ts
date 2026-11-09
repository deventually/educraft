import { readFileSync } from "node:fs";
import { test as setup } from "@playwright/test";
import { totpCode } from "../app/server/totp.server";
import { ADMIN_TOTP_FILE, USERS, storageStateOf } from "./users";

/**
 * Sign in each role once and keep the browser state. The admin passes two-step verification
 * (required for admins, P2-12) with a code from the secret `seed.ts` left behind.
 */
for (const role of ["teacher", "admin"] as const) {
  setup(`sign in as ${role}`, async ({ page }) => {
    const user = USERS[role];
    await page.goto("/login");
    await page.locator("#email").fill(user.email);
    await page.locator("#password").fill(user.password);
    await page.locator('form[method="post"] button[type="submit"]').click();
    if (role === "admin") {
      await page.waitForURL("**/login/2fa");
      const secret = readFileSync(ADMIN_TOTP_FILE, "utf8").trim();
      await page.locator("#code").fill(totpCode(secret, Math.floor(Date.now() / 30_000)));
      await page.locator('form[method="post"] button[type="submit"]').click();
    }
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
    await page.context().storageState({ path: storageStateOf(role) });
  });
}
