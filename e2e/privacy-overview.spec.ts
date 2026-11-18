import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, watchCsp } from "./helpers";
import { storageStateOf } from "./users";

test.use({ storageState: storageStateOf("teacher") });

/**
 * The overview before sending (anonymiseerpoort step 4), on the course import: it opens on
 * "Voorstel maken" with focus on its heading, works by keyboard (Niet vervangen, a word added
 * with Enter), axe finds nothing, 320px does not scroll sideways, and Terug returns focus.
 */
test("the overview before sending works by keyboard and reflows", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/courses");
  await page.getByRole("button", { name: "Nieuwe cursus" }).first().click();
  await page.getByLabel("Naam", { exact: true }).fill("Overzicht (e2e)");
  await page.getByRole("button", { name: "Cursus aanmaken" }).click();
  await page.waitForURL(/\/courses\/[^/?]+$/);

  await page
    .getByLabel("Tekst van het document")
    .fill("Leeruitkomst 1: je schrijft SQL. Vragen: docent-overzicht@school.nl");
  const extract = page.getByRole("button", { name: "Voorstel maken" });
  await extract.focus();
  await page.keyboard.press("Enter");

  const overview = page.getByRole("region", { name: "Kijk na wat er naar de AI gaat" });
  await expect(overview).toBeVisible();
  await expect(
    overview.getByRole("heading", { name: "Kijk na wat er naar de AI gaat" }),
  ).toBeFocused();
  await expect(overview.getByText("docent-overzicht@school.nl (1×)")).toBeVisible();

  await page.keyboard.press("Tab");
  const keep = overview.getByRole("button", { name: "Niet vervangen: docent-overzicht@school.nl" });
  await expect(keep).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(overview.getByText("Er wordt niets vervangen.")).toBeVisible();

  await overview.getByLabel("Nog een woord vervangen").fill("SQL");
  await page.keyboard.press("Enter");
  await expect(overview.getByText("SQL (1×)")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.setViewportSize({ width: 320, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await overview.getByRole("button", { name: "Terug" }).click();
  await expect(overview).toBeHidden();
  await expect(extract).toBeFocused();
  expect(csp).toEqual([]);
});
