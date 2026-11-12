import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, watchCsp } from "./helpers";
import { E2E_DOSSIER } from "./seedDossier";
import { storageStateOf } from "./users";

test.use({ storageState: storageStateOf("admin") });

const file = (name: string, text: string) => ({
  name,
  mimeType: "text/plain",
  buffer: Buffer.from(text),
});

/**
 * Evidence in one go: two files with the name check per file, a proposal per file (without a
 * model in the browser tests every row falls back to "Controleren"), then one list the teacher
 * fills in and confirms by keyboard. axe finds nothing and nothing scrolls sideways at 320px.
 */
test("adds several files as evidence in one list, by keyboard", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/portfolio");
  await page.getByRole("link", { name: E2E_DOSSIER }).first().click();
  await page.waitForURL(/\/portfolio\/[^/?]+$/);
  await page.getByRole("link", { name: "Bewijs in één keer toevoegen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bewijs in één keer toevoegen");

  await page.getByLabel("Namen van studenten om te vervangen (één per regel)").fill("Noor Jansen");
  await page
    .getByLabel("Kies bestanden")
    .setInputFiles([
      file("lesplan.txt", "Lesplan voor 2B. Noor Jansen hielp mee."),
      file("notities.txt", "Losse notities."),
    ]);
  const chosen = page.getByRole("list", { name: "Gekozen bestanden" });
  await expect(chosen.getByRole("listitem").first()).toContainText("Noor Jansen → [STUDENT]");
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Stel voor waar ze horen" }).click();
  const row = page.getByRole("group", { name: "lesplan.txt" });
  await expect(row).toContainText("Controleren");

  // Fill in the first row by keyboard only.
  const add = row.getByRole("checkbox", { name: "Toevoegen" });
  await add.focus();
  await page.keyboard.press("Space");
  await expect(add).toBeChecked();
  await row.getByLabel("Leeruitkomst").selectOption({ label: "LU1 Doceren" });
  const criterion = row.getByRole("checkbox", { name: /^1\. / });
  await criterion.focus();
  await page.keyboard.press("Space");
  await expect(criterion).toBeChecked();
  await expectNoAxeViolations(page);

  await page.setViewportSize({ width: 320, height: 800 });
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(sideways).toBe(false);

  const submit = page.getByRole("button", { name: "Voeg 1 stuk toe" });
  await submit.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("1 stuk toegevoegd.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Gekozen bestanden" })).toHaveCount(0);
  // The button is gone with the list: focus goes to the page's heading, not to nowhere.
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  expect(csp).toEqual([]);
});
