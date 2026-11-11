import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Blocks } from "~/components/export/ExportPreview";
import { parseMarkdown } from "~/lib/export/markdown";

describe("export preview: line breaks in a table cell", () => {
  it("shows each line of a cell on its own line", () => {
    const { container } = render(
      <Blocks blocks={parseMarkdown("| Voldoende |\n|---|\n| eerste<br>tweede |")} parent={1} />,
    );
    const cell = container.querySelector("td");
    expect(cell?.querySelectorAll("br")).toHaveLength(1);
    expect(cell?.textContent).toBe("eerstetweede");
    expect(container.textContent).not.toContain("<br>");
  });
});
