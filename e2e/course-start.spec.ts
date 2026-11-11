import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, watchCsp } from "./helpers";
import { storageStateOf } from "./users";

test.use({ storageState: storageStateOf("teacher") });

/**
 * A new course opens on "how do you want to start": reachable by keyboard, the design form opens
 * from its summary, axe finds nothing with it open, and nothing scrolls sideways at 320px.
 */
test("a new course asks how to start, and the design form works by keyboard", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/courses");
  await page.getByLabel("Naam", { exact: true }).fill("Databases (e2e)");
  await page.getByRole("button", { name: "Cursus aanmaken" }).click();
  await page.waitForURL(/\/courses\/[^/?]+$/);

  const start = page.getByRole("region", { name: "Hoe wil je beginnen?" });
  await expect(start).toBeVisible();
  await expect(start.getByRole("link", { name: "Naar importeren" })).toBeVisible();
  await expect(start.getByRole("link", { name: "Naar leeruitkomsten" })).toBeVisible();

  // The design choice is a disclosure: focus its summary and open it with Enter.
  const summary = start.locator("summary").first();
  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  const description = page.getByLabel("Waar gaat de cursus over?");
  await expect(description).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(description).toBeFocused();
  await expect(page.getByRole("button", { name: "Leeruitkomsten voorstellen" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.setViewportSize({ width: 320, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(csp).toEqual([]);
});
