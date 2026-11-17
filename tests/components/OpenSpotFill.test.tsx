import { describe, expect, it } from "vitest";
import { render as rtlRender, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { ChapterEditor } from "~/components/portfolio/ChapterEditor";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function render(node: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{node}</> }]);
  return rtlRender(<Stub initialEntries={["/"]} />);
}

const TEXT = "Ik had [aanvullen: hoeveel studenten] studenten. Daarna [aanvullen: wat ik deed].";
const REGION = { name: "Open plekken invullen" };

describe("ChapterEditor: filling open spots", () => {
  it("asks each open spot as a question of its own", async () => {
    const { container } = render(<ChapterEditor outcomeId="lu1" defaultValue={TEXT} />);
    const region = screen.getByRole("region", REGION);
    expect(within(region).getAllByRole("listitem")).toHaveLength(2);
    expect(within(region).getByLabelText("hoeveel studenten")).toBeInTheDocument();
    expect(within(region).getByLabelText("wat ik deed")).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("puts an answer in the text, then moves on to the next spot", async () => {
    render(<ChapterEditor outcomeId="lu1" defaultValue={TEXT} />);
    const region = screen.getByRole("region", REGION);
    await userEvent.type(within(region).getByLabelText("hoeveel studenten"), "24");
    await userEvent.click(
      within(region).getByRole("button", { name: "Invullen: hoeveel studenten" }),
    );
    expect(screen.getByLabelText("Je tekst bij deze leeruitkomst")).toHaveValue(
      "Ik had 24 studenten. Daarna [aanvullen: wat ik deed].",
    );
    expect(within(region).getAllByRole("listitem")).toHaveLength(1);
    expect(within(region).getByLabelText("wat ik deed")).toHaveFocus();
  });

  it("after the last spot, puts focus back on the chapter text", async () => {
    render(<ChapterEditor outcomeId="lu1" defaultValue="Ik had [aanvullen: hoeveel] studenten." />);
    await userEvent.type(screen.getByLabelText("hoeveel"), "24{Enter}");
    expect(screen.queryByRole("region", REGION)).toBeNull();
    expect(screen.getByLabelText("Je tekst bij deze leeruitkomst")).toHaveFocus();
  });

  it("does not post the answers: only the chapter text is saved", () => {
    render(<ChapterEditor outcomeId="lu1" defaultValue={TEXT} />);
    expect(
      within(screen.getByRole("region", REGION)).getByLabelText("wat ik deed"),
    ).not.toHaveAttribute("name");
  });

  it("shows no list without open spots", () => {
    render(<ChapterEditor outcomeId="lu1" defaultValue="Ik had 24 studenten." />);
    expect(screen.queryByRole("region", REGION)).toBeNull();
  });
});
