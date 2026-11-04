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
    coachMode: d.coachMode,
    aiUsed: d.aiLog.length > 0,
    aiRequired: !!d.framework.requirements.aiDisclosureRequired,
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
    confirmed: true,
    coachMode: "coach",
    showDraftNotice: false,
    withEvidence: [C1],
    stored: undefined as unknown,
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
    const exportButton = screen.getByRole("button", { name: "Download als Word-bestand" });
    expect(exportButton.closest("form")).toHaveAttribute("action", `/portfolio/${ID}/export`);
    // No AI used yet: no disclosure checkbox.
    expect(screen.queryByRole("checkbox", { name: /verantwoording/ })).toBeNull();
    expect(screen.getByRole("radio", { name: /Alleen feedback/ })).toBeChecked();
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

describe("Portfolio overview — AI disclosure in the export", () => {
  it("offers the disclosure once the coach was used, ticked when the form asks for it", async () => {
    const { container } = renderRoute(PortfolioOverview, {
      ...overviewData(),
      aiUsed: true,
      aiRequired: true,
    });
    expect(
      screen.getByRole("checkbox", { name: /verantwoording van het AI-gebruik/ }),
    ).toBeChecked();
    expect(
      screen.getByText("Je formulier vraagt om een verantwoording van AI-gebruik."),
    ).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Portfolio outcome page — coach", () => {
  const review = {
    at: Date.UTC(2026, 10, 4),
    model: "claude-sonnet-5-5",
    modelName: "Claude Sonnet 5.5",
    review: {
      overall: "Een helder begin; de beginsituatie ontbreekt nog.",
      criteria: [
        {
          criterionId: C1,
          verdict: "shown",
          quote: "Mijn les begon met een vraag.",
          strengthen: [],
          evidenceNeeded: [],
        },
        {
          criterionId: C2,
          verdict: "partial",
          quoteUnverified: true,
          gap: "Je noemt de beginsituatie niet.",
          strengthen: ["Beschrijf wat de studenten al wisten."],
          evidenceNeeded: ["Opname van de les"],
        },
      ],
    },
  };

  it("asks to confirm the framework before the coach can run", () => {
    renderRoute(PortfolioOutcome, { ...outcomeData(), confirmed: false });
    expect(screen.queryByRole("button", { name: "Laat beoordelen" })).toBeNull();
    expect(screen.getByText(/Bevestig dat eerst/)).toBeInTheDocument();
  });

  it("runs on request and shows the advice per criterion, with the teacher's own mark", async () => {
    const { container } = renderRoute(PortfolioOutcome, { ...outcomeData(), stored: review });
    expect(screen.getByRole("button", { name: "Opnieuw laten beoordelen" })).toBeEnabled();
    expect(screen.getByText(/Beoordeeld op .* met Claude Sonnet 5.5/)).toBeInTheDocument();
    expect(screen.getByText("Aangetoond volgens de coach")).toBeInTheDocument();
    expect(screen.getByText("Deels aangetoond")).toBeInTheDocument();
    expect(screen.getByText(/niet letterlijk in je hoofdstuk/)).toBeInTheDocument();
    expect(screen.getByText("Beschrijf wat de studenten al wisten.")).toBeInTheDocument();
    // C1 is already shown (teacher's status); C2 gets the one-click mark.
    expect(
      screen.getByText("Je hebt dit criterium als aangetoond gemarkeerd."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Markeer als aangetoond: 2" })).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows no draft buttons in coaching mode", () => {
    renderRoute(PortfolioOutcome, outcomeData());
    expect(screen.queryByRole("button", { name: /Stel een alinea op/ })).toBeNull();
  });

  it("in draft mode shows one neutral notice and a draft button per criterion with evidence", async () => {
    const { container } = renderRoute(PortfolioOutcome, {
      ...outcomeData(),
      coachMode: "draft",
      showDraftNotice: true,
    });
    expect(screen.getByText(/eigen regels hebben voor AI-gebruik/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Begrepen" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Stel een alinea op voor criterium 1" }),
    ).toHaveAttribute("value", `draft:${C1}`);
    expect(
      screen.queryByRole("button", { name: "Stel een alinea op voor criterium 2" }),
    ).toBeNull();
    expect(screen.getByText(/Criterium 2: koppel eerst bewijs/)).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
