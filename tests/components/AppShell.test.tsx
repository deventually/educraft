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
        { path: "settings", Component: () => <p>Teaching context page</p> },
      ],
    },
  ]);
  return render(<Stub initialEntries={[initialPath]} />);
}

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

describe("AppShell top navigation", () => {
  it("labels the context nav item 'Onderwijscontext' (Dutch default)", () => {
    renderShell();
    expect(screen.getAllByRole("link", { name: "Onderwijscontext" }).length).toBeGreaterThan(0);
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
