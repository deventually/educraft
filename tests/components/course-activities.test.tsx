import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ActivitiesSection } from "~/components/courses/ActivitiesSection";
import type { CourseData } from "~/lib/courses/types";
import { alignedCourse } from "../courses/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderSection(data: CourseData) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <ActivitiesSection data={data} /> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

// Seam: the rendered section, by role and label; forms post without JavaScript.
describe("Lesson goal (optional, one sentence)", () => {
  it("offers an optional goal field with a hint when adding a lesson", async () => {
    const { container } = renderSection(alignedCourse());
    const add = screen.getByRole("button", { name: "Activiteit toevoegen" });
    const form = add.closest("form") as HTMLFormElement;
    const goal = within(form).getByLabelText("Lesdoel");
    expect(goal).toHaveAttribute("name", "goal");
    expect(goal).not.toBeRequired();
    expect(goal).toHaveAccessibleDescription(/één zin/i);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows a lesson's goal and fills it in when editing", async () => {
    const d = alignedCourse();
    d.activities[0] = { ...d.activities[0]!, goal: "Je kunt een ERD lezen." };
    const { container } = renderSection(d);
    const region = screen.getByRole("region", { name: "Onderwijsactiviteiten" });
    expect(within(region).getByText("Je kunt een ERD lezen.")).toBeVisible();
    const goals = within(region).getAllByLabelText("Lesdoel");
    // One per existing activity, plus the form for a new one.
    expect(goals).toHaveLength(3);
    expect(goals[0]).toHaveValue("Je kunt een ERD lezen.");
    expect(goals[2]).toHaveValue("");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
