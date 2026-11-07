import { describe, expect, it } from "vitest";
import { toExportDoc } from "~/lib/export/doc";
import { exportDocToMarkdown } from "~/lib/export/md";

describe("exportDocToMarkdown (P30.2)", () => {
  it("writes the title, each step's name and the result as written", () => {
    const doc = toExportDoc({
      title: "Toetsvragen maken",
      locale: "nl",
      sections: [
        { heading: "1. Toetsmatrijs", markdown: "| Doel | Vragen |\n|---|---|\n| LU1 | 3 |" },
        { heading: "2. Toetsvragen", markdown: "1. Wat is een cel?" },
      ],
    });
    expect(exportDocToMarkdown(doc)).toBe(
      "# Toetsvragen maken\n\n## 1. Toetsmatrijs\n\n| Doel | Vragen |\n|---|---|\n| LU1 | 3 |\n\n## 2. Toetsvragen\n\n1. Wat is een cel?\n",
    );
  });

  it("leaves a single result under the title only", () => {
    const doc = toExportDoc({
      title: "Les",
      locale: "nl",
      sections: [{ heading: null, markdown: "Tekst." }],
    });
    expect(exportDocToMarkdown(doc)).toBe("# Les\n\nTekst.\n");
  });
});
