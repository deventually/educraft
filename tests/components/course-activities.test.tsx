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

describe("Work kept at a lesson", () => {
  it("shows the work made for a lesson at that lesson, with where to open it", async () => {
    const d = alignedCourse();
    const [first, second] = d.activities;
    const work = [
      {
        generationId: "g1",
        itemId: first!.id,
        toolName: { nl: "Les voorbereiden", en: "Prepare a lesson" },
        createdAt: "2026-11-12T10:00:00Z",
      },
      { generationId: "g2", itemId: null, toolName: "Rubric", createdAt: "2026-11-12T10:00:00Z" },
    ];
    const Stub = createRoutesStub([
      { path: "/", Component: () => <ActivitiesSection data={d} work={work} /> },
    ]);
    const { container } = render(<Stub initialEntries={["/"]} />);
    const lesson = container.querySelector(`#item-${first!.id}`) as HTMLElement;
    expect(within(lesson).getByText(/Les voorbereiden/)).toBeVisible();
    expect(within(lesson).getByRole("link", { name: "Bekijk in Eerder gemaakt" })).toHaveAttribute(
      "href",
      "/projects",
    );
    const other = container.querySelector(`#item-${second!.id}`) as HTMLElement;
    expect(within(other).queryByText(/Les voorbereiden/)).toBeNull();
    expect(screen.queryByText(/Rubric/)).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
