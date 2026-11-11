import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, watchCsp } from "./helpers";
import { storageStateOf } from "./users";

// The dossier is off by default for a teacher; an admin always has it.
test.use({ storageState: storageStateOf("admin") });

/**
 * A new dossier opens the start wizard: the framework (the national starting point here), an
 * anchor per learning outcome, the hand-in date and the day plan. Axe finds nothing on any step, the steps work
 * by keyboard, and nothing scrolls sideways at 320px.
 */
test("a new dossier walks through the start wizard", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/portfolio");
  await page.getByLabel("Naam", { exact: true }).fill("Mijn BDB (e2e)");
  await page.getByRole("button", { name: "Dossier aanmaken" }).click();
  await page.waitForURL(/\/portfolio\/[^/]+\/start\?step=framework$/);
  await expect(page.getByText("Stap 2 van 4")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Startpunt gebruiken" }).click();
  await expect(page.getByRole("link", { name: "Controleer en pas aan" })).toBeVisible();

  const next = page.getByRole("link", { name: "Volgende stap" });
  await next.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/step=anchors$/);
  const first = page.getByRole("group", { name: "BDB-1 Doceren" });
  await first.getByLabel("Of beschrijf het kort").fill("Mijn les over normaliseren");
  await page.getByRole("button", { name: "Ankers opslaan" }).click();
  await expect(page.getByText("Ankers opgeslagen.")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Volgende stap" }).click();
  await page.waitForURL(/step=planning$/);
  await page.getByLabel("Inleverdatum").fill("2099-01-01");
  await page.getByLabel("Uren per dag").fill("4");
  await page.getByRole("button", { name: "Planning opslaan" }).click();
  await expect(page.getByText(/Inleveren op/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Dagplan" })).toBeVisible();
  await expect(page.getByText(/werkdag(en)? van 4 uur/)).toBeVisible();
  await expectNoAxeViolations(page);

  // The overview carries the same plan; its rates open by keyboard.
  await page.getByRole("link", { name: "Klaar, naar je dossier" }).click();
  const plan = page.getByRole("region", { name: "Dagplan" });
  await expect(plan).toBeVisible();
  await plan.getByText("Hoe LimeOnIt rekent").focus();
  await page.keyboard.press("Enter");
  await expect(plan.getByText(/Vaste richtwaarden/)).toBeVisible();
  await expectNoAxeViolations(page);

  await page.setViewportSize({ width: 320, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(csp).toEqual([]);
});
