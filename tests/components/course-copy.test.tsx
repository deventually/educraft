import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { CopiedNotice, CourseCopy } from "~/components/courses/CourseCopy";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderCopy() {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <CourseCopy name="Statistiek" data={{ studyYear: "2025-2026", phase: "Periode 2" }} />
      ),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

// Seam: the rendered form, by its labels; it posts `copy-run` without JavaScript.
describe("CourseCopy (a new run of the course)", () => {
  it("asks for the name, study year, semester or period and start date", async () => {
    const { container } = renderCopy();
    const region = screen.getByRole("region", { name: "Kopiëren voor een nieuwe uitvoering" });
    expect(within(region).getByLabelText("Naam van de kopie")).toHaveValue("Statistiek");
    expect(within(region).getByLabelText("Naam van de kopie")).toBeRequired();
    expect(within(region).getByLabelText("Studiejaar")).toHaveValue("2025-2026");
    expect(within(region).getByLabelText("Semester of periode")).toHaveValue("Periode 2");
    expect(within(region).getByLabelText("Semester of periode")).toHaveAccessibleDescription(
      "Bijvoorbeeld Semester 1 of Periode 3.",
    );
    expect(within(region).getByLabelText("Nieuwe startdatum")).toHaveAttribute("type", "date");
    expect(within(region).getByLabelText("Nieuwe startdatum")).toHaveValue("");
    expect(within(region).getByText(/Delen, collega's en gekoppeld werk niet/)).toBeVisible();
    const form = within(region)
      .getByRole("button", { name: "Kopie maken" })
      .closest("form") as HTMLFormElement;
    expect(form).toHaveAttribute("method", "post");
    expect(form.querySelector('input[name="intent"]')).toHaveValue("copy-run");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("CopiedNotice (after copying, on the Controle tab)", () => {
  it("asks what has to change after last run's evaluation", async () => {
    const Stub = createRoutesStub([{ path: "/", Component: CopiedNotice }]);
    const { container } = render(<Stub initialEntries={["/"]} />);
    expect(
      screen.getByRole("heading", { name: "Dit is je kopie voor de nieuwe uitvoering" }),
    ).toBeVisible();
    expect(screen.getByText(/Wat moet er anders na de evaluatie/)).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
