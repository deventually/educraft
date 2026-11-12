import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, watchCsp } from "./helpers";
import { E2E_DOSSIER } from "./seedDossier";
import { storageStateOf } from "./users";

test.use({ storageState: storageStateOf("admin") });

/**
 * Guided writing (BDB/BKE plan, step 6) on the chapter tab: every part with its questions,
 * answer fields reachable by keyboard and labelled by their question, axe finds nothing, and
 * nothing scrolls sideways at 320px. Saving the chapter keeps an answer typed beside it.
 */
test("the chapter tab guides writing part by part, by keyboard", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/portfolio");
  await page.getByRole("link", { name: E2E_DOSSIER }).first().click();
  await page.waitForURL(/\/portfolio\/[^/?]+$/);
  await page.goto(`${new URL(page.url()).pathname}/outcome/e2e-lu1?tab=chapter`);

  // What the anchored lesson's course already says, read only, with the way to the course.
  const facts = page.getByRole("region", { name: "Uit je cursus" });
  await expect(facts.getByText("De student berekent een dosis met breuken.")).toBeVisible();
  await expect(
    facts.getByRole("link", { name: "Klopt iets niet meer? Pas het aan in Rekenen (e2e)" }),
  ).toBeVisible();

  const guided = page.getByRole("region", { name: "Schrijf per onderdeel" });
  await expect(guided.getByRole("heading", { name: "Beginsituatie" })).toBeVisible();
  await expect(
    guided.getByRole("button", { name: "Stel me vragen over Opbouw van de les" }),
  ).toBeVisible();
  await expect(
    guided.getByRole("button", { name: "Maak er een alinea van: Beginsituatie" }),
  ).toBeVisible();
  // The whole chapter on one screen: every question at once, the whole chapter in one go.
  await expect(guided.getByRole("button", { name: "Stel alle vragen" })).toBeVisible();
  await expect(guided.getByRole("button", { name: "Stel het hoofdstuk op" })).toBeVisible();

  const first = page.getByRole("textbox", { name: "Welke groep had je, en wat konden ze al?" });
  await expect(first).toHaveValue("Een tweedejaars klas.");
  await first.focus();
  await page.keyboard.press("Tab");
  const second = page.getByRole("textbox", { name: "Hoe bracht je dat in kaart?" });
  await expect(second).toBeFocused();
  await page.keyboard.type("Met de toets van week 1.");

  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Hoofdstuk opslaan" }).click();
  await expect(page.getByText("Opgeslagen.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Hoe bracht je dat in kaart?" })).toHaveValue(
    "Met de toets van week 1.",
  );

  await page.setViewportSize({ width: 320, height: 800 });
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(sideways).toBe(false);
  expect(csp).toEqual([]);
});
