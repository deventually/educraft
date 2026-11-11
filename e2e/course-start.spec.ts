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

/**
 * Step 2: once the course has a learning outcome and no tests, the overview offers the test
 * programme; the form is reachable by keyboard, axe finds nothing and 320px does not scroll.
 */
test("a course with outcomes and no tests offers the test programme", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/courses");
  await page.getByLabel("Naam", { exact: true }).fill("Toetsprogramma (e2e)");
  await page.getByRole("button", { name: "Cursus aanmaken" }).click();
  await page.waitForURL(/\/courses\/[^/?]+$/);
  const url = page.url();

  await page.goto(`${url}?tab=outcomes`);
  await page.getByLabel("Leeruitkomst", { exact: true }).fill("De student ontwerpt een datamodel.");
  await page.getByRole("button", { name: "Leeruitkomst toevoegen" }).click();
  await expect(page.getByText("De student ontwerpt een datamodel.").first()).toBeVisible();

  await page.goto(url);
  const step = page.getByRole("region", { name: "Volgende stap: het toetsprogramma" });
  await expect(step).toBeVisible();
  const forms = step.getByLabel("Toetsvormen die jullie gebruiken");
  await forms.focus();
  await expect(forms).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(step.getByRole("button", { name: "Toetsprogramma voorstellen" })).toBeFocused();
  await expectNoAxeViolations(page);

  await page.setViewportSize({ width: 320, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(csp).toEqual([]);
});

/**
 * Step 3: once the course has outcomes and tests and no lessons, the overview offers the lesson
 * series; it asks for the weeks and sessions while the timetable has none, the form is reachable
 * by keyboard, axe finds nothing and 320px does not scroll.
 */
test("a course with outcomes and tests offers the lesson series", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/courses");
  await page.getByLabel("Naam", { exact: true }).fill("Lessenreeks (e2e)");
  await page.getByRole("button", { name: "Cursus aanmaken" }).click();
  await page.waitForURL(/\/courses\/[^/?]+$/);
  const url = page.url();

  await page.goto(`${url}?tab=outcomes`);
  await page.getByLabel("Leeruitkomst", { exact: true }).fill("De student ontwerpt een datamodel.");
  await page.getByRole("button", { name: "Leeruitkomst toevoegen" }).click();
  await expect(page.getByText("De student ontwerpt een datamodel.").first()).toBeVisible();

  await page.goto(`${url}?tab=plan`);
  const addTest = page.getByRole("button", { name: "Toets toevoegen" });
  const testForm = page.locator("form", { has: addTest });
  await testForm.getByLabel("Titel").fill("Beroepsproduct");
  await addTest.click();
  await expect(page.getByText("Beroepsproduct").first()).toBeVisible();

  await page.goto(url);
  const step = page.getByRole("region", { name: "Volgende stap: de lessenreeks" });
  await expect(step).toBeVisible();
  await expect(step.getByLabel("Aantal weken")).toBeVisible();
  await expect(step.getByLabel("Lesmomenten per week")).toBeVisible();
  const wishes = step.getByLabel("Wensen voor de planning");
  await wishes.focus();
  await expect(wishes).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(step.getByRole("button", { name: "Lessenreeks voorstellen" })).toBeFocused();
  await expectNoAxeViolations(page);

  await page.setViewportSize({ width: 320, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(csp).toEqual([]);
});
