import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { expect, test } from "@playwright/test";
import { watchCsp } from "./helpers";
import { storageStateOf } from "./users";

test.use({ storageState: storageStateOf("teacher") });

async function workbookOf(path: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(path) as unknown as ArrayBuffer);
  return wb;
}

/**
 * Excel from the tools without AI (P30.3): made in the browser, under the real CSP, and the
 * item analysis file holds statistics only, never a name from the pasted score list.
 */
test("the grade table downloads as Excel, made in the browser", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/utilities/grade-calculator");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download als Excel (.xlsx)" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("Cijfertabel 30 punten.xlsx");
  const wb = await workbookOf(await download.path());
  expect(wb.worksheets.map((w) => w.name)).toEqual(["Cijfertabel", "Cesuur"]);
  expect(wb.getWorksheet("Cijfertabel")?.getCell("B32").value).toBe(10);
  expect(csp).toEqual([]);
});

test("the item analysis downloads as Excel without the names", async ({ page }) => {
  const csp = watchCsp(page);
  await page.goto("/utilities/item-analysis");
  await page
    .getByLabel("Scorelijst")
    .fill("Naam\tV1\tV2\tV3\nAnna\t1\t1\t1\nBram\t1\t1\t0\nCem\t1\t0\t0\nDewi\t0\t0\t0");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download als Excel (.xlsx)" }).click(),
  ]);
  const wb = await workbookOf(await download.path());
  expect(wb.worksheets.map((w) => w.name)).toEqual(["Per vraag", "Samenvatting"]);
  const text = wb.worksheets
    .flatMap((w) => w.getSheetValues().flat())
    .map(String)
    .join(" ");
  for (const name of ["Anna", "Bram", "Cem", "Dewi"]) expect(text).not.toContain(name);
  expect(csp).toEqual([]);
});
