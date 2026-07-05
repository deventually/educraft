import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
    const sonnet = screen.getByLabelText("Claude Sonnet 4.6") as HTMLInputElement;
    const haiku = screen.getByLabelText("Claude Haiku 4.5") as HTMLInputElement;
    expect(sonnet.checked).toBe(true);
    expect(haiku.checked).toBe(true);
  });

  it("surfaces the empty-selection guard when the action rejects", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ error: true }));
    await user.click(screen.getByRole("button", { name: /opslaan|save/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
