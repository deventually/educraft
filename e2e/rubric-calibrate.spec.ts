import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, watchCsp } from "./helpers";
import { storageStateOf } from "./users";

test.use({ storageState: storageStateOf("teacher") });

/**
 * Calibrating (P34.2): from the rubric page to the calibrate page, two raters pasted, an outcome
 * without axe violations, a new work focused by keyboard, and no sideways scroll at 320px.
 */
test("calibrate a rubric with a second rater", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/utilities/rubric");
  await page.getByRole("button", { name: "Nieuwe rubric" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Naam van de rubric").fill("Kalibreren (e2e)");
  await dialog.getByRole("button").last().click();
  await page.waitForURL(/\/utilities\/rubric\/[^/]+$/);
  await page.getByRole("link", { name: "Kalibreren" }).click();
  await page.waitForURL(/\/calibrate$/);

  const one = page.getByRole("group", { name: "Beoordelaar 1" });
  const two = page.getByRole("group", { name: "Beoordelaar 2" });
  await one.getByRole("button", { name: "Werk toevoegen" }).focus();
  await page.keyboard.press("Enter");
  await expect(one.getByLabel("Code van werk 1")).toBeFocused();

  const levels = await one.locator("select").first().locator("option").allTextContents();
  await one.getByLabel("Plak uit Excel").fill(`A1\t${levels[1]}\nA2\t${levels[2]}\nA3\tFout`);
  await one.getByRole("button", { name: "Overnemen" }).click();
  await expect(one.getByText(/Regel 3/)).toBeVisible();
  await two.getByLabel("Plak uit Excel").fill(`A1\t${levels[1]}\nA2\t${levels[1]}`);
  await two.getByRole("button", { name: "Overnemen" }).click();

  await expect(page.getByRole("table", { name: "Overeenstemming per criterium" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Agenda voor het gesprek" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.setViewportSize({ width: 320, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(csp).toEqual([]);
});
