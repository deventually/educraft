import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, watchCsp } from "./helpers";
import { storageStateOf } from "./users";

test.use({ storageState: storageStateOf("teacher") });

/**
 * The teacher's own notes on the test analysis (P35.2): from a summative test to its note page,
 * the note written and saved by keyboard with one announcement, no axe violations, and nothing
 * that scrolls sideways at 320px. Without a linked analysis there is no concept button.
 */
test("write and save the notes on a test analysis", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/courses");
  await page.getByRole("button", { name: "Nieuwe cursus" }).first().click();
  await page.getByLabel("Naam", { exact: true }).fill("Toelichting (e2e)");
  await page.getByRole("button", { name: "Cursus aanmaken" }).click();
  await page.waitForURL(/\/courses\/[^/?]+$/);
  await page.goto(`${page.url()}?tab=plan`);
  const tests = page.getByRole("region", { name: "Toetsen" });
  await tests.getByLabel("Titel", { exact: true }).last().fill("Tentamen SQL");
  await tests.getByRole("button", { name: "Toets toevoegen" }).click();

  const link = page.getByRole("link", { name: /^Toelichting schrijven\s*: Tentamen SQL$/ });
  await link.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/note$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Tentamen SQL: toelichting bij de toetsanalyse",
  );
  await expect(page.getByText(/Koppel eerst een toetsanalyse/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Concept laten schrijven" })).toHaveCount(0);
  await expectNoAxeViolations(page);

  const field = page.getByLabel("Jouw toelichting bij de toetsanalyse");
  await field.focus();
  await page.keyboard.type("Vraag 2 herschrijf ik.");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Toelichting opslaan" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Toelichting opgeslagen." })).toHaveCount(
    1,
  );
  await page.reload();
  await expect(field).toHaveValue("Vraag 2 herschrijf ik.");

  await page.setViewportSize({ width: 320, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(csp).toEqual([]);
});
