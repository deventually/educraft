import { describe, expect, it } from "vitest";
import { toExportDoc } from "~/lib/export/doc";

describe("toExportDoc (P30.1)", () => {
  it("reads each section's markdown into blocks, in order", () => {
    const doc = toExportDoc({
      title: "Toetsvragen",
      locale: "nl",
      sections: [
        {
          heading: "1. Toetsmatrijs",
          kind: "table",
          markdown: "| Doel | Vragen |\n|---|---|\n| LU1 | 3 |",
        },
        { heading: "2. Toetsvragen", kind: "test-items", markdown: "## Vraag 1\n\n- A\n- B" },
      ],
    });
    expect(doc.title).toBe("Toetsvragen");
    expect(doc.locale).toBe("nl");
    expect(doc.sections.map((s) => s.heading)).toEqual(["1. Toetsmatrijs", "2. Toetsvragen"]);
    expect(doc.sections[0].kind).toBe("table");
    expect(doc.sections[0].blocks[0]).toMatchObject({ type: "table" });
    expect(doc.sections[1].blocks.map((b) => b.type)).toEqual(["heading", "list"]);
  });

  it("leaves out an empty step", () => {
    const doc = toExportDoc({
      title: "Lesopzet",
      locale: "en",
      sections: [
        { heading: null, markdown: "  \n " },
        { heading: null, markdown: "Een alinea." },
      ],
    });
    expect(doc.sections).toHaveLength(1);
  });

  it("treats a section without a kind as a document", () => {
    const doc = toExportDoc({
      title: "X",
      locale: "nl",
      sections: [{ heading: null, markdown: "a" }],
    });
    expect(doc.sections[0].kind).toBe("document");
  });

  it("keeps each step's own markdown for the Markdown file", () => {
    const doc = toExportDoc({
      title: "X",
      locale: "nl",
      sections: [{ heading: null, markdown: " a\n" }],
    });
    expect(doc.sections[0].markdown).toBe("a");
  });
});
