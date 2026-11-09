import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, watchCsp } from "./helpers";
import { PAGES } from "./pages";
import { storageStateOf } from "./users";

/** Every key page: it loads, axe finds nothing at WCAG 2.2 AA, and the CSP blocks nothing. */
for (const { path, as } of PAGES) {
  test.describe(() => {
    // Signed in once per role by auth.setup.ts (the admin with two-step verification).
    if (as !== "guest") test.use({ storageState: storageStateOf(as) });

    test(`${path} as ${as}: accessible, no CSP violations`, async ({ page }) => {
      const csp = watchCsp(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe(path);
      await page.locator("main").first().waitFor();
      await expectNoAxeViolations(page);
      expect(csp).toEqual([]);
    });
  });
}
