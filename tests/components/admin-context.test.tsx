import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminContext from "~/routes/admin.context";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

// Defaults-all for the instance; two teachers — one restricted, one unrestricted.
const loaderData = {
  countries: [{ id: "NL", checked: true }],
  sectors: [
    { id: "vo", checked: true },
    { id: "mbo", checked: true },
    { id: "hbo", checked: true },
    { id: "wo", checked: true },
  ],
  teachers: [
    {
      id: "t-restricted",
      name: "Docent Beperkt",
      email: "beperkt@school.nl",
      countries: ["NL"],
      sectors: ["mbo"],
    },
    { id: "t-open", name: "Docent Open", email: null, countries: null, sectors: null },
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

/** The instance-toggle form, scoped so per-teacher forms don't shadow its labels. */
function instanceForm() {
  return within(screen.getByRole("form", { name: "Onderwijscontext" }));
}

describe("Admin context — instance toggle", () => {
  it("renders a checkbox per country, pre-checked from settings", () => {
    renderRoute();
    const nl = instanceForm().getByLabelText("Nederland") as HTMLInputElement;
    expect(nl.checked).toBe(true);
  });

  it("renders a checkbox per sector, pre-checked from settings", () => {
    renderRoute();
    const hbo = instanceForm().getByLabelText(/hoger beroepsonderwijs/i) as HTMLInputElement;
    const wo = instanceForm().getByLabelText(/wetenschappelijk onderwijs/i) as HTMLInputElement;
    expect(hbo.checked).toBe(true);
    expect(wo.checked).toBe(true);
  });

  it("surfaces the lockout guard when the action rejects an empty selection", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ error: "instance-empty" }));
    await user.click(instanceForm().getByRole("button", { name: /opslaan|save/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});

describe("Admin context — per-teacher assignment", () => {
  it("renders one form per teacher carrying its userId + intent", () => {
    renderRoute();
    const form = screen.getByRole("form", { name: "Docent Beperkt" });
    expect(form.querySelector('input[name="intent"]')).toHaveValue("teacher");
    expect(form.querySelector('input[name="userId"]')).toHaveValue("t-restricted");
  });

  it("pre-checks a restricted teacher's assignment only (mbo, not hbo)", () => {
    renderRoute();
    const form = within(screen.getByRole("form", { name: "Docent Beperkt" }));
    const mbo = form.getByLabelText(/middelbaar beroepsonderwijs/i) as HTMLInputElement;
    const hbo = form.getByLabelText(/hoger beroepsonderwijs/i) as HTMLInputElement;
    expect(mbo.checked).toBe(true);
    expect(hbo.checked).toBe(false);
  });

  it("pre-checks everything for an unrestricted teacher (null = all)", () => {
    renderRoute();
    const form = within(screen.getByRole("form", { name: "Docent Open" }));
    const mbo = form.getByLabelText(/middelbaar beroepsonderwijs/i) as HTMLInputElement;
    const hbo = form.getByLabelText(/hoger beroepsonderwijs/i) as HTMLInputElement;
    expect(mbo.checked).toBe(true);
    expect(hbo.checked).toBe(true);
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
