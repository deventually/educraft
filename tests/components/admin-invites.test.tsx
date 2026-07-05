import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminInvites from "~/routes/admin.invites";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const loaderData = {
  origin: "http://localhost",
  selfId: "admin-1",
  tools: [
    { slug: "bloom-by-design", name: { nl: "Bloom by Design", en: "Bloom by Design" } },
    { slug: "arcs-reactor", name: { nl: "ARCS Reactor", en: "ARCS Reactor" } },
  ],
  invites: [
    {
      token: "tok-open",
      role: "teacher",
      note: "Jan de Vries",
      email: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      used: false,
      createdByName: "Admin A",
      cohortName: null,
      createdAt: new Date("2026-07-01T10:00:00Z"),
    },
  ],
  users: [
    { id: "admin-1", name: "Admin A", email: "a@x.nl", role: "admin", createdAt: new Date() },
    { id: "teacher-9", name: "Teacher T", email: "t@x.nl", role: "teacher", createdAt: new Date() },
  ],
};

function renderRoute(action?: () => unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof AdminInvites>;
  const Stub = createRoutesStub([
    {
      path: "/admin/invites",
      Component: () => <AdminInvites {...props} />,
      action: action ?? (() => ({ link: "http://localhost/invite/tok-new" })),
    },
  ]);
  return render(<Stub initialEntries={["/admin/invites"]} />);
}

describe("Admin invites", () => {
  it("reveals the tool allow-list only when 'restrict' is chosen", async () => {
    const user = userEvent.setup();
    renderRoute();
    expect(screen.queryByLabelText("Bloom by Design")).toBeNull();
    await user.click(screen.getByLabelText(/beperk tot|restrict/i));
    expect(screen.getByLabelText("Bloom by Design")).toBeInTheDocument();
  });

  it("mints an invite and shows the copyable link (mutation)", async () => {
    const user = userEvent.setup();
    renderRoute();
    await user.click(screen.getByRole("button", { name: /uitnodiging aanmaken|create invite/i }));
    await waitFor(() => {
      expect(screen.getByText("http://localhost/invite/tok-new")).toBeInTheDocument();
    });
  });

  it("offers a role change for other users but not for the signed-in admin", () => {
    renderRoute();
    // The admin's own row shows no role <select>; only the teacher's does.
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(1);
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
