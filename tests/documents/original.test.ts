// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadOriginal } from "~/lib/documents/original";
import { safeNodesText } from "~/lib/documents/docxHtml";
import { highlightRects } from "~/lib/documents/pdfLayout";

const fixtureFile = (name: string, type: string) =>
  new File([readFileSync(resolve(__dirname, "../fixtures", name))], name, {
    type,
  });

/** The viewer's loader: everything happens on the File in memory, nothing is uploaded. */
describe("loadOriginal", () => {
  it("gives a PDF's text per page, so a hit can name its page", async () => {
    const doc = await loadOriginal(fixtureFile("sample.pdf", "application/pdf"));
    expect(doc.kind).toBe("pdf");
    if (doc.kind !== "pdf") return;
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[0]).toContain("STAGEFIXTUREPAGEONE");
    expect(doc.pages[1]).toContain("STAGEFIXTUREPAGETWO");
    expect(typeof doc.renderPage).toBe("function");
  });

  it("knows where each piece of text sits on a PDF page, so a hit can be marked there", async () => {
    const doc = await loadOriginal(fixtureFile("sample.pdf", "application/pdf"));
    if (doc.kind !== "pdf") throw new Error("expected a pdf");
    expect(doc.layouts.map((l) => l.text)).toEqual(doc.pages);
    const page = doc.layouts[0];
    const at = page.text.indexOf("STAGEFIXTUREPAGEONE");
    const rects = highlightRects(page, at, at + "STAGEFIXTUREPAGEONE".length);
    expect(rects.length).toBeGreaterThan(0);
    for (const r of rects) {
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.left + r.width).toBeLessThanOrEqual(1);
      expect(r.top + r.height).toBeLessThanOrEqual(1);
    }
    expect(page.aspect).toBeGreaterThan(0);
  });

  it("turns a DOCX into the safe node tree of the Word view", async () => {
    const doc = await loadOriginal(
      fixtureFile(
        "sample.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    );
    expect(doc.kind).toBe("docx");
    if (doc.kind !== "docx") return;
    expect(safeNodesText(doc.nodes)).toContain("STAGEFIXTUREDOCX");
  });

  it("refuses a file type it cannot show", async () => {
    await expect(loadOriginal(new File(["x"], "a.txt", { type: "text/plain" }))).rejects.toThrow();
  });
});
