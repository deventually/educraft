import { describe, expect, it } from "vitest";
import { copyBlocksOf } from "~/lib/template/copyBlocks";

/**
 * Paste-ready texts in a result: the sub-headings under one named heading, each a block the
 * teacher copies on its own (e.g. a summary per report for OnStage).
 */
const result = [
  "## 1. Samenvattend oordeel (concept)",
  "Voldoende.",
  "## 4. Samenvatting voor OnStage",
  "### Stageverslag",
  "Je verslag is **helder** opgebouwd.",
  "",
  "- Werk de planning uit.",
  "### Onderzoeksverslag",
  "Je deelvragen zijn scherp.",
  "### Algemeen (beide verslagen)",
  "Let op APA 7.",
  "## 5. Aandachtspunten & beperkingen",
  "Geen presentatie gezien.",
].join("\n");

describe("copyBlocksOf", () => {
  it("gives each sub-heading under the heading as a block, without markdown emphasis", () => {
    expect(copyBlocksOf(result, "Samenvatting voor OnStage")).toEqual([
      { title: "Stageverslag", text: "Je verslag is helder opgebouwd.\n\n- Werk de planning uit." },
      { title: "Onderzoeksverslag", text: "Je deelvragen zijn scherp." },
      { title: "Algemeen (beide verslagen)", text: "Let op APA 7." },
    ]);
  });

  it("names a deeper block after its group, as OnStage has fields per report", () => {
    const nested = [
      "## Samenvatting voor OnStage",
      "### Stageverslag",
      "#### Algemene feedback",
      "Goed begin.",
      "#### SC1",
      "Indicatie: Voldoende. Je probleemstelling is afgebakend.",
      "### Onderzoeksverslag",
      "#### Algemene feedback",
      "Sterke methode.",
      "### Algemeen (beide verslagen)",
      "Let op APA 7.",
      "## Aandachtspunten",
    ].join("\n");
    expect(copyBlocksOf(nested, "Samenvatting voor OnStage")).toEqual([
      { title: "Stageverslag · Algemene feedback", text: "Goed begin." },
      {
        title: "Stageverslag · SC1",
        text: "Indicatie: Voldoende. Je probleemstelling is afgebakend.",
      },
      { title: "Onderzoeksverslag · Algemene feedback", text: "Sterke methode." },
      { title: "Algemeen (beide verslagen)", text: "Let op APA 7." },
    ]);
  });

  it("takes bold lines as sub-headings too, and ignores case and numbering", () => {
    const bold =
      "**5) samenvatting voor onstage**\n**Stageverslag**\nGoed werk.\n## Aandachtspunten\nx";
    expect(copyBlocksOf(bold, "Samenvatting voor OnStage")).toEqual([
      { title: "Stageverslag", text: "Goed werk." },
    ]);
  });

  it("without sub-headings, the whole section is one block under the heading's name", () => {
    const one = "## Samenvatting voor OnStage\nKort en goed.\n## Aandachtspunten\nx";
    expect(copyBlocksOf(one, "Samenvatting voor OnStage")).toEqual([
      { title: "Samenvatting voor OnStage", text: "Kort en goed." },
    ]);
  });

  it("stops at a horizontal rule and the closing sentence that follows it", () => {
    const end =
      "## Samenvatting voor OnStage\n### Stageverslag\nPrima.\n\n---\n\nDit is een concept.";
    expect(copyBlocksOf(end, "Samenvatting voor OnStage")).toEqual([
      { title: "Stageverslag", text: "Prima." },
    ]);
  });

  it("finds nothing without the heading, or with an empty section", () => {
    expect(copyBlocksOf("## Iets anders\nx", "Samenvatting voor OnStage")).toEqual([]);
    expect(
      copyBlocksOf("## Samenvatting voor OnStage\n\n## Volgende", "Samenvatting voor OnStage"),
    ).toEqual([]);
    expect(copyBlocksOf(result, "")).toEqual([]);
  });
});
