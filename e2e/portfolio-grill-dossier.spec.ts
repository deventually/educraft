import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, watchCsp } from "./helpers";
import { E2E_GRILL_DOSSIER } from "./seedDossier";
import { storageStateOf } from "./users";

test.use({ storageState: storageStateOf("admin") });

/**
 * Grill me over the whole dossier, on the dossier's Write tab: one Grill me button, the
 * questions per learning outcome (the same ones as on the chapter tab), answer fields labelled
 * by their question and reachable by keyboard, axe finds nothing, nothing scrolls sideways at
 * 320px. Saving the answers keeps them, and focus with the save button.
 */
test("the write tab grills the whole dossier, by keyboard", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/portfolio");
  await page.getByRole("link", { name: E2E_GRILL_DOSSIER }).first().click();
  await page.waitForURL(/\/portfolio\/[^/?]+$/);
  await page
    .getByRole("navigation", { name: "Onderdelen van je dossier" })
    .getByRole("link", { name: "Schrijven" })
    .click();
  await page.waitForURL(/\?tab=write$/);

  const grill = page.getByRole("region", { name: "Grill me over het hele dossier" });
  await expect(grill.getByRole("button", { name: "Grill me" })).toBeVisible();
  await expect(grill.getByRole("heading", { name: "LU1 Doceren" })).toBeVisible();
  await expect(grill.getByRole("button", { name: "Stel alle hoofdstukken op" })).toBeVisible();

  const first = grill.getByRole("textbox", { name: "Welke groep had je, en wat konden ze al?" });
  await expect(first).toHaveValue("Een tweedejaars klas.");
  await first.focus();
  await page.keyboard.press("Tab");
  const second = grill.getByRole("textbox", { name: "Hoe bracht je dat in kaart?" });
  await expect(second).toBeFocused();
  await second.fill("Met de toets van week 1.");

  await expectNoAxeViolations(page);

  const save = grill.getByRole("button", { name: "Bewaar je antwoorden" });
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Je antwoorden zijn bewaard.")).toBeVisible();
  await expect(save).toBeFocused();
  await page.reload();
  await expect(grill.getByRole("textbox", { name: "Hoe bracht je dat in kaart?" })).toHaveValue(
    "Met de toets van week 1.",
  );

  await page.setViewportSize({ width: 320, height: 800 });
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(sideways).toBe(false);
  expect(csp).toEqual([]);
});
