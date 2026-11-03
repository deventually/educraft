import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ToolSubtitle } from "~/components/ToolTitle";

const subtitle = {
  nl: "Forum Autograder (Community of Inquiry)",
  en: "Forum Autograder (Community of Inquiry)",
};

describe("ToolSubtitle", () => {
  it("renders the book name as small text under the heading", () => {
    render(
      <div>
        <h1>Forumbijdragen beoordelen</h1>
        <ToolSubtitle subtitle={subtitle} locale="nl" />
      </div>,
    );
    expect(screen.getByText("Forum Autograder (Community of Inquiry)")).toBeInTheDocument();
  });

  it("renders nothing without a subtitle", () => {
    const { container } = render(<ToolSubtitle locale="nl" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <main>
        <h1>Forumbijdragen beoordelen</h1>
        <ToolSubtitle subtitle={subtitle} locale="en" />
      </main>,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
