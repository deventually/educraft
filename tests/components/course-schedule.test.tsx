import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { CourseSchedule } from "~/components/courses/CourseSchedule";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderSchedule(schedule?: Parameters<typeof CourseSchedule>[0]["schedule"]) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <CourseSchedule schedule={schedule} /> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

// Seam: the rendered form, by its labels; it posts `set-schedule` without JavaScript.
describe("CourseSchedule (the course's rhythm)", () => {
  it("asks for the rhythm once, all optional, in a form that works without JavaScript", async () => {
    const { container } = renderSchedule();
    const region = screen.getByRole("region", { name: "Lesrooster" });
    for (const label of [
      "Aantal weken",
      "Lesmomenten per week",
      "Duur van een lesmoment (minuten)",
      "Groepsgrootte",
    ])
      expect(within(region).getByLabelText(label)).not.toBeRequired();
    expect(within(region).getByLabelText("Contactvorm")).toHaveDisplayValue("Niet ingevuld");
    const form = within(region)
      .getByRole("button", { name: "Opslaan" })
      .closest("form") as HTMLFormElement;
    expect(form).toHaveAttribute("method", "post");
    expect(form.querySelector('input[name="intent"]')).toHaveValue("set-schedule");
    expect(within(region).getByText(/Les voorbereiden/)).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows what is filled in", () => {
    renderSchedule({
      weeks: 10,
      sessionsPerWeek: 3,
      sessionMinutes: 240,
      groupSize: 28,
      deliveryMode: "online",
    });
    expect(screen.getByLabelText("Aantal weken")).toHaveValue("10");
    expect(screen.getByLabelText("Lesmomenten per week")).toHaveValue("3");
    expect(screen.getByLabelText("Duur van een lesmoment (minuten)")).toHaveValue("240");
    expect(screen.getByLabelText("Groepsgrootte")).toHaveValue("28");
    expect(screen.getByLabelText("Contactvorm")).toHaveDisplayValue("Live online");
  });
});
