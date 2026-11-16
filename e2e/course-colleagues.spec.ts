import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers";
import { COLLEAGUE, USERS, storageStateOf } from "./users";

// Plan "eenvoudiger beheer en navigatie", step 6: on a course, Collega toevoegen and Team
// toevoegen add with search and ticks, and Weghalen asks first.

test("a teacher adds a colleague and a whole team to a course, and takes the colleague off", async ({
  browser,
}) => {
  const stamp = Date.now().toString(36);
  const team = `Moduleteam ${stamp}`;
  const course = `Samen ${stamp}`;

  // The admin makes a team with the e2e teacher and a colleague in it.
  const admin = await browser.newContext({ storageState: storageStateOf("admin") });
  const a = await admin.newPage();
  await a.goto("/teams");
  await a.getByRole("button", { name: "Nieuw team" }).click();
  await a.getByRole("dialog").getByLabel("Naam van het nieuwe team").fill(team);
  await a.getByRole("dialog").getByRole("button", { name: "Team aanmaken" }).click();
  await expect(a.getByRole("heading", { level: 1, name: team })).toBeVisible();
  await a.getByRole("button", { name: "Leden toevoegen" }).click();
  const pick = a.getByRole("dialog", { name: `Leden toevoegen aan ${team}` });
  await pick.getByRole("searchbox", { name: "Zoeken" }).fill("e2e.test");
  await pick.getByRole("checkbox", { name: new RegExp(USERS.teacher.name) }).check();
  await pick.getByRole("checkbox", { name: new RegExp(COLLEAGUE.name) }).check();
  await pick.getByRole("button", { name: "Toevoegen (2)" }).click();
  await expect(a.getByRole("row", { name: new RegExp(COLLEAGUE.name) })).toBeVisible();
  await admin.close();

  // The teacher makes a course with Nieuwe cursus and works on it together.
  const teacher = await browser.newContext({ storageState: storageStateOf("teacher") });
  const page = await teacher.newPage();
  await page.goto("/courses");
  await page.getByRole("button", { name: "Nieuwe cursus" }).first().click();
  await page.getByRole("dialog").getByLabel("Naam", { exact: true }).fill(course);
  await page.getByRole("dialog").getByRole("button", { name: "Cursus aanmaken" }).click();
  await page.waitForURL(/\/courses\/[^/?]+$/);
  await page.goto(`${new URL(page.url()).pathname}?tab=documents`);

  const colleagues = page.getByRole("region", { name: "Collega's die meewerken" });
  await colleagues.getByRole("button", { name: "Collega toevoegen" }).click();
  const add = page.getByRole("dialog", { name: "Collega's toevoegen" });
  await add.getByRole("checkbox", { name: COLLEAGUE.name }).check();
  await expectNoAxeViolations(page);
  await add.getByRole("button", { name: "Toevoegen (1)" }).click();
  await expect(colleagues.getByText(COLLEAGUE.name)).toBeVisible();

  const teams = page.getByRole("region", { name: "Teams die meewerken" });
  await teams.getByRole("button", { name: "Team toevoegen" }).click();
  const addTeam = page.getByRole("dialog", { name: "Teams toevoegen" });
  await addTeam.getByRole("checkbox", { name: team }).check();
  await addTeam.getByRole("button", { name: "Toevoegen (1)" }).click();
  await expect(teams.getByText(team)).toBeVisible();

  await colleagues.getByRole("button", { name: `Weghalen: ${COLLEAGUE.name}` }).click();
  const confirm = page.getByRole("dialog", {
    name: `${COLLEAGUE.name} weghalen uit deze cursus?`,
  });
  await expect(confirm.getByText(/De cursus blijft zoals hij is/)).toBeVisible();
  await confirm.getByRole("button", { name: "Weghalen" }).click();
  await expect(colleagues.getByText(COLLEAGUE.name)).toBeHidden();
  await teacher.close();
});
