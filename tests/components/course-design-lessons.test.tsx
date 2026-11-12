import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { expectAiCallId } from "../helpers/aiCall";
import { CourseDesignLessons } from "~/components/courses/CourseDesignLessons";
import type { LessonsProposal } from "~/lib/courses/designLessons";
import type { CourseSchedule } from "~/lib/courses/types";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderStep(
  opts: {
    proposal?: LessonsProposal | null;
    notes?: string;
    schedule?: CourseSchedule;
    onLater?: () => void;
  } = {},
) {
  const Stub = createRoutesStub([
    {
      path: "/courses/:id",
      Component: () => (
        <CourseDesignLessons
          schedule={opts.schedule ?? { weeks: 8, sessionsPerWeek: 2 }}
          proposal={opts.proposal ?? null}
          notes={opts.notes}
          onLater={opts.onLater ?? (() => {})}
        />
      ),
    },
  ]);
  return render(<Stub initialEntries={["/courses/c1"]} />);
}

const proposal: LessonsProposal = {
  outcomes: [
    { id: "lo1", text: "De student ontwerpt een datamodel." },
    { id: "lo2", text: "De student schrijft SQL-queries." },
  ],
  disciplines: [
    { id: "d-web", name: "Webtech" },
    { id: "d-hw", name: "Hardware" },
  ],
  lessons: [
    {
      key: "l1",
      title: "Kennismaken met SQL",
      week: 1,
      kind: "lesson",
      goal: "De student schrijft een eerste SELECT-query.",
      outcomeIds: ["lo2"],
      disciplineId: "d-web",
    },
    {
      key: "l2",
      title: "Opdracht datamodel",
      week: 1,
      kind: "assignment",
      outcomeIds: ["lo1"],
    },
    { key: "l3", title: "Joins", week: 2, kind: "lesson", outcomeIds: ["lo2"] },
  ],
  notes: "Week 8 is de toetsweek.",
  untaught: ["lo1"],
  late: [{ outcomeId: "lo2", assessment: "Beroepsproduct", week: 1 }],
};

describe("CourseDesignLessons (wizard step 3)", () => {
  it("offers to propose a lesson series, with wishes optional", async () => {
    const { container } = renderStep();
    const section = screen.getByRole("region", { name: "Volgende stap: de lessenreeks" });
    const wishes = within(section).getByLabelText("Wensen voor de planning") as HTMLTextAreaElement;
    expect(wishes.required).toBe(false);
    expect(wishes.maxLength).toBe(500);
    // The schedule has weeks and sessions: they are not asked again.
    expect(within(section).queryByLabelText("Aantal weken")).toBeNull();
    const submit = within(section).getByRole("button", { name: "Lessenreeks voorstellen" });
    const form = submit.closest("form")!;
    expect((form.querySelector('input[name="intent"]') as HTMLInputElement).value).toBe(
      "design-lessons",
    );
    await expectAiCallId(submit);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("asks for the weeks and sessions per week while the schedule has none", () => {
    renderStep({ schedule: {} });
    expect((screen.getByLabelText("Aantal weken") as HTMLInputElement).name).toBe("weeks");
    expect((screen.getByLabelText("Lesmomenten per week") as HTMLInputElement).name).toBe(
      "sessionsPerWeek",
    );
  });

  it("shows the proposal per week: lessons ticked, with goal, outcomes and discipline", async () => {
    const { container } = renderStep({ proposal });
    const form = screen.getByRole("form", { name: "AI-voorstel" });
    expect((form.querySelector('input[name="intent"]') as HTMLInputElement).value).toBe(
      "design-lessons-apply",
    );
    expect(within(form).getByText("Week 8 is de toetsweek.")).toBeTruthy();
    expect(within(form).getByRole("heading", { name: "Week 1" })).toBeTruthy();
    expect(within(form).getByRole("heading", { name: "Week 2" })).toBeTruthy();
    const boxes = within(form).getAllByRole("checkbox", { name: "Toevoegen aan de cursus" });
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([true, true, true]);
    const first = within(form).getByRole("group", { name: "Les 1" });
    expect((within(first).getByLabelText("Titel") as HTMLInputElement).value).toBe(
      "Kennismaken met SQL",
    );
    expect((within(first).getByLabelText("Lesdoel") as HTMLTextAreaElement).value).toBe(
      "De student schrijft een eerste SELECT-query.",
    );
    expect((within(first).getByLabelText("Discipline") as HTMLSelectElement).value).toBe("d-web");
    const sql = within(first).getByRole("checkbox", { name: /De student schrijft SQL-queries/ });
    expect((sql as HTMLInputElement).checked).toBe(true);
    expect((sql as HTMLInputElement).value).toBe("lo2");
    expect(
      within(form).getByText(/in geen les: 1\. De student ontwerpt een datamodel\./),
    ).toBeTruthy();
    expect(
      within(form).getByText(/Leeruitkomst 2 wordt in week 1 getoetst \(Beroepsproduct\)/),
    ).toBeTruthy();
    expect(within(form).getByRole("button", { name: "Lessen toevoegen" })).toBeTruthy();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no discipline field when the course has no disciplines", () => {
    renderStep({ proposal: { ...proposal, disciplines: [] } });
    expect(screen.queryByLabelText("Discipline")).toBeNull();
  });

  it("shows what the AI still needs when it proposed nothing", () => {
    renderStep({ notes: "Hoeveel lesmomenten per week?" });
    const box = screen.getByRole("region", { name: "Opmerkingen van de AI" });
    expect(within(box).getByText("Hoeveel lesmomenten per week?")).toBeTruthy();
  });
  it("lets the teacher leave the proposal for later, back on the step's heading", async () => {
    const onLater = vi.fn();
    const { container } = renderStep({ proposal, onLater });
    const form = screen.getByRole("form", { name: "AI-voorstel" });
    const later = within(form).getByRole("button", { name: "Later" });
    expect(later.getAttribute("type")).toBe("button");
    expect(later.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(later.getAttribute("aria-describedby")!)?.textContent).toMatch(
      /blijft hier op Overzicht staan/,
    );
    fireEvent.click(later);
    expect(onLater).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Volgende stap: de lessenreeks" }),
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no Later without a proposal", () => {
    renderStep();
    expect(screen.queryByRole("button", { name: "Later" })).toBeNull();
  });
});
