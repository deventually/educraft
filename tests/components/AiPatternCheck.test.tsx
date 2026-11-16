import { describe, expect, it } from "vitest";
import { render as rtlRender, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { AiPatternCheck } from "~/components/portfolio/AiPatternCheck";
import { ChapterEditor } from "~/components/portfolio/ChapterEditor";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function render(node: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{node}</> }]);
  return rtlRender(<Stub initialEntries={["/"]} />);
}

describe("AiPatternCheck", () => {
  it("shows nothing for a text without patterns", () => {
    const { container } = render(<AiPatternCheck text="Ik gaf 24 studenten een casus." />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names each kind of pattern once, with the phrases and how to rewrite them", async () => {
    const { container } = render(
      <AiPatternCheck text="Een cruciale les — echt waardevol. Kortom, het werkte. Weer cruciale stof." />,
    );
    const region = screen.getByRole("region", { name: "Klinkt dit als jij?" });
    const items = within(region).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Holle woorden");
    expect(items[0]).toHaveTextContent("“cruciale”, “waardevol”");
    expect(items[1]).toHaveTextContent("Gedachtestreepje");
    expect(items[2]).toHaveTextContent("Samenvattende slotzin");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("ChapterEditor", () => {
  it("checks the chapter for patterns while the teacher types", async () => {
    const { container } = render(<ChapterEditor outcomeId="lu1" defaultValue="Ik gaf les." />);
    expect(screen.queryByRole("region", { name: "Klinkt dit als jij?" })).toBeNull();
    await userEvent.type(
      screen.getByLabelText("Je tekst bij deze leeruitkomst"),
      " Dit was cruciaal.",
    );
    expect(screen.getByRole("region", { name: "Klinkt dit als jij?" })).toHaveTextContent(
      "“cruciaal”",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
