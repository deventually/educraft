import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers";
import { storageStateOf } from "./users";

// From scratch, as Bastiaan asked (BESLUIT-2026-11-16-4): an admin makes a faculty, a
// programme in it, a team, and links the team to the programme. Every add and remove works the
// same: "… toevoegen" opens a dialog with ticks, Weghalen asks first.

test.use({ storageState: storageStateOf("admin") });

test("an admin sets up a faculty, a programme in it and a team, and links them", async ({
  page,
}) => {
  const stamp = Date.now().toString(36);
  const faculty = `Faculteit E2E ${stamp}`;
  const programme = `Opleiding E2E ${stamp}`;
  const team = `Team E2E ${stamp}`;

  await page.goto("/admin/organisation");
  await page.locator("#division-new").fill(faculty);
  await page.locator("#division-new").press("Enter");
  const block = page.getByRole("region", { name: faculty });
  await expect(block).toBeVisible();

  await block.getByRole("button", { name: "Nieuwe opleiding" }).click();
  const create = page.getByRole("dialog", { name: `Nieuwe opleiding in ${faculty}` });
  await expectNoAxeViolations(page);
  await create.getByLabel("Naam").fill(programme);
  await create.getByRole("button", { name: "Opleiding aanmaken" }).click();
  await expect(page.getByRole("heading", { level: 1, name: programme })).toBeVisible();
  await expect(page.getByText(/nog geen team/)).toBeVisible();
  const programmeUrl = page.url();

  await page.goto("/admin/teams");
  await page.getByRole("button", { name: "Nieuw team" }).click();
  await page.getByLabel("Naam van het nieuwe team").fill(team);
  // Creating a team opens its page.
  await page.getByRole("button", { name: "Team aanmaken" }).click();
  await expect(page.getByRole("heading", { level: 2, name: team })).toBeVisible();

  const programmes = page.getByRole("region", { name: "Opleidingen" });
  await programmes.getByRole("button", { name: "Opleiding toevoegen" }).click();
  const add = page.getByRole("dialog", { name: `Opleidingen toevoegen aan ${team}` });
  await add.getByRole("searchbox", { name: "Zoeken" }).fill(stamp);
  await add.getByRole("checkbox", { name: new RegExp(programme) }).check();
  await expectNoAxeViolations(page);
  await add.getByRole("button", { name: "Toevoegen (1)" }).click();
  await expect(programmes.getByRole("link", { name: programme })).toBeVisible();

  await page.goto(programmeUrl);
  // Plan step 4: the faculty on top, and the teams under the Gegevens tab.
  await expect(page.getByText(new RegExp(faculty))).toBeVisible();
  await page.getByRole("tab", { name: "Gegevens" }).click();
  const teams = page.getByRole("region", { name: "Teams" });
  await expect(teams.getByText(team)).toBeVisible();
  await teams.getByRole("button", { name: `Weghalen: ${team}` }).click();
  const confirm = page.getByRole("dialog", { name: `${team} weghalen uit ${programme}?` });
  await expect(confirm.getByText(/Het team blijft bestaan/)).toBeVisible();
  await confirm.getByRole("button", { name: "Annuleren" }).click();
  await expect(teams.getByRole("button", { name: `Weghalen: ${team}` })).toBeFocused();
});

test("Leerlijnen opens from the Onderwijs menu", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "Onderwijs" }).click();
  await page.getByRole("link", { name: /Leerlijnen/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Leerlijnen" })).toBeVisible();
  await expectNoAxeViolations(page);
});
