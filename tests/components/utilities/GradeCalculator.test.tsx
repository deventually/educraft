import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { GradeCalculator } from "~/components/utilities/GradeCalculator";

function renderCalc(locale: "nl" | "en" = "nl", url = "/") {
  const Stub = createRoutesStub([
    { id: "root", path: "/", loader: () => ({ locale }), Component: GradeCalculator },
  ]);
  return render(<Stub initialEntries={[url]} />);
}

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

describe("GradeCalculator", () => {
  it("shows the pass mark for the default test", async () => {
    renderCalc();
    // Default: 30 points, 55 % → 16.5.
    expect(await screen.findByText("Cesuur: 16,5 van de 30 punten.")).toBeInTheDocument();
  });

  it("takes the maximum from ?max= (the link from a rubric)", async () => {
    renderCalc("nl", "/?max=12");
    expect(await screen.findByText("Cesuur: 6,6 van de 12 punten.")).toBeInTheDocument();
  });

  it("recalculates while the teacher types", async () => {
    const user = userEvent.setup();
    renderCalc();
    const max = await screen.findByLabelText("Maximaal aantal punten");
    await user.clear(max);
    await user.type(max, "40");
    expect(screen.getByText("Cesuur: 22 van de 40 punten.")).toBeInTheDocument();
  });

  it("accepts a decimal comma", async () => {
    const user = userEvent.setup();
    renderCalc();
    const max = await screen.findByLabelText("Maximaal aantal punten");
    await user.clear(max);
    await user.type(max, "7,5");
    const table = screen.getByRole("table");
    expect(within(table).getByRole("rowheader", { name: "7,5" })).toBeInTheDocument();
  });

  it("announces the pass mark politely", async () => {
    renderCalc();
    const line = await screen.findByText(/^Cesuur:/);
    expect(line.closest("[aria-live='polite']")).not.toBeNull();
  });

  it("renders a real table with a caption", async () => {
    renderCalc();
    const table = await screen.findByRole("table", { name: "Cijfertabel: punten en cijfer" });
    // Header + 31 rows (0..30).
    expect(within(table).getAllByRole("row")).toHaveLength(32);
    expect(within(table).getByRole("rowheader", { name: "30" }).closest("tr")).toHaveTextContent(
      "10,0",
    );
  });

  it("states that the OER decides", async () => {
    renderCalc();
    expect(await screen.findByText(/OER van je opleiding/)).toBeInTheDocument();
  });

  it("keeps the advanced settings behind 'Meer instellingen'", async () => {
    renderCalc();
    const summary = await screen.findByText("Meer instellingen");
    expect(summary.tagName).toBe("SUMMARY");
    expect(screen.getByLabelText("Laagste cijfer").closest("details")).not.toBeNull();
  });

  it("applies the guessing correction", async () => {
    const user = userEvent.setup();
    renderCalc();
    const max = await screen.findByLabelText("Maximaal aantal punten");
    await user.clear(max);
    await user.type(max, "40");
    await user.click(screen.getByText("Meer instellingen"));
    await user.click(screen.getByLabelText("Raadkanscorrectie (meerkeuzetoets)"));
    expect(screen.getByText("Cesuur: 26,5 van de 40 punten.")).toBeInTheDocument();
    expect(screen.getByText("Raadscore: 10 punten.")).toBeInTheDocument();
  });

  it("shows a translated error instead of NaN for invalid input", async () => {
    const user = userEvent.setup();
    renderCalc();
    const max = await screen.findByLabelText("Maximaal aantal punten");
    await user.clear(max);
    await user.type(max, "abc");
    expect(screen.getByText(/Vul een maximaal aantal punten in/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(document.body.textContent).not.toMatch(/NaN/);
    expect(max).toHaveAttribute("aria-invalid", "true");
  });

  it("copies the table tab-separated", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderCalc();
    await user.click(await screen.findByRole("button", { name: "Kopieer tabel" }));
    const text = writeText.mock.calls[0]![0] as string;
    const lines = text.split("\n");
    expect(lines[0]).toBe("Punten\tCijfer");
    expect(lines[1]).toBe("0\t1,0");
    expect(lines.at(-1)).toBe("30\t10,0");
  });

  it("has no a11y violations (NL)", async () => {
    const { container } = renderCalc("nl");
    await screen.findByRole("table");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations (EN), with English text", async () => {
    const { container } = renderCalc("en");
    expect(await screen.findByText("Pass mark: 16.5 of 30 points.")).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
