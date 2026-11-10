import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminLayout from "~/routes/admin";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

async function renderLayout({ isOwner = false } = {}) {
  const Stub = createRoutesStub([
    {
      path: "/admin",
      Component: AdminLayout,
      loader: () => ({
        health: { backup: { state: "none" }, databaseBytes: null, freeDiskBytes: null },
        isOwner,
      }),
      children: [{ path: "users", Component: () => <p>child</p> }],
    },
  ]);
  const view = render(<Stub initialEntries={["/admin/users"]} />);
  await screen.findByRole("navigation", { name: /beheersecties|admin sections/i });
  return view;
}

describe("Admin layout", () => {
  it("shows exactly seven sections in order (Reviewteam after Tools, Logboek last)", async () => {
    await renderLayout();
    const nav = screen.getByRole("navigation", { name: /beheersecties|admin sections/i });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual([
      "Gebruikers",
      "Teams",
      "Tools en modellen",
      "Reviewteam",
      "Onderwijscontext",
      "Gebruik en feedback",
      "Logboek",
    ]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/admin/users",
      "/admin/teams",
      "/admin/tools",
      "/admin/agents",
      "/admin/context",
      "/admin/usage",
      "/admin/audit",
    ]);
  });

  it("adds 'Recente fouten' last, for the owner only", async () => {
    await renderLayout({ isOwner: true });
    const nav = screen.getByRole("navigation", { name: /beheersecties|admin sections/i });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(8);
    expect(links[7]).toHaveTextContent("Recente fouten");
    expect(links[7]).toHaveAttribute("href", "/admin/errors");
  });

  it("shows the health overview above every admin page, with its backup warning", async () => {
    await renderLayout();
    expect(await screen.findByRole("heading", { name: "Gezondheid" })).toBeInTheDocument();
    expect(screen.getByText(/ouder dan 36 uur/)).toBeInTheDocument();
  });

  it("marks the current section", async () => {
    await renderLayout();
    const nav = screen.getByRole("navigation", { name: /beheersecties|admin sections/i });
    expect(within(nav).getByRole("link", { name: "Gebruikers" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("has no a11y violations", async () => {
    const { container } = await renderLayout();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Admin layout help", () => {
  it("links to the help for administrators", async () => {
    await renderLayout();
    expect(screen.getByRole("link", { name: "Hoe werkt dit?" })).toHaveAttribute(
      "href",
      "/help/admin",
    );
  });
});
