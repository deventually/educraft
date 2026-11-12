import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, watchCsp } from "./helpers";
import { storageStateOf } from "./users";

test.use({ storageState: storageStateOf("teacher") });

/**
 * How the group did (P36.1): two rounds of closed fill-ins, picked by keyboard. The chosen round
 * keeps focus and stays in view, the tables pass axe, and nothing scrolls sideways at 320px.
 * The fill-ins are written straight into the e2e database: closing a batch is P23.3's own test.
 */
test("pick a round in How the group did", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/utilities/rubric");
  await page.getByRole("button", { name: "Nieuwe rubric" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Naam van de rubric").fill("Groep (e2e)");
  await dialog.getByRole("button").last().click();
  await page.waitForURL(/\/utilities\/rubric\/[^/]+$/);
  const url = page.url();
  const id = url.split("/").pop() ?? "";

  const db = new Database("e2e/.data/e2e.db");
  const row = db
    .prepare("select user_id as u, data_json as d from rubrics where id = ?")
    .get(id) as {
    u: string;
    d: string;
  };
  const data = JSON.parse(row.d) as { criteria: { id: string; levels: { id: string }[] }[] };
  const insert = db.prepare(
    "insert into rubric_scores (id, user_id, rubric_id, month, levels_json) values (?, ?, ?, ?, ?)",
  );
  for (let i = 0; i < 10; i++) {
    const levels = data.criteria.map((c) => ({
      criterionId: c.id,
      levelId: c.levels[i % c.levels.length]?.id,
    }));
    insert.run(randomUUID(), row.u, id, i < 5 ? "2026-11" : "2026-09", JSON.stringify(levels));
  }
  db.close();

  // A short window, so the block sits below the fold and a scroll reset would hide it.
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.goto(url);
  const section = page.getByRole("region", { name: "Hoe ging de groep" });
  const rounds = section.getByRole("navigation", { name: "Ronde" });
  await expect(rounds.getByRole("link", { name: /november 2026/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(section.getByRole("table").first()).toBeVisible();
  await expectNoAxeViolations(page);

  const september = rounds.getByRole("link", { name: /september 2026/ });
  await september.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/round=2026-09/);
  await expect(september).toHaveAttribute("aria-current", "page");
  await expect(september).toBeFocused();
  await expect(september).toBeInViewport();

  await page.setViewportSize({ width: 320, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(csp).toEqual([]);
});
