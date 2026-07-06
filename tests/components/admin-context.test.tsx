import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminContext from "~/routes/admin.context";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

// Defaults-all: every country and sector pre-checked (nothing configured yet).
const loaderData = {
  countries: [{ id: "NL", checked: true }],
  sectors: [
    { id: "vo", checked: true },
    { id: "mbo", checked: true },
    { id: "hbo", checked: true },
    { id: "wo", checked: true },
  ],
};

function renderRoute(action?: () => unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof AdminContext>;
  const Stub = createRoutesStub([
    {
      path: "/admin/context",
      Component: () => <AdminContext {...props} />,
      action: action ?? (() => ({ saved: true })),
    },
  ]);
  return render(<Stub initialEntries={["/admin/context"]} />);
}

describe("Admin context — instance toggle", () => {
  it("renders a checkbox per country, pre-checked from settings", () => {
    renderRoute();
    // Country labels resolve via COUNTRY_LABELS (Dutch by default in tests).
    const nl = screen.getByLabelText("Nederland") as HTMLInputElement;
    expect(nl.checked).toBe(true);
  });

  it("renders a checkbox per sector, pre-checked from settings", () => {
    renderRoute();
    const hbo = screen.getByLabelText(/hoger beroepsonderwijs/i) as HTMLInputElement;
    const wo = screen.getByLabelText(/wetenschappelijk onderwijs/i) as HTMLInputElement;
    expect(hbo.checked).toBe(true);
    expect(wo.checked).toBe(true);
  });

  it("surfaces the lockout guard when the action rejects an empty selection", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ error: "instance-empty" }));
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
