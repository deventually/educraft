import { expect, test } from "@playwright/test";
import { storageStateOf } from "./users";

/**
 * Reflow (WCAG 1.4.10): at 320 CSS pixels wide the header still fits, so the menu button is
 * fully on screen and nothing scrolls sideways.
 */
for (const as of ["teacher", "admin"] as const) {
  test.describe(() => {
    test.use({ storageState: storageStateOf(as), viewport: { width: 320, height: 800 } });

    test(`/start as ${as}: no sideways scroll at 320px`, async ({ page }) => {
      await page.goto("/start");
      await page.locator("main").first().waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}
