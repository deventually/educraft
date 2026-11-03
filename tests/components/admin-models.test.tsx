import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminModels from "~/routes/admin.models";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const loaderData = {
  rows: [
    { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", checked: true, group: "frontier" },
    { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", checked: true, group: "frontier" },
    // P14: local/CLI models are curatable here too, grouped by origin.
    { id: "claude-code", displayName: "Claude Code (CLI)", checked: true, group: "cli" },
    { id: "ollama::gemma", displayName: "Ollama · gemma", checked: false, group: "local" },
  ],
  // The whole catalogue (a teacher's own set may exceed the instance set) + per-teacher rows.
  base: [
    { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5" },
    { id: "claude-code", displayName: "Claude Code (CLI)" },
    { id: "ollama::gemma", displayName: "Ollama · gemma" },
  ],
  teachers: [
    {
      id: "t1",
      name: "Teacher One",
      email: "t1@example.com",
      mode: "own",
      models: ["claude-haiku-4-5"],
    },
    { id: "t2", name: "Teacher Two", email: null, mode: "inherit", models: [] },
  ],
};

function renderRoute(action?: () => unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof AdminModels>;
  const Stub = createRoutesStub([
    {
      path: "/admin/models",
      Component: () => (
        <ToastProvider>
          <AdminModels {...props} />
        </ToastProvider>
      ),
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

  it("[P14] renders local/CLI models as instance toggles too", () => {
    renderRoute();
    const instance = screen.getByRole("group", { name: /beschikbaar voor gebruikers/i });
    const cli = within(instance).getByLabelText("Claude Code (CLI)") as HTMLInputElement;
    const local = within(instance).getByLabelText("Ollama · gemma") as HTMLInputElement;
    expect(cli.checked).toBe(true); // enabled instance-wide
    expect(local.checked).toBe(false); // discovered but not yet enabled
  });

  it("pre-checks a teacher's own set", () => {
    renderRoute();
    expect(screen.getByText("Teacher One")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Teacher One" });
    const haiku = within(group).getByLabelText("Claude Haiku 4.5") as HTMLInputElement;
    const sonnet = within(group).getByLabelText("Claude Sonnet 4.6") as HTMLInputElement;
    expect(haiku.checked).toBe(true); // in the own set
    expect(sonnet.checked).toBe(false); // not in the own set
  });

  it("offers inherit/own per teacher; checkboxes are disabled while inheriting", async () => {
    const user = userEvent.setup();
    renderRoute();
    const one = screen.getByRole("group", { name: "Teacher One" });
    const two = screen.getByRole("group", { name: "Teacher Two" });
    const oneOwn = within(one).getByRole("radio", { name: /eigen keuze/i }) as HTMLInputElement;
    const twoInherit = within(two).getByRole("radio", {
      name: /volgt de instelling/i,
    }) as HTMLInputElement;
    expect(oneOwn.checked).toBe(true);
    expect(twoInherit.checked).toBe(true);
    // Own: boxes are usable. Inherit: boxes are disabled.
    expect((within(one).getByLabelText("Claude Haiku 4.5") as HTMLInputElement).disabled).toBe(
      false,
    );
    expect((within(two).getByLabelText("Claude Haiku 4.5") as HTMLInputElement).disabled).toBe(
      true,
    );
    // Switching Teacher Two to "own" enables them.
    await user.click(within(two).getByRole("radio", { name: /eigen keuze/i }));
    expect((within(two).getByLabelText("Claude Haiku 4.5") as HTMLInputElement).disabled).toBe(
      false,
    );
  });

  it("lists the whole catalogue for a teacher, not only the instance set", () => {
    renderRoute();
    const group = screen.getByRole("group", { name: "Teacher Two" });
    // "Ollama · gemma" is not enabled instance-wide (checked: false above) but is offered.
    expect(within(group).getByLabelText("Ollama · gemma")).toBeInTheDocument();
    expect(within(group).getByLabelText("Claude Code (CLI)")).toBeInTheDocument();
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
