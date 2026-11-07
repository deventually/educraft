import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { toExportDoc } from "~/lib/export/doc";
import { exportDocToDocx } from "~/lib/export/docx";

async function documentXml(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("no word/document.xml");
  return file.async("string");
}

const sample = toExportDoc({
  title: "Toetsvragen",
  locale: "nl",
  sections: [
    {
      heading: "1. Toetsmatrijs",
      markdown: "## Overzicht\n\n| Doel | Vragen |\n|---|---|\n| LU1 | 3 |",
    },
    { heading: "2. Toetsvragen", markdown: "1. **Wat** is een cel?\n2. Noem twee organellen." },
  ],
});

describe("exportDocToDocx (P30.1)", () => {
  it("makes a Word file that opens, with the title as Title style", async () => {
    const xml = await documentXml(await exportDocToDocx(sample));
    expect(xml).toMatch(/<w:pStyle w:val="Title"\/>[\s\S]*?Toetsvragen/);
  });

  it("puts each step under a Heading 1 and its own headings one deeper", async () => {
    const xml = await documentXml(await exportDocToDocx(sample));
    expect(xml).toMatch(/<w:pStyle w:val="Heading1"\/>[\s\S]*?1\. Toetsmatrijs/);
    expect(xml).toMatch(/<w:pStyle w:val="Heading2"\/>[\s\S]*?Overzicht/);
  });

  it("keeps tables with a repeating header row, and bold text", async () => {
    const xml = await documentXml(await exportDocToDocx(sample));
    expect(xml).toContain("<w:tblHeader/>");
    expect(xml).toMatch(/<w:b\/>[\s\S]*?Wat/);
  });

  it("starts a single-step result's own headings at Heading 1", async () => {
    const doc = toExportDoc({
      title: "Lesopzet",
      locale: "en",
      sections: [{ heading: null, markdown: "## Lesson flow\n\nText." }],
    });
    const xml = await documentXml(await exportDocToDocx(doc));
    expect(xml).toMatch(/<w:pStyle w:val="Heading1"\/>[\s\S]*?Lesson flow/);
  });

  it("sets the document language", async () => {
    const zip = await JSZip.loadAsync(await exportDocToDocx(sample));
    const styles = await zip.file("word/styles.xml")?.async("string");
    expect(styles).toContain('w:val="nl-NL"');
  });
});
