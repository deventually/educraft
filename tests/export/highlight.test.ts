import { describe, expect, it } from "vitest";
import { CODE_COLORS, highlightCode } from "~/lib/export/highlight";

const colorOf = (lines: ReturnType<typeof highlightCode>, text: string) =>
  lines.flat().find((t) => t.text === text)?.color;

describe("highlightCode (code in Word and PDF)", () => {
  it("gives each line its tokens, with the colours of the language", () => {
    const lines = highlightCode("def groet(naam):\n    return 'hoi ' + naam", "python");
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.map((t) => t.text).join(""))).toEqual([
      "def groet(naam):",
      "    return 'hoi ' + naam",
    ]);
    expect(colorOf(lines, "def")).toBe(CODE_COLORS.keyword);
    expect(colorOf(lines, "'hoi '")).toBe(CODE_COLORS.string);
  });

  it("keeps blank lines", () => {
    expect(highlightCode("a = 1\n\nb = 2", "python")).toHaveLength(3);
  });

  it("leaves an unknown language as plain text, without failing", () => {
    const lines = highlightCode("graph TD; A-->B", "mermaid");
    expect(
      lines
        .flat()
        .map((t) => t.text)
        .join(""),
    ).toBe("graph TD; A-->B");
    expect(lines.flat().every((t) => !t.color)).toBe(true);
  });

  it("marks comments as italic", () => {
    const lines = highlightCode("# uitleg\nx = 1", "python");
    expect(lines[0][0]).toMatchObject({
      text: "# uitleg",
      color: CODE_COLORS.comment,
      italic: true,
    });
  });
});
