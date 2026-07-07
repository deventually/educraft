import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminModels from "~/routes/admin.models";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const loaderData = {
  rows: [
    { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", checked: true },
    { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", checked: true },
  ],
  // The assignable base (instance-enabled selectable catalog) + per-teacher rows.
  base: [
    { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5" },
  ],
  teachers: [
    { id: "t1", name: "Teacher One", email: "t1@example.com", models: ["claude-haiku-4-5"] },
    { id: "t2", name: "Teacher Two", email: null, models: null },
  ],
};

function renderRoute(action?: () => unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof AdminModels>;
  const Stub = createRoutesStub([
    {
      path: "/admin/models",
      Component: () => <AdminModels {...props} />,
      action: action ?? (() => ({ saved: true })),
    },
  ]);
  return render(<Stub initialEntries={["/admin/models"]} />);
}

describe("Admin models", () => {
  it("renders a labelled checkbox per selectable model, pre-checked from settings", () => {
    renderRoute();
    // Scope to the instance fieldset — teachers repeat the same model labels below.
    const instance = screen.getByRole("group", { name: /beschikbaar voor gebruikers/i });
    const sonnet = within(instance).getByLabelText("Claude Sonnet 4.6") as HTMLInputElement;
    const haiku = within(instance).getByLabelText("Claude Haiku 4.5") as HTMLInputElement;
    expect(sonnet.checked).toBe(true);
    expect(haiku.checked).toBe(true);
  });

  it("renders per-teacher model checkboxes, pre-checked from the assignment (P13)", () => {
    renderRoute();
    expect(screen.getByText("Teacher One")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Teacher One" });
    const haiku = within(group).getByLabelText("Claude Haiku 4.5") as HTMLInputElement;
    const sonnet = within(group).getByLabelText("Claude Sonnet 4.6") as HTMLInputElement;
    expect(haiku.checked).toBe(true); // assigned
    expect(sonnet.checked).toBe(false); // not assigned
  });

  it("shows all models checked for a teacher with no assignment (inherit)", () => {
    renderRoute();
    const group = screen.getByRole("group", { name: "Teacher Two" });
    expect((within(group).getByLabelText("Claude Sonnet 4.6") as HTMLInputElement).checked).toBe(
      true,
    );
    expect((within(group).getByLabelText("Claude Haiku 4.5") as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("surfaces the empty-selection guard when the action rejects", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ error: true }));
    // The first save button is the instance form's (teacher forms add more below).
    await user.click(screen.getAllByRole("button", { name: /opslaan|save/i })[0]);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
