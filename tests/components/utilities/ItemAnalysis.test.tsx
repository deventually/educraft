import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ItemAnalysis } from "~/components/utilities/ItemAnalysis";
import { takeHandoff } from "~/lib/forms/handoff";

function renderAnalysis(locale: "nl" | "en" = "nl", explainWith?: string) {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ locale }),
      Component: () => <ItemAnalysis explainWith={explainWith} />,
    },
    { path: "/tools/:slug", Component: () => <p>Tool page</p> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const LIST = "Naam\tV1\tV2\tV3\nAnna\t1\t1\t1\nBram\t1\t1\t0\nCem\t1\t0\t0\nDewi\t0\t0\t0";

async function paste(text: string, label = "Scorelijst") {
  const box = await screen.findByLabelText(label);
  // fireEvent: userEvent.type would treat \t as a tab key press.
  fireEvent.change(box, { target: { value: text } });
}

describe("ItemAnalysis", () => {
  beforeEach(() => sessionStorage.clear());

  it("asks for a score list first", async () => {
    renderAnalysis();
    expect(
      await screen.findByText("Plak een scorelijst om de uitkomst te zien."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("computes p, Rit, Rir and alpha per question", async () => {
    renderAnalysis();
    await paste(LIST);
    expect(screen.getByText("Cronbachs alfa: 0,75")).toBeInTheDocument();
    const table = screen.getByRole("table", {
      name: "Per vraag: p-waarde, Rit, Rir en alfa zonder deze vraag",
    });
    const row = within(table).getByRole("rowheader", { name: "V1" }).closest("tr")!;
    expect(row).toHaveTextContent("0,75");
    expect(row).toHaveTextContent("0,77");
    expect(row).toHaveTextContent("0,52");
  });

  it("removes the name column, says so, and shows no names", async () => {
    renderAnalysis();
    await paste(LIST);
    expect(
      screen.getByText("Weggehaald, want geen vraag of mogelijk persoonsgegevens: Naam."),
    ).toBeInTheDocument();
    const result = screen.getByRole("region", { name: "Uitkomst" });
    expect(result).not.toHaveTextContent("Anna");
  });

  it("names the error when a score is above the maximum", async () => {
    const user = userEvent.setup();
    renderAnalysis();
    await paste(LIST);
    await user.type(screen.getByLabelText("Maximale punten per vraag (optioneel)"), "1; 1");
    expect(
      screen.getByText("Geef één maximum voor alle vragen, of precies één per vraag."),
    ).toBeInTheDocument();
  });

  it("announces the result politely", async () => {
    renderAnalysis();
    await paste(LIST);
    expect(
      screen.getByText("4 kandidaten, 3 vragen.").closest("[aria-live='polite']"),
    ).not.toBeNull();
  });

  it("hands only the numbers to the explaining tool and opens it", async () => {
    const user = userEvent.setup();
    renderAnalysis("nl", "test-analysis");
    await paste(LIST);
    await user.click(screen.getByRole("button", { name: "Laat uitleggen" }));
    expect(await screen.findByText("Tool page")).toBeInTheDocument();
    const handed = takeHandoff("test-analysis");
    expect(handed?.analysis).toContain("| V1 | 1 | 0,75 | 0,77 | 0,52 | 0,73 |");
    expect(handed?.analysis).not.toContain("Anna");
  });

  it("hides the explain button when the tool is not available", async () => {
    renderAnalysis("nl", undefined);
    await paste(LIST);
    expect(screen.queryByRole("button", { name: "Laat uitleggen" })).toBeNull();
  });

  it("works in English", async () => {
    renderAnalysis("en");
    await paste(LIST, "Score list");
    expect(screen.getByText("Cronbach's alpha: 0.75")).toBeInTheDocument();
  });

  it("has no axe violations, empty and with a result", async () => {
    const { container } = renderAnalysis("nl", "test-analysis");
    await screen.findByLabelText("Scorelijst");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await paste(LIST);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
