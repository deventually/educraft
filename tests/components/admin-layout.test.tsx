import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminLayout from "~/routes/admin";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderLayout() {
  const Stub = createRoutesStub([
    {
      path: "/admin",
      Component: AdminLayout,
      children: [{ path: "users", Component: () => <p>child</p> }],
    },
  ]);
  return render(<Stub initialEntries={["/admin/users"]} />);
}

describe("Admin layout", () => {
  it("shows exactly four sections in order", () => {
    renderLayout();
    const nav = screen.getByRole("navigation", { name: /beheersecties|admin sections/i });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual([
      "Gebruikers",
      "Tools en modellen",
      "Onderwijscontext",
      "Gebruik en feedback",
    ]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/admin/users",
      "/admin/tools",
      "/admin/context",
      "/admin/usage",
    ]);
  });

  it("marks the current section", () => {
    renderLayout();
    const nav = screen.getByRole("navigation", { name: /beheersecties|admin sections/i });
    expect(within(nav).getByRole("link", { name: "Gebruikers" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("has no a11y violations", async () => {
    const { container } = renderLayout();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
