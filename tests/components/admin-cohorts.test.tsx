import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminCohorts from "~/routes/admin.cohorts";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const loaderData = {
  rows: [
    {
      id: "c1",
      name: "SE jaar 2",
      ownerName: "Teacher T",
      ownerId: "teacher-t",
      toolCount: 2,
      memberCount: 12,
      activeUntil: null,
      teachers: [{ id: "co-1", name: "Co Teacher" }],
    },
  ],
  assignable: [
    { id: "teacher-t", name: "Teacher T" },
    { id: "co-1", name: "Co Teacher" },
    { id: "teacher-x", name: "Teacher X" },
  ],
};

function renderRoute(action?: () => unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof AdminCohorts>;
  const Stub = createRoutesStub([
    {
      path: "/admin/cohorts",
      Component: () => <AdminCohorts {...props} />,
      action: action ?? (() => ({ deleted: true })),
    },
  ]);
  return render(<Stub initialEntries={["/admin/cohorts"]} />);
}

describe("Admin cohorts", () => {
  it("lists every cohort with owner and assigned teachers", () => {
    renderRoute();
    expect(screen.getByText("SE jaar 2")).toBeInTheDocument();
    expect(screen.getByText("Co Teacher")).toBeInTheDocument();
  });

  it("only offers unassigned teachers in the assign dropdown (owner + assignee excluded)", () => {
    renderRoute();
    // Teacher X is the only assignable option (owner + already-assigned filtered out).
    expect(screen.getByRole("option", { name: "Teacher X" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Teacher T" })).toBeNull();
  });

  it("submits a delete only after confirming in the dialog (mutation)", async () => {
    const user = userEvent.setup();
    const action = vi.fn(() => ({ deleted: true }));
    renderRoute(action);
    // Clicking the trigger opens a confirm dialog — it must NOT submit yet.
    await user.click(screen.getByRole("button", { name: "Verwijderen" }));
    expect(action).not.toHaveBeenCalled();
    // Confirming inside the dialog submits.
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Verwijderen" }));
    await waitFor(() => expect(action).toHaveBeenCalled());
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
