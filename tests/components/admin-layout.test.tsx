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
        health: {
          backup: { state: "none" },
          databaseBytes: null,
          freeDiskBytes: null,
          version: "1.2.3",
        },
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
  it("opens on the overview, then the sections in four groups", async () => {
    await renderLayout();
    const nav = screen.getByRole("navigation", { name: /beheersecties|admin sections/i });
    expect(within(nav).getByRole("link", { name: "Overzicht en inrichten" })).toHaveAttribute(
      "href",
      "/admin",
    );
    const group = (name: string) =>
      within(within(nav).getByRole("list", { name }))
        .getAllByRole("link")
        .map((a) => [a.textContent, a.getAttribute("href")]);
    expect(group("Mensen")).toEqual([
      ["Gebruikers", "/admin/users"],
      ["Teams", "/admin/teams"],
    ]);
    expect(group("Organisatie")).toEqual([
      ["Faculteiten en opleidingen", "/admin/organisation"],
      ["Onderwijscontext instelling", "/admin/context"],
    ]);
    expect(group("AI")).toEqual([
      ["Tools en modellen", "/admin/tools"],
      ["Reviewteam", "/admin/agents"],
      ["AI-gebruik en kosten", "/usage"],
    ]);
    expect(group("Controle")).toEqual([
      ["Mededelingen", "/admin/announcements"],
      ["Feedback en pilot", "/admin/usage"],
      ["Logboek", "/admin/audit"],
    ]);
  });

  it("adds 'Recente fouten' last, for the owner only", async () => {
    await renderLayout({ isOwner: true });
    const nav = screen.getByRole("navigation", { name: /beheersecties|admin sections/i });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(12);
    expect(links.at(-1)).toHaveTextContent("Recente fouten");
    expect(links.at(-1)).toHaveAttribute("href", "/admin/errors");
  });

  it("marks only the overview current on the overview, not every admin page", async () => {
    const Stub = createRoutesStub([
      {
        path: "/admin",
        Component: AdminLayout,
        loader: () => ({
          health: {
            backup: { state: "none" },
            databaseBytes: null,
            freeDiskBytes: null,
            version: "1",
          },
          isOwner: false,
        }),
        children: [{ index: true, Component: () => <p>overview</p> }],
      },
    ]);
    render(<Stub initialEntries={["/admin"]} />);
    const nav = await screen.findByRole("navigation", { name: /beheersecties|admin sections/i });
    expect(
      within(nav)
        .getAllByRole("link")
        .filter((a) => a.getAttribute("aria-current")),
    ).toEqual([within(nav).getByRole("link", { name: "Overzicht en inrichten" })]);
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
