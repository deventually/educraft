import { describe, it, expect } from "vitest";
import type { ComponentType } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import PortfolioList from "~/routes/portfolio._index";
import PortfolioOverview from "~/routes/portfolio.$id";
import PortfolioFramework from "~/routes/portfolio.$id.framework";
import PortfolioOutcome from "~/routes/portfolio.$id.outcome.$outcomeId";
import { outcomeProgress, nextStep, requirementFindings } from "~/lib/portfolio/progress";
import { emptyDossier } from "~/lib/portfolio/schema";
import { sampleDossier, LU, C1, C2, EV } from "../portfolio/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

// createRoutesStub doesn't inject loaderData in library mode; pass it through a wrapper.
// biome-ignore lint/suspicious/noExplicitAny: route components take framework-typed props
function renderRoute(Component: ComponentType<any>, loaderData: unknown) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <Component loaderData={loaderData} /> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

const ID = "dossier-1";

function overviewData(d = sampleDossier()) {
  return {
    id: ID,
    name: "Mijn BDB",
    framework: d.framework,
    progress: outcomeProgress(d),
    findings: requirementFindings(d),
    next: nextStep(d),
    references: d.references,
  };
}

function outcomeData(d = sampleDossier()) {
  const outcome = d.framework.outcomes[0];
  return {
    id: ID,
    name: "Mijn BDB",
    outcome,
    status: { [C1]: "shown", [C2]: "not-started" },
    evidence: d.evidence,
    unlinked: [],
    chapter: d.chapters[0].text,
    maxWords: 100,
    evidenceFull: false,
  };
}

describe("Portfolio list", () => {
  it("offers a create form with BDB and BKE and a guided empty state", async () => {
    const { container } = renderRoute(PortfolioList, { dossiers: [] });
    expect(screen.getByRole("heading", { level: 1, name: "BDB/BKE" })).toBeInTheDocument();
    expect(screen.getByLabelText("Naam")).toBeRequired();
    expect(screen.getByRole("checkbox", { name: /BDB/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /BKE/ })).not.toBeChecked();
    expect(screen.getByRole("heading", { level: 2, name: "Nog geen dossier" })).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("lists dossiers with progress as text", async () => {
    const { container } = renderRoute(PortfolioList, {
      dossiers: [
        { id: ID, name: "Mijn BDB", tracks: ["bdb"], shown: 1, total: 2, updatedAt: new Date(0) },
      ],
    });
    expect(screen.getByRole("link", { name: "Mijn BDB" })).toHaveAttribute(
      "href",
      `/portfolio/${ID}`,
    );
    expect(screen.getByText(/1 van 2 criteria aangetoond/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verwijderen: Mijn BDB" })).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Portfolio overview", () => {
  it("shows one next step, progress per outcome, missing evidence and findings", async () => {
    const { container } = renderRoute(PortfolioOverview, overviewData());
    expect(screen.getByText("Controleer het kader en bevestig het.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "LU1 Doceren" })).toHaveAttribute(
      "href",
      `/portfolio/${ID}/outcome/${LU}`,
    );
    expect(screen.getByText(/1 van 2 criteria aangetoond/)).toBeInTheDocument();
    expect(screen.getByText(/Nog geen bewijs voor: Opname van de les/)).toBeInTheDocument();
    expect(
      screen.getByText(/"De les sluit aan bij de beginsituatie." heeft nog geen bewijs/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Bron (APA)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download als Word-bestand" })).toHaveAttribute(
      "href",
      `/portfolio/${ID}/export`,
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Portfolio framework", () => {
  it("offers the public starting point for an empty framework", async () => {
    const d = emptyDossier(["bdb"]);
    const { container } = renderRoute(PortfolioFramework, {
      id: ID,
      name: "Mijn BDB",
      framework: d.framework,
    });
    expect(screen.getByRole("button", { name: "Startpunt gebruiken" })).toBeInTheDocument();
    // Nothing to confirm yet.
    expect(screen.getByRole("button", { name: "Kader bevestigen" })).toBeDisabled();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("makes every outcome and criterion editable and the framework confirmable", async () => {
    const d = sampleDossier();
    const { container } = renderRoute(PortfolioFramework, {
      id: ID,
      name: "Mijn BDB",
      framework: d.framework,
    });
    expect(screen.queryByRole("button", { name: "Startpunt gebruiken" })).toBeNull();
    expect(screen.getByLabelText("Hogeschool")).toHaveValue("Hogeschool X");
    expect(screen.getByLabelText("Maximaal aantal woorden")).toHaveValue("100");
    expect(screen.getByLabelText("Criterium 2")).toHaveValue(
      "De les sluit aan bij de beginsituatie.",
    );
    expect(screen.getByLabelText("Verplicht bewijs (één per regel)")).toHaveValue(
      "Feedback van de werkplekbegeleider\nOpname van de les",
    );
    expect(screen.getByRole("button", { name: "Kader bevestigen" })).toBeEnabled();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Portfolio outcome page", () => {
  it("lets only the teacher set a status per criterion", async () => {
    const { container } = renderRoute(PortfolioOutcome, outcomeData());
    expect(screen.getByRole("heading", { level: 1, name: "LU1 Doceren" })).toBeInTheDocument();
    expect(screen.getByLabelText("Status 1")).toHaveValue("shown");
    expect(screen.getByLabelText("Status 2")).toHaveValue("not-started");
    expect(screen.getByText("Sterker: Ook per student.")).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows the evidence with its links and an add form", () => {
    renderRoute(PortfolioOutcome, outcomeData());
    expect(screen.getByText("Feedback werkplekbegeleider")).toBeInTheDocument();
    const link = document.querySelector(`#ev-${EV}-title`) as HTMLInputElement;
    expect(link.value).toBe("Feedback werkplekbegeleider");
    expect(screen.getByRole("button", { name: "Bewijs toevoegen" })).toBeInTheDocument();
    expect(
      screen.getByLabelText("Tekst uit een bestand halen (PDF of Word)", {
        selector: "#new-evidence-text-file",
      }),
    ).toHaveAttribute("type", "file");
  });

  it("counts the chapter's words as the teacher types", () => {
    renderRoute(PortfolioOutcome, outcomeData());
    const chapter = screen.getByLabelText("Je tekst bij deze leeruitkomst");
    expect(
      screen.getByText("6 woorden; het hele verslag mag 100 woorden hebben"),
    ).toBeInTheDocument();
    fireEvent.change(chapter, { target: { value: "Een twee drie." } });
    expect(
      screen.getByText("3 woorden; het hele verslag mag 100 woorden hebben"),
    ).toBeInTheDocument();
  });
});
