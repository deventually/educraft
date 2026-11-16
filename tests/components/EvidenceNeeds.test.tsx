import { describe, expect, it } from "vitest";
import { render as rtlRender, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { EvidenceNeeds } from "~/components/portfolio/EvidenceNeeds";
import { C1, C2 } from "../portfolio/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function render(node: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{node}</> }]);
  return rtlRender(<Stub initialEntries={["/"]} />);
}

const criteria = [
  { id: C1, text: "Heldere structuur." },
  { id: C2, text: "Sluit aan bij de beginsituatie." },
];

describe("EvidenceNeeds", () => {
  it("lists missing required evidence and criteria without evidence, with a way to add it", async () => {
    const { container } = render(
      <EvidenceNeeds
        criteria={criteria}
        evidence={[{ criterionIds: [C1] }]}
        required={[
          { line: "Video van de les", linked: [] },
          { line: "Lesvoorbereiding", linked: [{ id: "e1", title: "Lesplan" }] },
        ]}
        href="/portfolio/d/outcome/lu?tab=evidence"
      />,
    );
    const region = screen.getByRole("region", { name: "Nog nodig als bewijs" });
    const items = within(region).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "Video van de les",
      "Criterium 2: Sluit aan bij de beginsituatie.",
    ]);
    expect(within(region).getByRole("link", { name: "Bewijs toevoegen" })).toHaveAttribute(
      "href",
      "/portfolio/d/outcome/lu?tab=evidence",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows nothing when every line and criterion has evidence", () => {
    const { container } = render(
      <EvidenceNeeds
        criteria={criteria}
        evidence={[{ criterionIds: [C1, C2] }]}
        required={[{ line: "Video", linked: [], guess: { id: "e", title: "Opname" } }]}
        href="/x"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
