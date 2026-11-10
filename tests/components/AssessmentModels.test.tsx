import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";

// Keep the SQLite-backed repositories out of happy-dom.
vi.mock("~/server/repositories/assessmentModels.server", () => ({}));
vi.mock("~/server/repositories/rubrics.server", () => ({}));

import AssessmentModels from "~/routes/assessment-models";

const documentTypes = [
  { value: "essay", label: "Essay" },
  { value: "stageverslag", label: "Stageverslag" },
];
const starters = [
  { id: "essay", name: "Essay (algemeen)", documentTypes: ["essay"], scale: "O/V/G" },
];

function renderPage(models: unknown[] = [], rubrics: unknown[] = []) {
  const props = {
    loaderData: { models, starters, rubrics, documentTypes },
  } as unknown as ComponentProps<typeof AssessmentModels>;
  const Stub = createRoutesStub([
    { path: "/assessment-models", Component: () => <AssessmentModels {...props} /> },
  ]);
  return render(<Stub initialEntries={["/assessment-models"]} />);
}

// happy-dom loads no stylesheet, so axe can't compute real contrast.
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

describe("Assessment models page", () => {
  it("invites a teacher without models to start, and offers the starters to copy", async () => {
    const { container } = renderPage();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Beoordelingsmodellen" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nog geen eigen beoordelingsmodellen")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Kopiëren naar mijn modellen.*Essay \(algemeen\)/ }),
    ).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows each own model with its document types, and marks one without a scale", async () => {
    renderPage([
      {
        id: "m1",
        name: "Essay jaar 1",
        data: { documentTypes: ["essay"], framework: "C1", scale: "" },
      },
      { id: "m2", name: "Vrij", data: { documentTypes: [], framework: "C1", scale: "O/V/G" } },
    ]);
    expect(await screen.findByText("Essay jaar 1")).toBeInTheDocument();
    expect(screen.getAllByText("Essay").length).toBeGreaterThan(0);
    expect(screen.getByText("Alleen feedback")).toBeInTheDocument();
    expect(screen.getByText("Geen vast type (kies je in de tool)")).toBeInTheDocument();
  });

  it("opens the editor with the model filled in, accessible", async () => {
    const { container } = renderPage([
      {
        id: "m1",
        name: "Essay jaar 1",
        data: { documentTypes: ["essay"], framework: "C1 Stelling", scale: "" },
      },
    ]);
    await userEvent.click(await screen.findByRole("button", { name: "Bewerken" }));
    expect(screen.getByLabelText(/^Naam/)).toHaveValue("Essay jaar 1");
    expect(screen.getByRole("checkbox", { name: "Essay" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Stageverslag" })).not.toBeChecked();
    expect(screen.getByLabelText(/^Beoordelingskader/)).toHaveValue("C1 Stelling");
    expect(screen.getByLabelText(/^Beoordelingsschaal/)).toHaveValue("");
    await waitFor(async () => expect((await axe(container, axeOpts)).violations).toEqual([]));
  });

  it("offers to take over an own rubric", async () => {
    renderPage([], [{ id: "r1", name: "Betoog" }]);
    expect(await screen.findByRole("combobox", { name: "Rubric" })).toHaveValue("r1");
    expect(screen.getByRole("button", { name: "Overnemen" })).toBeInTheDocument();
  });
});
