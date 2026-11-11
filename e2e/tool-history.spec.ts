import { expect, test } from "@playwright/test";
import { storageStateOf } from "./users";

test.use({ storageState: storageStateOf("teacher") });

/** Back and Forward bring a tool's form back; opening the tool again starts empty. */
test("back and forward keep what was typed in a tool", async ({ page }) => {
  await page.goto("/tools");
  // Into the tool by a link on the page (a client-side navigation).
  await page.locator('a[href="/tools/differentiation"]').first().click();
  await page.waitForURL("**/tools/differentiation");
  const box = page.getByRole("textbox").first();
  await box.fill("fotosynthese in de onderbouw");
  await page.goBack();
  await page.waitForURL("**/tools");
  await page.goForward();
  await page.waitForURL("**/tools/differentiation");
  await expect(page.getByRole("textbox").first()).toHaveValue("fotosynthese in de onderbouw");
  // Opened again by a link: a fresh form.
  await page.goBack();
  await page.locator('a[href="/tools/differentiation"]').first().click();
  await page.waitForURL("**/tools/differentiation");
  await expect(page.getByRole("textbox").first()).toHaveValue("");
});
