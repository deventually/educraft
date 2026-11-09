import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import PortfolioRehearsal from "~/routes/portfolio.$id.rehearsal";
import { ToastProvider } from "~/components/Toast";
import { getToolBySlug } from "~/lib/registry";
import { sampleDossier } from "../portfolio/fixtures";

vi.mock("~/lib/streamClient", () => ({ streamPost: vi.fn() }));

// biome-ignore lint/suspicious/noExplicitAny: route components take framework-typed props
const Page = PortfolioRehearsal as ComponentType<any>;
const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const ID = "dossier-1";

function renderPage(provisional = false) {
  const d = sampleDossier();
  if (provisional)
    d.framework = { ...d.framework, national: true, provisional: true, confirmedAt: 1 };
  const loaderData = {
    id: ID,
    name: "Mijn BDB",
    title: "Oefen je eindgesprek",
    tool: getToolBySlug("portfolio-rehearsal")!,
    framework: d.framework,
    references: d.references,
    catalogModels: [{ id: "claude-sonnet-5-5", displayName: "Claude Sonnet" }],
    contextProfile: null,
  };
  const Stub = createRoutesStub([
    {
      path: `/portfolio/${ID}/rehearsal`,
      Component: () => (
        <ToastProvider>
          <Page loaderData={loaderData} />
        </ToastProvider>
      ),
    },
  ]);
  return render(<Stub initialEntries={[`/portfolio/${ID}/rehearsal`]} />);
}

describe("Oefen je eindgesprek (29.3)", () => {
  it("says the committee judges on the national starting point when the framework is provisional", () => {
    renderPage(true);
    expect(
      screen.getByText(
        "Voorlopig kader: de AI beoordeelt op het landelijke startpunt, niet op het formulier van je hogeschool.",
      ),
    ).toBeInTheDocument();
  });

  it("shows no provisional notice on the institution's own framework", () => {
    renderPage();
    expect(screen.queryByText(/landelijke startpunt/)).toBeNull();
  });

  it("asks for the length and the outcomes first, accessibly", async () => {
    const { container } = renderPage();
    expect(screen.getByRole("heading", { name: "Oefen je eindgesprek" })).toBeInTheDocument();
    const length = screen.getByRole("group", { name: "Hoe lang?" });
    expect(within(length).getByRole("radio", { name: /Kort/ })).toBeChecked();
    const outcomes = screen.getByRole("group", { name: "Welke leeruitkomsten?" });
    expect(within(outcomes).getByRole("checkbox", { name: "LU1 Doceren" })).toBeChecked();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("opens, streams, wraps up on the button and shows the feedback as a table", async () => {
    const { streamPost } = await import("~/lib/streamClient");
    const mock = streamPost as ReturnType<typeof vi.fn>;
    const answers = [
      "Welkom. Wat deed je in die les?",
      JSON.stringify({
        criteria: [
          {
            key: "K1",
            heard: "convincing",
            quote: "Ik ben er klaar voor.",
            tip: "Noem het effect.",
          },
        ],
        overall: "Een helder gesprek.",
      }),
    ];
    mock.mockImplementation(async (_url, _body, { onToken, onDone }) => {
      onToken(answers.shift() ?? "");
      onDone?.({});
    });
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.click(screen.getByRole("button", { name: "Begin het gesprek" }));
    await user.click(screen.getByRole("button", { name: "Ik ben er klaar voor." }));
    expect(await screen.findByText("Welkom. Wat deed je in die les?")).toBeInTheDocument();
    expect(mock.mock.calls[0]![1]).toMatchObject({
      slug: "portfolio-rehearsal",
      dossierId: ID,
      values: { length: "short", outcomeIds: [] },
    });
    await user.click(screen.getByRole("button", { name: "Rond af" }));
    const table = await screen.findByRole("table", { name: "Feedback per criterium" });
    expect(within(table).getByText("Overtuigend")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bewaar in je dossier" })).toBeInTheDocument();
    await waitFor(async () => expect((await axe(container, axeOpts)).violations).toEqual([]));
  });
});
