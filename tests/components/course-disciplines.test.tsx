import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { DisciplinesSection } from "~/components/courses/DisciplinesSection";
import { ActivitiesSection } from "~/components/courses/ActivitiesSection";
import type { CourseData } from "~/lib/courses/types";
import { alignedCourse } from "../courses/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderIn(node: ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{node}</> }]);
  return render(<Stub initialEntries={["/"]} />);
}

const withDisciplines = (): CourseData => {
  const d = alignedCourse();
  d.disciplines = [
    { id: "web", name: "Webtech", teacher: "Sanne", hoursPerWeek: 6 },
    { id: "hw", name: "Hardware" },
  ];
  d.activities[0] = { ...d.activities[0]!, disciplineId: "web" };
  return d;
};

// Seam: the rendered sections, by role and label; forms post without JavaScript.
describe("Disciplines (optional)", () => {
  it("explains they are optional and offers a form to add one", async () => {
    const { container } = renderIn(<DisciplinesSection data={alignedCourse()} />);
    const region = screen.getByRole("region", { name: "Disciplines" });
    expect(within(region).getByText(/optioneel/i)).toBeVisible();
    const add = within(region).getByRole("button", { name: "Discipline toevoegen" });
    const form = add.closest("form") as HTMLFormElement;
    expect(form.querySelector('input[name="intent"]')).toHaveValue("add-discipline");
    expect(within(form).getByLabelText("Naam")).toBeRequired();
    expect(within(form).getByLabelText("Docent")).not.toBeRequired();
    expect(within(form).getByLabelText("Uren per week")).not.toBeRequired();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("lists each discipline with its teacher and hours, editable and removable", async () => {
    const { container } = renderIn(<DisciplinesSection data={withDisciplines()} />);
    const region = screen.getByRole("region", { name: "Disciplines" });
    expect(within(region).getByText("Webtech")).toBeVisible();
    expect(within(region).getByText(/Sanne · 6 uur per week/)).toBeVisible();
    expect(
      within(region).getByRole("button", { name: /Verwijderen\W+Webtech/ }),
    ).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("asks a lesson's discipline only when the course has disciplines, and shows it", async () => {
    renderIn(<ActivitiesSection data={alignedCourse()} />);
    expect(screen.queryByLabelText("Discipline")).toBeNull();
    const { container } = renderIn(<ActivitiesSection data={withDisciplines()} />);
    const regions = screen.getAllByRole("region", { name: "Onderwijsactiviteiten" });
    const region = regions[regions.length - 1]!;
    const selects = within(region).getAllByLabelText("Discipline");
    // One per existing activity, plus the form for a new one.
    expect(selects).toHaveLength(3);
    expect(selects[0]).toHaveValue("web");
    expect(within(selects[2]!).getByRole("option", { name: "Geen" })).toHaveValue("");
    expect(within(region).getAllByText(/Webtech/).length).toBeGreaterThan(0);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
