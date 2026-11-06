import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { CourseImport } from "~/components/courses/CourseImport";
import type { ImportProposal } from "~/lib/courses/import";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderImport(proposal: ImportProposal | null, startOpen = true) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <CourseImport courseName="Databases" startOpen={startOpen} proposal={proposal} />
      ),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

const proposal: ImportProposal = {
  outcomes: [
    {
      key: "o1",
      text: "Je schrijft SQL-queries.",
      bloom: "apply",
      verbatim: true,
      existing: false,
    },
    { key: "o2", text: "Je beheert een server.", verbatim: false, existing: false },
    { key: "o3", text: "Je ontwerpt een datamodel.", verbatim: true, existing: true },
  ],
  assessments: [
    {
      key: "a1",
      title: "Tentamen",
      kind: "summative",
      weight: 60,
      week: 8,
      outcomeKeys: ["o1"],
      existing: false,
    },
  ],
  notes: "Het document noemt ook een herkansing.",
  weightsOff: true,
};

describe("CourseImport", () => {
  it("offers the document text, a file and the course name; the file stays in the browser", async () => {
    const { container } = renderImport(null);
    expect(screen.getByText("Importeren uit OER of studiehandleiding")).toBeVisible();
    expect(screen.getByLabelText("Tekst van het document")).toBeRequired();
    expect(screen.getByLabelText("Naam van het vak in het document")).toHaveValue("Databases");
    expect(screen.getByLabelText(/Of kies het bestand/)).toHaveAttribute("type", "file");
    expect(screen.getByText("Kies bestand")).toBeVisible();
    expect(screen.getByText(/niet bewaard/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Voorstel maken" })).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows the proposal: verbatim items ticked, the rest marked and off", async () => {
    const { container } = renderImport(proposal, false);
    const review = screen.getByRole("form", { name: "Voorstel" });

    const lu1 = within(review).getByRole("group", { name: "Leeruitkomst 1" });
    expect(within(lu1).getByRole("checkbox", { name: "Toevoegen aan de cursus" })).toBeChecked();
    expect(within(lu1).getByLabelText("Leeruitkomst")).toHaveValue("Je schrijft SQL-queries.");
    expect(within(lu1).getByLabelText("Bloom-niveau (voorstel van de AI)")).toHaveDisplayValue(
      "toepassen",
    );

    const lu2 = within(review).getByRole("group", { name: "Leeruitkomst 2" });
    expect(
      within(lu2).getByRole("checkbox", { name: "Toevoegen aan de cursus" }),
    ).not.toBeChecked();
    expect(within(lu2).getByText(/Controleer dit/)).toBeVisible();

    const lu3 = within(review).getByRole("group", { name: "Leeruitkomst 3" });
    expect(within(lu3).queryByRole("checkbox")).toBeNull();
    expect(within(lu3).getByText(/Staat al in je cursus/)).toBeVisible();

    const toets = within(review).getByRole("group", { name: "Toets 1" });
    expect(within(toets).getByRole("checkbox", { name: "Toevoegen aan de cursus" })).toBeChecked();
    expect(within(toets).getByLabelText("Titel")).toHaveValue("Tentamen");
    expect(within(toets).getByLabelText("Soort")).toHaveDisplayValue("Summatief");
    expect(within(toets).getByLabelText("Weging (%)")).toHaveValue("60");
    expect(within(toets).getByLabelText("Week")).toHaveValue("8");
    expect(within(toets).getByRole("checkbox", { name: /Je schrijft SQL-queries/ })).toBeChecked();

    expect(within(review).getByText(/tellen niet op tot 100%/)).toBeVisible();
    expect(within(review).getByText("Het document noemt ook een herkansing.")).toBeVisible();
    expect(within(review).getByRole("button", { name: "Gekozen items toevoegen" })).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
