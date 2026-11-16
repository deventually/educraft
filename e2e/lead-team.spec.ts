import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers";
import { COLLEAGUE, USERS, storageStateOf } from "./users";

// Bastiaan, 2026-11-16 (BESLUIT-2026-11-16-6): a team lead chooses who joins the team, with
// search and ticks, and takes a plain member out after a confirmation.

test("a team lead ticks a colleague to add and takes them out again", async ({ browser }) => {
  const team = `Leidersteam ${Date.now()}`;

  // The admin makes the team and the e2e teacher its lead.
  const admin = await browser.newContext({ storageState: storageStateOf("admin") });
  const a = await admin.newPage();
  await a.goto("/admin/teams");
  await a.getByRole("button", { name: "Nieuw team" }).click();
  await a.getByLabel("Naam van het nieuwe team").fill(team);
  await a.getByRole("button", { name: "Team aanmaken" }).click();
  await expect(a.getByRole("heading", { level: 2, name: team })).toBeVisible();
  const teamUrl = new URL(a.url()).pathname.replace("/admin", "");
  await a.getByRole("button", { name: "Leden toevoegen" }).click();
  const pick = a.getByRole("dialog", { name: `Leden toevoegen aan ${team}` });
  await pick.getByRole("searchbox", { name: "Zoeken" }).fill(USERS.teacher.email);
  await pick.getByRole("checkbox", { name: new RegExp(USERS.teacher.name) }).check();
  await pick.getByRole("button", { name: "Toevoegen (1)" }).click();
  // Wait for the lead stand itself to be saved: the add above already showed "Opgeslagen".
  const leadSaved = a.waitForResponse(
    (r) => r.request().method() === "POST" && (r.request().postData() ?? "").includes("setLead"),
  );
  await a.getByRole("checkbox", { name: `Teamleider: ${USERS.teacher.name}` }).check();
  expect((await leadSaved).ok()).toBe(true);
  await admin.close();

  // The lead adds a colleague, then takes them out again. Admins are not in the list.
  const lead = await browser.newContext({ storageState: storageStateOf("teacher") });
  const page = await lead.newPage();
  await page.goto(teamUrl);
  await expect(page.getByRole("heading", { level: 1, name: team })).toBeVisible();
  await page.getByRole("button", { name: "Leden toevoegen" }).click();
  const add = page.getByRole("dialog", { name: `Leden toevoegen aan ${team}` });
  await add.getByRole("searchbox", { name: "Zoeken" }).fill("e2e");
  await expect(add.getByRole("checkbox", { name: new RegExp(USERS.admin.name) })).toHaveCount(0);
  await add.getByRole("checkbox", { name: new RegExp(COLLEAGUE.name) }).check();
  await expectNoAxeViolations(page);
  await add.getByRole("button", { name: "Toevoegen (1)" }).click();
  const row = page.getByRole("row", { name: new RegExp(COLLEAGUE.name) });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: `Weghalen: ${COLLEAGUE.name}` }).click();
  const confirm = page.getByRole("dialog", { name: new RegExp(`${COLLEAGUE.name} weghalen`) });
  await confirm.getByRole("button", { name: "Weghalen" }).click();
  await expect(row).toBeHidden();
  await lead.close();
});
