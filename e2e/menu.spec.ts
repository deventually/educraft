import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers";
import { storageStateOf } from "./users";

// The main menu with its submenus (plan "eenvoudiger beheer en navigatie"): a lay user finds
// programmes under Onderwijs, and an admin finds the setup list under Beheer.

test.describe("as a teacher", () => {
  test.use({ storageState: storageStateOf("teacher") });

  test("Onderwijs opens on a click and leads to the programmes", async ({ page }) => {
    await page.goto("/start");
    const nav = page.getByRole("navigation", { name: "Hoofdnavigatie" });
    await nav.getByRole("button", { name: "Onderwijs" }).click();
    await expectNoAxeViolations(page);
    await nav.getByRole("link", { name: "Opleidingen" }).click();
    await expect(page).toHaveURL(/\/programmes$/);
    await expect(nav.getByRole("button", { name: "Onderwijs" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

test.describe("as an admin", () => {
  test.use({ storageState: storageStateOf("admin") });

  test("Beheer opens on the overview with the setup list", async ({ page }) => {
    await page.goto("/start");
    const nav = page.getByRole("navigation", { name: "Hoofdnavigatie" });
    await nav.getByRole("button", { name: "Beheer" }).click();
    await expectNoAxeViolations(page);
    await nav.getByRole("link", { name: "Overzicht en inrichten" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("list", { name: "Inrichten" })).toBeVisible();
  });
});
