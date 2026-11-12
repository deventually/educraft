import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { CourseImprovements } from "~/components/courses/CourseImprovements";
import type { CourseData, Improvement } from "~/lib/courses/types";
import { ACT1, alignedCourse, TEST1 } from "../courses/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const points: Improvement[] = [
  {
    id: "p-1",
    text: "Geef de casus een week eerder uit.",
    place: { kind: "activity", id: ACT1 },
    status: "open",
    source: "evaluation",
    run: { studyYear: "2025-2026", phase: "Semester 1" },
  },
  {
    id: "p-2",
    text: "Rooster eerder delen.",
    place: { kind: "assessment", id: "removed" },
    status: "open",
    source: "teacher",
  },
  {
    id: "p-3",
    text: "Toets korter maken.",
    place: { kind: "assessment", id: TEST1 },
    status: "done",
    source: "teacher",
  },
];

function renderBlock(data: CourseData) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <CourseImprovements data={data} /> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

// Seam: the rendered forms, by their labels and buttons; each posts its intent without JavaScript.
describe("CourseImprovements (the Controle tab, P33.1)", () => {
  it("lists the open points on their place, with where they come from", async () => {
    const { container } = renderBlock({ ...alignedCourse(), improvements: points });
    const region = screen.getByRole("region", { name: "Verbeterpunten" });
    expect(within(region).getByText(/gaan mee als je de cursus kopieert/)).toBeVisible();
    const open = within(region).getByRole("list", { name: "Open verbeterpunten" });
    const items = within(open).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Geef de casus een week eerder uit.");
    expect(items[0]).toHaveTextContent("Les of opdracht: Les normaliseren");
    expect(items[0]).toHaveTextContent("Uit de evaluatie");
    expect(items[0]).toHaveTextContent("2025-2026, Semester 1");
    // A place that is gone reads as the whole course.
    expect(items[1]).toHaveTextContent("De hele cursus");

    const finish = within(items[0]!).getByRole("button", { name: "Afgerond" });
    expect(finish).toHaveAccessibleDescription("Geef de casus een week eerder uit.");
    const form = finish.closest("form") as HTMLFormElement;
    expect(form).toHaveAttribute("method", "post");
    expect(form.querySelector('input[name="intent"]')).toHaveValue("set-improvement-status");
    expect(form.querySelector('input[name="id"]')).toHaveValue("p-1");
    expect(form.querySelector('input[name="status"]')).toHaveValue("done");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("keeps the finished points apart, to open again", () => {
    renderBlock({ ...alignedCourse(), improvements: points });
    const done = screen.getByRole("list", { name: "Afgeronde verbeterpunten" });
    expect(within(done).getByText("Toets korter maken.")).toBeInTheDocument();
    const reopen = within(done).getByRole("button", { name: "Weer openen" });
    expect(
      (reopen.closest("form") as HTMLFormElement).querySelector('input[name="status"]'),
    ).toHaveValue("open");
  });

  it("adds an own point on a place in the course", async () => {
    const { container } = renderBlock(alignedCourse());
    expect(screen.getByText("Nog geen open verbeterpunten.")).toBeVisible();
    const text = screen.getByLabelText("Nieuw verbeterpunt");
    expect(text).toBeRequired();
    const place = screen.getByLabelText("Waar hoort het bij?");
    expect(within(place).getByRole("option", { name: "De hele cursus" })).toHaveValue("course");
    expect(within(place).getByRole("option", { name: "Les normaliseren" })).toHaveValue(
      `activity:${ACT1}`,
    );
    expect(within(place).getByRole("option", { name: "Eindopdracht" })).toHaveValue(
      `assessment:${TEST1}`,
    );
    const form = screen.getByRole("button", { name: "Punt toevoegen" }).closest("form")!;
    expect(form.querySelector('input[name="intent"]')).toHaveValue("add-improvement");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("CourseImprovements on a copy for a new run (P33.3)", () => {
  it("puts the open points of an earlier run first, under their own heading", () => {
    renderBlock({
      ...alignedCourse(),
      studyYear: "2026-2027",
      phase: "Semester 1",
      improvements: [
        { ...points[1]!, run: { studyYear: "2026-2027", phase: "Semester 1" } },
        points[0]!,
      ],
    });
    const earlier = screen.getByRole("list", { name: "Uit de vorige uitvoering" });
    expect(within(earlier).getByText("Geef de casus een week eerder uit.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Uit de vorige uitvoering" }),
    ).toBeVisible();
    const now = screen.getByRole("list", { name: "Open verbeterpunten" });
    expect(within(now).getByText("Rooster eerder delen.")).toBeInTheDocument();
  });
});
