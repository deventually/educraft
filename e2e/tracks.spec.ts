import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, watchCsp } from "./helpers";
import { storageStateOf } from "./users";

test.use({ storageState: storageStateOf("teacher") });

/**
 * The internship and thesis track (P38.2): open a track under a code, walk its tabs by
 * keyboard, set the start milestone done, every screen without axe violations, no sideways
 * scroll at 320px, and wipe it again.
 */
test("open a track, set a milestone and wipe it", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/tracks");
  await expectNoAxeViolations(page);
  await page.getByLabel("Code van de student").fill("S-E2E");
  await page.getByLabel("Afstuderen").check();
  await page.getByRole("button", { name: "Traject openen" }).click();
  await page.waitForURL(/\/tracks\/[^/?]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Traject S-E2E" })).toBeVisible();
  await expectNoAxeViolations(page);

  const tabs = page.getByRole("navigation", { name: "Onderdelen van het traject" });
  await tabs.getByRole("link", { name: "Start" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/tab=start/);
  await expect(page.getByRole("link", { name: /Plan van aanpak toetsen/ })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByLabel("Klaar").check();
  await page.getByRole("button", { name: "Bewaren" }).click();
  await expect(page.getByText("Mijlpaal bewaard.")).toBeVisible();

  await tabs.getByRole("link", { name: "Overzicht" }).click();
  await expect(page.getByText("1 van 6 mijlpalen klaar")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.goto("/tracks");
  await page.getByRole("button", { name: "Nu wissen: S-E2E" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Nu wissen" }).click();
  await expect(page.getByText("Nog geen trajecten")).toBeVisible();
  expect(csp).toEqual([]);
});
