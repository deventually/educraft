import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AppShell from "~/components/AppShell";

function renderShell(initialPath = "/") {
  // AppShell is a layout: it renders <Outlet/>, so stub a child route.
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: AppShell,
      children: [
        { index: true, Component: () => <p>Tools home</p> },
        { path: "context-profiles", Component: () => <p>Teaching context page</p> },
      ],
    },
  ]);
  return render(<Stub initialEntries={[initialPath]} />);
}

/** Render the shell with a signed-in user via a `root` loader (async hydration). */
function renderShellWithUser(user: { name: string; role: string; realRole?: string }) {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      Component: AppShell,
      loader: () => ({ locale: "nl", user }),
      children: [{ index: true, Component: () => <p>Tools home</p> }],
      // A real /set-view route so the admin role-switch form has a valid action.
      // (Sibling resource route: no UI, just absorbs the POST in tests.)
    },
    { path: "/set-view", action: () => null },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

describe("AppShell top navigation", () => {
  it("labels the context nav item 'Onderwijscontext' (Dutch default)", () => {
    renderShell();
    const links = screen.getAllByRole("link", { name: "Onderwijscontext" });
    expect(links.length).toBeGreaterThan(0);
    // The teaching-context page lives at /context-profiles (English URL slug).
    expect(links[0]).toHaveAttribute("href", "/context-profiles");
    // Old label is gone.
    expect(screen.queryByText("Context & instellingen")).toBeNull();
  });

  it("collapses behind a toggle on small screens", () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: "Menu openen" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls");
    // The collapsible panel is not present until opened.
    expect(screen.queryByRole("navigation", { name: "Mobiele navigatie" })).toBeNull();
  });

  it("opens and closes the mobile menu when the toggle is pressed", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Menu openen" }));

    const closeBtn = screen.getByRole("button", { name: "Menu sluiten" });
    expect(closeBtn).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("navigation", { name: "Mobiele navigatie" });
    expect(panel).toBeInTheDocument();
    // The same destinations are reachable from the collapsed panel.
    expect(screen.getAllByRole("link", { name: "Onderwijscontext" }).length).toBeGreaterThan(0);

    fireEvent.click(closeBtn);
    expect(screen.queryByRole("navigation", { name: "Mobiele navigatie" })).toBeNull();
  });

  it("shows the footer on normal pages", () => {
    renderShell();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("hides the footer on a chat tool route so the composer can stay pinned", async () => {
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: AppShell,
        children: [
          { index: true, Component: () => <p>Tools home</p> },
          {
            path: "tools/:slug",
            loader: () => ({ tool: { mode: "chat" } }),
            Component: () => <p>Chat tool</p>,
          },
        ],
      },
    ]);
    render(<Stub initialEntries={["/tools/mentorai"]} />);

    // Wait for the chat route's loader data to resolve and render.
    await screen.findByText("Chat tool");
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("keeps the chat page vertically scrollable so an expanded header is never clipped", async () => {
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: AppShell,
        children: [
          { index: true, Component: () => <p>Tools home</p> },
          {
            path: "tools/:slug",
            loader: () => ({ tool: { mode: "chat" } }),
            Component: () => <p>Chat tool</p>,
          },
        ],
      },
    ]);
    const { container } = render(<Stub initialEntries={["/tools/mentorai"]} />);
    await screen.findByText("Chat tool");

    // The single scroll region wraps the <main id="top"> outlet.
    const scrollRegion = container.querySelector("#top")?.parentElement;
    expect(scrollRegion).not.toBeNull();
    const cls = scrollRegion?.className ?? "";
    // It must allow vertical scrolling and must never clip overflow — a tall,
    // expanded ToolHeader has to remain reachable on a chat route.
    expect(cls).toContain("overflow-y-auto");
    expect(cls).not.toMatch(/overflow-hidden/);
  });

  it("has no a11y violations with the menu closed", async () => {
    const { container } = renderShell();
    const results = await axe(container, axeOpts);
    expect(results.violations).toEqual([]);
  });

  it("has no a11y violations with the menu open", async () => {
    const { container } = renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Menu openen" }));
    const results = await axe(container, axeOpts);
    expect(results.violations).toEqual([]);
  });
});

describe("AppShell user area", () => {
  it("shows the current user's name and a logout control when signed in", async () => {
    renderShellWithUser({ name: "Jan de Vries", role: "teacher" });
    await screen.findByText("Tools home");
    expect(screen.getByText("Jan de Vries")).toBeInTheDocument();
    const logout = screen.getByRole("button", { name: "Uitloggen" });
    expect(logout).toBeInTheDocument();
    // The logout control posts to the /logout resource route.
    expect(logout.closest("form")).toHaveAttribute("action", "/logout");
  });

  it("renders no user area when signed out", () => {
    renderShell();
    expect(screen.queryByRole("button", { name: "Uitloggen" })).toBeNull();
  });

  it("has no a11y violations with the user area shown", async () => {
    const { container } = renderShellWithUser({ name: "Jan de Vries", role: "teacher" });
    await screen.findByText("Tools home");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("AppShell admin surface & role switch", () => {
  it("shows the admin nav link only for the effective admin role", async () => {
    renderShellWithUser({ name: "Admin A", role: "admin", realRole: "admin" });
    await screen.findByText("Tools home");
    expect(screen.getAllByRole("link", { name: "Beheer" }).length).toBeGreaterThan(0);
  });

  it("places the admin link first in the main navigation for an admin", async () => {
    renderShellWithUser({ name: "Admin A", role: "admin", realRole: "admin" });
    await screen.findByText("Tools home");
    const primary = screen.getByRole("navigation", { name: "Hoofdnavigatie" });
    const links = within(primary).getAllByRole("link");
    expect(links[0]).toHaveAccessibleName("Beheer");
  });

  it("hides the admin nav link for a teacher", async () => {
    renderShellWithUser({ name: "Teacher T", role: "teacher" });
    await screen.findByText("Tools home");
    expect(screen.queryByRole("link", { name: "Beheer" })).toBeNull();
  });

  it("offers a real admin the 'view as teacher' switch, posting to /set-view", async () => {
    renderShellWithUser({ name: "Admin A", role: "admin", realRole: "admin" });
    await screen.findByText("Tools home");
    const button = screen.getByRole("button", { name: "Bekijk als docent" });
    expect(button.closest("form")).toHaveAttribute("action", "/set-view");
  });

  it("shows 'back to admin' (and hides the admin link) while an admin views as teacher", async () => {
    renderShellWithUser({ name: "Admin A", role: "teacher", realRole: "admin" });
    await screen.findByText("Tools home");
    expect(screen.getByRole("button", { name: "Terug naar beheer" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Beheer" })).toBeNull();
  });

  it("has no a11y violations with the admin role switch shown", async () => {
    const { container } = renderShellWithUser({
      name: "Admin A",
      role: "admin",
      realRole: "admin",
    });
    await screen.findByText("Tools home");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("AppShell footer extras", () => {
  it("offers a back-to-top link that targets the top of the page", () => {
    renderShell();
    const footer = screen.getByRole("contentinfo");
    const backToTop = within(footer).getByRole("link", { name: "Naar boven" });
    expect(backToTop).toHaveAttribute("href", "#top");
    // The anchor target exists so the link actually scrolls somewhere.
    expect(document.getElementById("top")).not.toBeNull();
  });

  it("surfaces a direct contact email as a mailto link", () => {
    renderShell();
    const footer = screen.getByRole("contentinfo");
    const mail = within(footer).getByRole("link", { name: /@/ });
    expect(mail.getAttribute("href")).toMatch(/^mailto:/);
  });
});
