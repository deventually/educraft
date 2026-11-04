// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadOriginal } from "~/lib/documents/original";
import { safeNodesText } from "~/lib/documents/docxHtml";

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
