import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { DossierBar } from "~/components/portfolio/DossierBar";
import { ToolHints } from "~/components/portfolio/ToolHints";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function at(node: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{node}</> }]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("DossierBar (P27.2)", () => {
  it("names the criterion and links back to it", async () => {
    const { container } = at(
      <DossierBar
        dossierId="d1"
        dossierName="Mijn BDB"
        outcomeId="o1"
        criterionId="k1"
        criterionText="Je ontwerpt een toets"
      />,
    );
    expect(screen.getByText(/Voor je dossier/)).toBeInTheDocument();
    expect(screen.getByText("Je ontwerpt een toets")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Terug naar Mijn BDB/ })).toHaveAttribute(
      "href",
      "/portfolio/d1/outcome/o1",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("ToolHints from a criterion (P27.2)", () => {
  it("opens the tool with the dossier and the criterion", () => {
    at(
      <ToolHints
        hints={[{ slug: "authentic-assessment", name: "Authentieke toets" }]}
        step="evidence"
        from={{ dossierId: "d1", criterionId: "k1" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Open Authentieke toets" })).toHaveAttribute(
      "href",
      "/tools/authentic-assessment?dossier=d1&criterion=k1",
    );
  });

  it("opens the plain tool without a criterion", () => {
    at(
      <ToolHints
        hints={[{ slug: "authentic-assessment", name: "Authentieke toets" }]}
        step="evidence"
      />,
    );
    expect(screen.getByRole("link", { name: "Open Authentieke toets" })).toHaveAttribute(
      "href",
      "/tools/authentic-assessment",
    );
  });
});
