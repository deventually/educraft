import { expect, type Page, test } from "@playwright/test";
import { storageStateOf } from "./users";

/**
 * Fields on one line stay on one line (Bastiaan, 2026-11-16): a long label, or a hint under one
 * field, never pushes that field's input below its neighbours, and a button on the same line
 * lines up with the inputs. We make one label per row long, as Dutch labels often are, and
 * measure every row of side-by-side fields on the page.
 */

const LONG_LABEL =
  "Een heel lang label dat over meerdere regels doorloopt, zoals Nederlandse labels vaak doen";

/** Make the first label of every row of side-by-side fields long, then list misaligned pairs. */
async function misalignedRows(page: Page): Promise<string[]> {
  return page.evaluate((longLabel) => {
    const CONTROL =
      "input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea";
    const visible = (el: Element) => el.getBoundingClientRect().height > 0;
    const rows = [...document.querySelectorAll("main *")].filter((el) => {
      const display = getComputedStyle(el).display;
      return (display === "grid" || display === "flex") && el.children.length > 1;
    });
    // A cell is a field (a label above an input) or a button next to fields.
    type Cell = { cell: Element; target: Element; label?: Element };
    const cellsOf = (row: Element): Cell[] =>
      [...row.children].filter(visible).flatMap((cell): Cell[] => {
        if (cell.matches("button")) return [{ cell, target: cell }];
        const label = cell.querySelector(":scope > label[for], :scope > * > label[for]");
        const control = cell.querySelector(CONTROL);
        return label && control && visible(control) ? [{ cell, target: control, label }] : [];
      });

    for (const row of rows) {
      const first = cellsOf(row).find((c) => c.label);
      if (first?.label) first.label.textContent = longLabel;
    }

    const problems: string[] = [];
    for (const row of rows) {
      const cells = cellsOf(row);
      cells.forEach((a, i) => {
        for (const b of cells.slice(i + 1)) {
          const ra = a.cell.getBoundingClientRect();
          const rb = b.cell.getBoundingClientRect();
          const sameLine =
            ra.top < rb.bottom && rb.top < ra.bottom && Math.abs(ra.left - rb.left) > 1;
          if (!sameLine) continue;
          const off = Math.abs(
            a.target.getBoundingClientRect().bottom - b.target.getBoundingClientRect().bottom,
          );
          if (off > 2) {
            const name = (el: Element) => el.id || el.getAttribute("name") || el.tagName;
            problems.push(`${name(a.target)} / ${name(b.target)}: ${off}px`);
          }
        }
      });
    }
    return problems;
  }, LONG_LABEL);
}

const PAGES = [
  { path: "/admin/organisation", as: "admin" },
  { path: "/admin/announcements", as: "admin" },
  { path: "/admin/users", as: "admin" },
  { path: "/courses", as: "teacher" },
] as const;

for (const { path, as } of PAGES) {
  for (const width of [1280, 390]) {
    test.describe(() => {
      test.use({ storageState: storageStateOf(as), viewport: { width, height: 900 } });

      test(`${path} at ${width}px: fields and buttons on one line stay aligned`, async ({
        page,
      }) => {
        await page.goto(path);
        await page.locator("main").first().waitFor();
        expect(await misalignedRows(page)).toEqual([]);
      });
    });
  }
}
