import { describe, expect, it } from "vitest";
import { parseMarkdown } from "~/lib/portfolio/markdown";

describe("parseMarkdown (chapter → Word blocks)", () => {
  it("reads headings, paragraphs and inline emphasis", () => {
    const blocks = parseMarkdown(
      "# Inleiding\n\nMijn **eerste** les was *spannend*.\nTweede regel.",
    );
    expect(blocks[0]).toEqual({ type: "heading", level: 1, runs: [{ text: "Inleiding" }] });
    expect(blocks[1]).toEqual({
      type: "paragraph",
      runs: [
        { text: "Mijn " },
        { text: "eerste", bold: true },
        { text: " les was " },
        { text: "spannend", italic: true },
        { text: ". Tweede regel." },
      ],
    });
  });

  it("reads bullet and numbered lists", () => {
    const blocks = parseMarkdown("- een\n- twee\n\n1. eerst\n2. dan");
    expect(blocks).toEqual([
      { type: "list", ordered: false, items: [[{ text: "een" }], [{ text: "twee" }]] },
      { type: "list", ordered: true, items: [[{ text: "eerst" }], [{ text: "dan" }]] },
    ]);
  });

  it("reads a table with its header row", () => {
    const blocks = parseMarkdown("| Criterium | Bewijs |\n|---|:---:|\n| C1 | **Video** |");
    expect(blocks).toEqual([
      {
        type: "table",
        header: [[{ text: "Criterium" }], [{ text: "Bewijs" }]],
        rows: [[[{ text: "C1" }], [{ text: "Video", bold: true }]]],
      },
    ]);
  });

  it("keeps a pipe line without a separator as a paragraph", () => {
    expect(parseMarkdown("a | b")).toEqual([{ type: "paragraph", runs: [{ text: "a | b" }] }]);
  });

  it("caps heading depth and ignores empty input", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("###### Diep")[0]).toMatchObject({ type: "heading", level: 6 });
    expect(parseMarkdown("####### te diep")[0]).toMatchObject({ type: "paragraph" });
  });

  it("leaves unmatched markers as text", () => {
    expect(parseMarkdown("2 * 3 = 6")).toEqual([
      { type: "paragraph", runs: [{ text: "2 * 3 = 6" }] },
    ]);
  });
});
