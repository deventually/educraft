import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { EvidenceFields, EvidenceRow } from "~/components/portfolio/EvidenceRow";
import { DossierExport, PartExport } from "~/components/portfolio/DossierExport";
import { readinessCheck } from "~/lib/portfolio/readiness";
import { sampleDossier, C1, EV, LU } from "../portfolio/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function at(node: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{node}</> }]);
  return render(<Stub initialEntries={["/"]} />);
}

const d = sampleDossier();
const outcome = d.framework.outcomes[0]!;

describe("EvidenceFields", () => {
  it("fills title, kind and the linked criteria from the item", async () => {
    const { container } = at(
      <form aria-label="Bewijs">
        <EvidenceFields prefix="ev" criteria={outcome.criteria} item={d.evidence[0]} />
      </form>,
    );
    expect(screen.getByLabelText("Titel")).toHaveValue("Feedback werkplekbegeleider");
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.find((b) => (b as HTMLInputElement).value === C1)).toBeChecked();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("EvidenceRow", () => {
  it("saves and removes the item", async () => {
    const { container } = at(
      <ul>
        <EvidenceRow
          item={d.evidence[0]!}
          outcomeId={LU}
          criteria={outcome.criteria}
          courses={{}}
        />
      </ul>,
    );
    const save = screen.getByRole("button", { name: "Bewijs opslaan", hidden: true });
    const form = save.closest("form") as HTMLFormElement;
    expect(form.querySelector('input[name="evidenceId"]')).toHaveValue(EV);
    expect(
      screen.getByRole("button", {
        name: "Bewijs verwijderen: Feedback werkplekbegeleider",
        hidden: true,
      }),
    ).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("DossierExport", () => {
  it("offers the final Word and PDF without an open spot", async () => {
    const { container } = at(
      <DossierExport
        dossierId="d1"
        readiness={readinessCheck(d)}
        open={0}
        aiUsed={false}
        aiRequired={false}
      />,
    );
    const form = screen.getByRole("form", { name: "Exporteren" });
    expect(
      within(form).getByRole("button", { name: "Download als Word-bestand" }),
    ).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("PartExport", () => {
  it("links one outcome as a draft while it has an open spot", async () => {
    const { container } = at(
      <PartExport dossierId="d1" outcomeId="o1" label="LU1 Doceren" open={1} ai={false} />,
    );
    const group = screen.getByRole("group", { name: "LU1 Doceren apart inleveren" });
    expect(within(group).getByRole("link", { name: "Word (concept)" })).toHaveAttribute(
      "href",
      "/portfolio/d1/export?lu=o1&draft=1",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
