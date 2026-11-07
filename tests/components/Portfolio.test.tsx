import { describe, it, expect } from "vitest";
import type { ComponentType } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import PortfolioList from "~/routes/portfolio._index";
import PortfolioOverview from "~/routes/portfolio.$id";
import PortfolioFramework from "~/routes/portfolio.$id.framework";
import PortfolioOutcome from "~/routes/portfolio.$id.outcome.$outcomeId";
import { outcomeProgress, nextStep } from "~/lib/portfolio/progress";
import { emptyDossier } from "~/lib/portfolio/schema";
import { dossierStep } from "~/lib/portfolio/step";
import { readinessCheck } from "~/lib/portfolio/readiness";
import { openSpots } from "~/lib/portfolio/openSpots";
import * as edit from "~/lib/portfolio/edit";
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
    next: nextStep(d),
    references: d.references,
    coachMode: d.coachMode,
    aiUsed: d.aiLog.length > 0,
    aiRequired: !!d.framework.requirements.aiDisclosureRequired,
    nextTools: [] as { slug: string; name: string }[],
    step: dossierStep(d),
    routeLinks: {
      framework: `/portfolio/${ID}/framework`,
      collect: `/portfolio/${ID}/outcome/${LU}`,
      fill: `/portfolio/${ID}/outcome/${LU}`,
      write: `/portfolio/${ID}/outcome/${LU}`,
      finish: "#readiness",
    },
    practise: null as string | null,
    readiness: readinessCheck(d),
    openSpots: openSpots(d).length,
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
    toolHints: {} as Record<string, { slug: string; name: string }[]>,
    chapterTools: [] as { slug: string; name: string }[],
    courseHints: [] as string[],
    snapshotCourses: {} as Record<string, string | null>,
    suggestions: {} as Record<
      string,
      { generationId: string; toolName: string; createdAt: number; courses: string[] }[]
    >,
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
  it("shows one next step, progress per outcome and missing evidence", async () => {
    const { container } = renderRoute(PortfolioOverview, overviewData());
    expect(screen.getByText("Controleer het kader en bevestig het.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "LU1 Doceren" })).toHaveAttribute(
      "href",
      `/portfolio/${ID}/outcome/${LU}`,
    );
    expect(screen.getByText(/1 van 2 criteria aangetoond/)).toBeInTheDocument();
    expect(screen.getByText(/Nog geen bewijs voor: Opname van de les/)).toBeInTheDocument();
    // The old "Aandachtspunten" block is gone: "Klaar om in te leveren?" names it (P29.1).
    expect(screen.queryByRole("heading", { name: "Aandachtspunten" })).toBeNull();
    expect(screen.getByLabelText("Bron (APA)")).toBeInTheDocument();
    const exportButton = screen.getByRole("button", { name: "Download als Word-bestand" });
    expect(exportButton.closest("form")).toHaveAttribute("action", `/portfolio/${ID}/export`);
    // No AI used yet: no disclosure checkbox.
    expect(screen.queryByRole("checkbox", { name: /verantwoording/ })).toBeNull();
    expect(screen.getByRole("radio", { name: /Alleen feedback/ })).toBeChecked();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("says when the framework is only provisional (BDB/BKE plan, PR 3)", () => {
    const d = sampleDossier();
    d.framework = { ...d.framework, national: true, provisional: true, confirmedAt: 1 };
    renderRoute(PortfolioOverview, overviewData(d));
    expect(screen.getByText(/Voorlopig kader, bevestigd op/)).toBeInTheDocument();
  });
});

describe("Portfolio route in five steps", () => {
  it("marks the current step and links each step to where you do it", async () => {
    const d = sampleDossier();
    d.framework.confirmedAt = 1;
    const { container } = renderRoute(PortfolioOverview, overviewData(d));
    const nav = screen.getByRole("navigation", { name: "Route van je dossier" });
    const steps = nav.querySelectorAll("ol > li");
    expect(steps).toHaveLength(5);
    const current = screen.getByRole("link", { current: "step" });
    expect(current).toHaveTextContent("Stap 3 van 5: Vul aan met een tool");
    expect(current).toHaveAttribute("href", `/portfolio/${ID}/outcome/${LU}`);
    expect(screen.getByRole("link", { name: /Stap 1 van 5: Kader/ })).toHaveAttribute(
      "href",
      `/portfolio/${ID}/framework`,
    );
    expect(screen.queryByText(/Laatste stap/)).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("names the export and the interview practice at the last step", async () => {
    const d = sampleDossier();
    d.framework.confirmedAt = 1;
    d.evidence[0].criterionIds = [C1, C2];
    const data = {
      ...overviewData(d),
      practise: "/portfolio/d1/rehearsal",
    };
    const { container } = renderRoute(PortfolioOverview, data);
    expect(screen.getByRole("link", { current: "step" })).toHaveTextContent("Rond af");
    expect(screen.getByText(/Laatste stap/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Oefen je eindgesprek met een proefassessment" }),
    ).toHaveAttribute("href", "/portfolio/d1/rehearsal");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Portfolio evidence suggestions", () => {
  it("offers earlier work per criterion with checkboxes, nothing ticked", async () => {
    const data = {
      ...outcomeData(),
      suggestions: {
        [C2]: [
          {
            generationId: "g1",
            toolName: "Les voorbereiden",
            createdAt: Date.UTC(2026, 10, 1),
            courses: ["Statistiek 1"],
          },
        ],
      },
    };
    const { container } = renderRoute(PortfolioOutcome, data);
    const group = screen.getByRole("group", { name: /Dit heb je misschien al/ });
    const box = screen.getByRole("checkbox", { name: /Les voorbereiden.*bij Statistiek 1/ });
    expect(box).not.toBeChecked();
    expect(box).toHaveAttribute("name", "generationIds");
    expect(group.closest("form")?.querySelector('input[name="criterionId"]')).toHaveValue(C2);
    expect(screen.getByRole("button", { name: "Zet bij criterium 2" })).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows nothing without suggestions", () => {
    renderRoute(PortfolioOutcome, outcomeData());
    expect(screen.queryByText("Dit heb je misschien al")).toBeNull();
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

  it("offers to confirm the national starting point as provisional (BDB/BKE plan, PR 3)", async () => {
    const d = sampleDossier();
    const { container } = renderRoute(PortfolioFramework, {
      id: ID,
      name: "Mijn BDB",
      framework: { ...d.framework, national: true },
    });
    expect(screen.getByRole("button", { name: "Bevestig als voorlopig kader" })).toBeEnabled();
    expect(
      screen.getByText(/Wacht je nog op het formulier van je hogeschool\?/),
    ).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("offers no provisional confirmation for the institution's own form", () => {
    renderRoute(PortfolioFramework, {
      id: ID,
      name: "Mijn BDB",
      framework: sampleDossier().framework,
    });
    expect(screen.queryByRole("button", { name: "Bevestig als voorlopig kader" })).toBeNull();
  });

  it("says a provisional framework still needs the institution's form, and can confirm it", () => {
    const d = sampleDossier();
    renderRoute(PortfolioFramework, {
      id: ID,
      name: "Mijn BDB",
      framework: {
        ...d.framework,
        national: true,
        provisional: true,
        confirmedAt: Date.UTC(2026, 10, 7),
      },
    });
    expect(screen.getByText(/Voorlopig kader, bevestigd op/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kader bevestigen" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Bevestig als voorlopig kader" })).toBeNull();
  });

  it("offers to read the form when nothing depends on the framework yet", async () => {
    const d = emptyDossier(["bdb"]);
    const { container } = renderRoute(PortfolioFramework, {
      id: ID,
      name: "Mijn BDB",
      framework: d.framework,
      canExtract: true,
    });
    expect(screen.getByLabelText("Tekst van het beoordelingsformulier")).toBeInTheDocument();
    expect(screen.getByLabelText(/Of kies het formulier/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kader uit formulier halen" })).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("hides the form reader once the framework is in use", () => {
    const d = sampleDossier();
    renderRoute(PortfolioFramework, {
      id: ID,
      name: "Mijn BDB",
      framework: d.framework,
      canExtract: false,
    });
    expect(screen.queryByRole("button", { name: "Kader uit formulier halen" })).toBeNull();
  });

  it("marks a criterion that is not literally in the form", async () => {
    const d = sampleDossier();
    d.framework.outcomes[0].criteria[1].unverified = true;
    const { container } = renderRoute(PortfolioFramework, {
      id: ID,
      name: "Mijn BDB",
      framework: d.framework,
      canExtract: false,
    });
    const flags = screen.getAllByText(/Controleer dit/);
    // One on the criterion, one summary above the confirm button.
    expect(flags).toHaveLength(2);
    expect(screen.getByLabelText("Criterium 2")).toHaveAccessibleDescription(/Controleer dit/);
    expect(screen.getByLabelText("Criterium 1")).not.toHaveAccessibleDescription(/Controleer dit/);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Portfolio — which tool helps now", () => {
  it("names a tool and how to use it for a criterion that still needs evidence", async () => {
    const { container } = renderRoute(PortfolioOutcome, {
      ...outcomeData(),
      toolHints: { [C2]: [{ slug: "guided-reflection", name: "Les of cursus ontwerpen" }] },
      chapterTools: [{ slug: "dialogic-encounters", name: "Dialogic Encounters" }],
    });
    const tool = screen.getByRole("link", { name: "Open Les of cursus ontwerpen" });
    // P27.2: the tool opens for this criterion, so its result can go straight back.
    expect(tool).toHaveAttribute("href", `/tools/guided-reflection?dossier=${ID}&criterion=${C2}`);
    expect(screen.getByText(/Backward Design/)).toBeInTheDocument();
    expect(screen.getAllByText(/Zet bij dit criterium/).length).toBe(1);
    expect(screen.getByRole("link", { name: "Open Dialogic Encounters" })).toHaveAttribute(
      "href",
      "/tools/dialogic-encounters",
    );
    expect(screen.getByText(/geen bewijs en geen bron/)).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows no tool help when nothing fits", () => {
    renderRoute(PortfolioOutcome, outcomeData());
    expect(screen.queryByText("Hulp uit LimeOnIt")).toBeNull();
    expect(screen.queryByText("Denkhulp bij het schrijven")).toBeNull();
  });

  it("puts the fitting tool in the next-step card of the overview", async () => {
    const { container } = renderRoute(PortfolioOverview, {
      ...overviewData(),
      nextTools: [{ slug: "authentic-assessment", name: "Authentiek toetsen" }],
    });
    expect(screen.getByRole("link", { name: "Open Authentiek toetsen" })).toHaveAttribute(
      "href",
      "/tools/authentic-assessment",
    );
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

  it("marks evidence without text as still to come (BDB/BKE plan, PR 3)", async () => {
    const d = sampleDossier();
    const evidence = [{ ...d.evidence[0], text: "" }];
    const { container } = renderRoute(PortfolioOutcome, { ...outcomeData(), evidence });
    expect(screen.getByText("Volgt nog")).toBeInTheDocument();
    expect(
      screen.getAllByText("Nog geen tekst? Laat dit leeg; het bewijsstuk staat dan als Volgt nog.")
        .length,
    ).toBeGreaterThan(0);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows no Volgt nog for evidence with text", () => {
    renderRoute(PortfolioOutcome, outcomeData());
    expect(screen.queryByText("Volgt nog")).toBeNull();
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

  it("counts the open spots in the chapter as the teacher types", async () => {
    const { container } = renderRoute(PortfolioOutcome, outcomeData());
    const chapter = screen.getByLabelText("Je tekst bij deze leeruitkomst");
    expect(screen.queryByText(/open plek/)).toBeNull();
    fireEvent.change(chapter, {
      target: { value: "Ik begon. [aanvullen: het effect] Daarna [aanvullen: de groep]." },
    });
    const note = screen.getByText(
      "2 open plekken in dit hoofdstuk, zoals [aanvullen: …]. Vul ze in voordat je inlevert.",
    );
    expect(chapter.getAttribute("aria-describedby")).toContain(note.id);
    fireEvent.change(chapter, { target: { value: "Ik begon. [aanvullen: het effect]" } });
    expect(
      screen.getByText(
        "1 open plek in dit hoofdstuk, zoals [aanvullen: …]. Vul hem in voordat je inlevert.",
      ),
    ).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    fireEvent.change(chapter, { target: { value: "Klaar." } });
    expect(screen.queryByText(/open plek/)).toBeNull();
  });
});

describe("Portfolio overview — ready to hand in (P29.1)", () => {
  it("shows the check, and its summary above the export button as a link", async () => {
    const { container } = renderRoute(PortfolioOverview, overviewData());
    expect(screen.getByRole("region", { name: "Klaar om in te leveren?" })).toBeInTheDocument();
    const exportForm = screen.getByRole("form", { name: "Exporteren" });
    expect(within(exportForm).getByRole("link", { name: /punten open/ })).toHaveAttribute(
      "href",
      "#readiness",
    );
    // Advice, not a gate: with no open spot left, the export button works.
    expect(within(exportForm).getByRole("button")).toBeEnabled();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Portfolio overview — no open spot in the handed-in work", () => {
  it("offers only a draft version while an open spot is left, and says why", async () => {
    const d = edit.writeChapter(sampleDossier(), LU, "Mijn les. [aanvullen: het effect]");
    const { container } = renderRoute(PortfolioOverview, overviewData(d));
    const exportForm = screen.getByRole("form", { name: "Exporteren" });
    expect(
      within(exportForm).getByText(/Er staat nog 1 open plek in je dossier/),
    ).toBeInTheDocument();
    expect(
      within(exportForm).queryByRole("button", { name: "Download als Word-bestand" }),
    ).toBeNull();
    const draft = within(exportForm).getByRole("button", { name: "Download een conceptversie" });
    expect(draft).toHaveAttribute("name", "draft");
    expect(draft).toHaveAttribute("value", "1");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("offers the final version once every open spot is gone", () => {
    renderRoute(PortfolioOverview, overviewData());
    const exportForm = screen.getByRole("form", { name: "Exporteren" });
    expect(
      within(exportForm).getByRole("button", { name: "Download als Word-bestand" }),
    ).toBeInTheDocument();
    expect(within(exportForm).queryByText(/open plek/)).toBeNull();
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

  it("labels the coach's verdicts on a provisional framework (BDB/BKE plan, PR 3)", async () => {
    const { container } = renderRoute(PortfolioOutcome, {
      ...outcomeData(),
      provisional: true,
      stored: { ...review, provisional: true },
    });
    expect(
      screen.getByText(
        "Voorlopig kader: de AI beoordeelt op het landelijke startpunt, niet op het formulier van je hogeschool.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Op het landelijke startpunt \(voorlopig kader\)\./),
    ).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows no provisional label on the institution's own framework", () => {
    renderRoute(PortfolioOutcome, { ...outcomeData(), stored: review });
    expect(screen.queryByText(/landelijke startpunt/)).toBeNull();
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

describe("Portfolio outcome — a course snapshot as evidence (P26.4)", () => {
  function withSnapshot(courseName: string | null) {
    const d = sampleDossier();
    d.evidence[0].sourceCourse = {
      courseId: "c1",
      part: "outcomes-and-matrix",
      at: Date.UTC(2026, 10, 5),
    };
    return { ...outcomeData(d), snapshotCourses: { c1: courseName } };
  }

  it("names the course and the date, links to it and offers 'Opnieuw ophalen'", async () => {
    const { container } = renderRoute(PortfolioOutcome, withSnapshot("Databases"));
    const summary = screen.getByText("Feedback werkplekbegeleider", { exact: false });
    (summary.closest("details") as HTMLDetailsElement).open = true;
    expect(screen.getByText(/Uit cursus Databases, momentopname van 5 nov\.? 2026/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Open de cursus" })).toHaveAttribute(
      "href",
      "/courses/c1",
    );
    const button = screen.getByRole("button", { name: /Opnieuw ophalen/ });
    const form = button.closest("form") as HTMLFormElement;
    expect(form.querySelector('input[name="intent"]')).toHaveValue("refreshCourseEvidence");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("keeps the snapshot of a deleted course, without the button", () => {
    renderRoute(PortfolioOutcome, withSnapshot(null));
    const summary = screen.getByText("Feedback werkplekbegeleider", { exact: false });
    (summary.closest("details") as HTMLDetailsElement).open = true;
    expect(screen.getByText(/Uit een cursus die niet meer bestaat/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Opnieuw ophalen/ })).toBeNull();
  });

  it("points a blueprint criterion at the courses", () => {
    renderRoute(PortfolioOutcome, { ...outcomeData(), courseHints: [C2] });
    expect(screen.getByRole("link", { name: "Gebruik je cursus" })).toHaveAttribute(
      "href",
      "/courses",
    );
  });
});
