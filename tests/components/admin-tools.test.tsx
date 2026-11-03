import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminTools from "~/routes/admin.tools";
import { getToolBySlug } from "~/lib/registry";
import { loc } from "~/lib/i18n/localized";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

// Tool names come from the registry, never from hardcoded titles (P19.1 renamed them).
const first = getToolBySlug("mentorai")!;
const second = getToolBySlug("bloom-by-design")!;
const firstName = loc(first.name, "nl");
const secondName = loc(second.name, "nl");

const loaderData = {
  models: [
    { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", checked: true, group: "frontier" },
    { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", checked: true, group: "frontier" },
    // P14: local/CLI models are curatable here too, grouped by origin.
    { id: "claude-code", displayName: "Claude Code (CLI)", checked: true, group: "cli" },
    { id: "ollama::gemma", displayName: "Ollama · gemma", checked: false, group: "local" },
  ],
  rows: [
    {
      slug: "mentorai",
      name: first.name,
      userType: "student" as const,
      mode: "chat" as const,
      phase: 1 as const,
      enabled: true,
    },
    {
      slug: "bloom-by-design",
      name: second.name,
      userType: "instructor" as const,
      mode: "chat" as const,
      phase: 3 as const,
      enabled: false,
    },
  ],
};

function renderRoute(action?: () => unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof AdminTools>;
  const Stub = createRoutesStub([
    {
      path: "/admin/tools",
      Component: () => (
        <ToastProvider>
          <AdminTools {...props} />
        </ToastProvider>
      ),
      action: action ?? (() => ({ savedSlug: "mentorai", enabled: false })),
    },
  ]);
  return render(<Stub initialEntries={["/admin/tools"]} />);
}

describe("Admin tools", () => {
  it("lists every registry tool with an enabled toggle", () => {
    renderRoute();
    expect(screen.getByText(firstName, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(secondName, { exact: false })).toBeInTheDocument();
    // One enabled checkbox per tool.
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("checkbox")).toHaveLength(2);
  });

  it("renders a labelled checkbox per selectable model, pre-checked from settings", () => {
    renderRoute();
    const instance = screen.getByRole("group", { name: /beschikbaar voor gebruikers/i });
    expect((within(instance).getByLabelText("Claude Sonnet 4.6") as HTMLInputElement).checked).toBe(
      true,
    );
    expect((within(instance).getByLabelText("Claude Haiku 4.5") as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("[P14] renders local/CLI models as instance toggles too", () => {
    renderRoute();
    const instance = screen.getByRole("group", { name: /beschikbaar voor gebruikers/i });
    expect((within(instance).getByLabelText("Claude Code (CLI)") as HTMLInputElement).checked).toBe(
      true,
    );
    expect((within(instance).getByLabelText("Ollama · gemma") as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it("surfaces the empty-selection guard when the action rejects", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ error: true }));
    const instance = screen.getByRole("group", { name: /beschikbaar voor gebruikers/i });
    const form = instance.closest("form")!;
    await user.click(within(form).getByRole("button", { name: /opslaan|save/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/minstens één model|at least one model/i).length).toBeGreaterThan(
        0,
      );
    });
  });

  it("offers no audience select", () => {
    renderRoute();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("confirms a save (mutation) via the per-row form", async () => {
    const user = userEvent.setup();
    renderRoute();
    const table = screen.getByRole("table");
    const [firstSave] = within(table).getAllByRole("button", { name: /opslaan|save/i });
    await user.click(firstSave);
    await waitFor(() => {
      expect(screen.getByText(/opgeslagen|saved/i)).toBeInTheDocument();
    });
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
