import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, watchCsp } from "./helpers";
import { E2E_DOSSIER } from "./seedDossier";
import { storageStateOf } from "./users";

test.use({ storageState: storageStateOf("admin") });

/**
 * Quotes from feedback: who gave it, "Stel citaten voor" opens the overview before sending (focus
 * on its heading, the giver's name listed to be replaced), and Bewaar stores who gave it. Without
 * a model in the browser tests the proposal fails politely. axe finds nothing and nothing
 * scrolls sideways at 320px.
 */
test("asks who gave the feedback and shows what goes to the AI first", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/portfolio");
  await page.getByRole("link", { name: E2E_DOSSIER }).first().click();
  await page.waitForURL(/\/portfolio\/[^/?]+$/);
  await page.getByRole("link", { name: "Citaten uit feedback" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Citaten uit feedback");
  await expect(page.getByRole("heading", { name: "Feedback werkplekbegeleider" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByLabel("Naam").fill("Marieke de Groot");
  await page.getByLabel("Rol").selectOption({ label: "Werkplekbegeleider" });
  await page.getByLabel("Datum").fill("2026-11-12");
  await page.getByRole("button", { name: "Stel citaten voor" }).click();
  const overview = page.getByRole("region", { name: "Kijk na wat er naar de AI gaat" });
  await expect(
    overview.getByRole("heading", { name: "Kijk na wat er naar de AI gaat" }),
  ).toBeFocused();
  await expectNoAxeViolations(page);
  await overview.getByRole("button", { name: "Versturen" }).click();
  await expect(
    page.getByText("Het voorstel kon niet gelezen worden.", { exact: false }),
  ).toBeVisible();

  await page.setViewportSize({ width: 320, height: 800 });
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(sideways).toBe(false);

  const save = page.getByRole("button", { name: "Bewaar" });
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Citaten bewaard.")).toBeVisible();
  await expect(page.getByLabel("Naam")).toHaveValue("Marieke de Groot");
  expect(csp).toEqual([]);
});
