import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AppShell from "~/components/AppShell";
import { getToolBySlugOrThrow } from "~/lib/registry";

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
function renderShellWithUser(
  user: {
    name: string;
    role: string;
    portfolio?: boolean;
    features?: Partial<Record<string, boolean>>;
  },
  locale: "nl" | "en" = "nl",
) {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      Component: AppShell,
      loader: () => ({ locale, user }),
      children: [{ index: true, Component: () => <p>Tools home</p> }],
    },
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

  it("has a menu item 'BDB/BKE' when the workplace is on for the user (P25, P27)", async () => {
    renderShellWithUser({ name: "T", role: "teacher", portfolio: true });
    const links = await screen.findAllByRole("link", { name: "BDB/BKE" });
    expect(links[0]).toHaveAttribute("href", "/portfolio");
    fireEvent.click(screen.getByRole("button", { name: "Menu openen" }));
    const panel = screen.getByRole("navigation", { name: "Mobiele navigatie" });
    expect(within(panel).getByRole("link", { name: "BDB/BKE" })).toHaveAttribute(
      "href",
      "/portfolio",
    );
  });

  it("leaves 'BDB/BKE' out of menu and footer when the workplace is off (P27)", async () => {
    renderShellWithUser({ name: "T", role: "teacher", portfolio: false });
    await screen.findAllByRole("link", { name: "Cursussen" });
    expect(screen.queryByRole("link", { name: "BDB/BKE" })).toBeNull();
  });

  it("leaves 'Cursussen' out of menu and footer when courses are off for the user (P28.3)", async () => {
    renderShellWithUser({ name: "T", role: "teacher", features: { courses: false } });
    await screen.findAllByRole("link", { name: "Eerder gemaakt" });
    expect(screen.queryByRole("link", { name: "Cursussen" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Onderwijs" })).toBeNull();
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

  it("leaves its header and footer off a printed page (P30.2)", () => {
    renderShell();
    expect(screen.getByRole("banner")).toHaveClass("print:hidden");
    expect(screen.getByRole("contentinfo")).toHaveClass("print:hidden");
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
            loader: () => ({ tool: getToolBySlugOrThrow("mentorai") }),
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

  it("keeps the footer on a tool that is not a chat", async () => {
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: AppShell,
        children: [
          {
            path: "tools/:slug",
            loader: () => ({ tool: getToolBySlugOrThrow("cognitive-architect") }),
            Component: () => <p>Stages tool</p>,
          },
        ],
      },
    ]);
    render(<Stub initialEntries={["/tools/cognitive-architect"]} />);
    await screen.findByText("Stages tool");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
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
            loader: () => ({ tool: getToolBySlugOrThrow("mentorai") }),
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

  it("anchors hidden screen-reader text in the scroll region, so a page never scrolls past its footer", async () => {
    const { container } = renderShell();
    const scrollRegion = container.querySelector("#top")?.parentElement;
    // An sr-only element without a positioned ancestor is placed against the viewport
    // and can make the whole document scroll beyond the footer.
    expect(scrollRegion?.className.split(/\s+/)).toContain("relative");
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

/** The top-level items of a header nav, in order: a link's or a submenu button's text. */
const topItems = (nav: HTMLElement) =>
  Array.from(nav.querySelectorAll(":scope > ul > li > :is(a, button)")).map((el) => el.textContent);

describe("AppShell main menu (plan eenvoudiger beheer en navigatie)", () => {
  it("shows Start, Onderwijs, BDB/BKE and Tools for a teacher", async () => {
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: true });
    await screen.findByText("Tools home");
    const primary = screen.getByRole("navigation", { name: "Hoofdnavigatie" });
    expect(topItems(primary)).toEqual(["Start", "Onderwijs", "BDB/BKE", "Tools"]);
    expect(within(primary).getByRole("link", { name: "Start" })).toHaveAttribute("href", "/start");
    expect(within(primary).getByRole("link", { name: "BDB/BKE" })).toHaveAttribute(
      "href",
      "/portfolio",
    );
  });

  it("leaves BDB/BKE out when the workplace is off", async () => {
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: false });
    await screen.findByText("Tools home");
    const primary = screen.getByRole("navigation", { name: "Hoofdnavigatie" });
    expect(topItems(primary)).toEqual(["Start", "Onderwijs", "Tools"]);
  });

  it("opens Onderwijs on a click, with courses and programmes", async () => {
    const user = userEvent.setup();
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: true });
    await screen.findByText("Tools home");
    const primary = screen.getByRole("navigation", { name: "Hoofdnavigatie" });
    const button = within(primary).getByRole("button", { name: "Onderwijs" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
    expect(panel).not.toBeNull();
    const links = within(panel!).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/courses", "/programmes"]);
    // The line under a link describes it; the link's name stays short.
    expect(within(panel!).getByRole("link", { name: "Opleidingen" })).toHaveAccessibleDescription(
      "Per opleiding de cursussen en leerlijnen",
    );
  });

  it("opens Tools on all tools, utilities, assessment models and earlier work", async () => {
    const user = userEvent.setup();
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: true });
    await screen.findByText("Tools home");
    const primary = screen.getByRole("navigation", { name: "Hoofdnavigatie" });
    await user.click(within(primary).getByRole("button", { name: "Tools" }));
    expect(
      within(primary)
        .getAllByRole("link")
        .map((l) => l.getAttribute("href")),
    ).toEqual(["/start", "/portfolio", "/tools", "/utilities", "/assessment-models", "/projects"]);
  });

  it("keeps one submenu open at a time", async () => {
    const user = userEvent.setup();
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: true });
    await screen.findByText("Tools home");
    const primary = screen.getByRole("navigation", { name: "Hoofdnavigatie" });
    const onderwijs = within(primary).getByRole("button", { name: "Onderwijs" });
    const tools = within(primary).getByRole("button", { name: "Tools" });
    await user.click(onderwijs);
    await user.click(tools);
    expect(onderwijs).toHaveAttribute("aria-expanded", "false");
    expect(tools).toHaveAttribute("aria-expanded", "true");
  });

  it("closes a submenu on Escape and returns focus to its button", async () => {
    const user = userEvent.setup();
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: true });
    await screen.findByText("Tools home");
    const primary = screen.getByRole("navigation", { name: "Hoofdnavigatie" });
    const button = within(primary).getByRole("button", { name: "Onderwijs" });
    await user.click(button);
    await user.keyboard("{ArrowDown}");
    expect(within(primary).getByRole("link", { name: "Cursussen" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("shows the same items in the mobile menu, a submenu as a heading over its links", async () => {
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: true });
    await screen.findByText("Tools home");
    fireEvent.click(screen.getByRole("button", { name: "Menu openen" }));
    const mobile = screen.getByRole("navigation", { name: "Mobiele navigatie" });
    expect(within(mobile).getByText("Onderwijs")).toBeInTheDocument();
    expect(
      within(mobile)
        .getAllByRole("link")
        .map((l) => l.getAttribute("href")),
    ).toEqual([
      "/start",
      "/courses",
      "/programmes",
      "/portfolio",
      "/tools",
      "/utilities",
      "/assessment-models",
      "/projects",
      "/account",
      "/context-profiles",
      "/usage",
    ]);
  });

  it("keeps the personal pages in the account menu: account, own context, own AI use", async () => {
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: true });
    await screen.findByText("Tools home");
    const menu = screen.getByRole("navigation", { name: "Account" });
    expect(
      within(menu)
        .getAllByRole("link")
        .map((l) => [l.textContent, l.getAttribute("href")]),
    ).toEqual([
      ["Account", "/account"],
      ["Mijn onderwijscontext", "/context-profiles"],
      ["Mijn AI-gebruik", "/usage"],
    ]);
  });

  it("makes Help a question mark at the top right, and keeps it in the footer", async () => {
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: true });
    await screen.findByText("Tools home");
    const primary = screen.getByRole("navigation", { name: "Hoofdnavigatie" });
    expect(within(primary).queryByRole("link", { name: "Help" })).toBeNull();
    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
  });

  it("keeps 'Eerder gemaakt' and Onderwijscontext in the footer; no route disappears", async () => {
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: true });
    await screen.findByText("Tools home");
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Eerder gemaakt" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(within(footer).getByRole("link", { name: "Onderwijscontext" })).toHaveAttribute(
      "href",
      "/context-profiles",
    );
    expect(within(footer).getByRole("link", { name: "Beoordelingsmodellen" })).toHaveAttribute(
      "href",
      "/assessment-models",
    );
  });

  it("keeps Over in the footer, not in the menu", async () => {
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: true });
    await screen.findByText("Tools home");
    const primary = screen.getByRole("navigation", { name: "Hoofdnavigatie" });
    expect(within(primary).queryByRole("link", { name: "Over" })).toBeNull();
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Over" })).toHaveAttribute("href", "/about");
  });

  it("renders the menu in English", async () => {
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: true }, "en");
    await screen.findByText("Tools home");
    const primary = screen.getByRole("navigation", { name: "Main navigation" });
    expect(topItems(primary)).toEqual(["Start", "Education", "BDB/BKE", "Tools"]);
  });

  it("has no a11y violations with a submenu open", async () => {
    const user = userEvent.setup();
    const { container } = renderShellWithUser({ name: "Teacher T", role: "teacher" });
    await screen.findByText("Tools home");
    await user.click(screen.getByRole("button", { name: "Onderwijs" }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations with the mobile menu open", async () => {
    const { container } = renderShellWithUser({
      name: "Teacher T",
      role: "teacher",
      portfolio: true,
    });
    await screen.findByText("Tools home");
    fireEvent.click(screen.getByRole("button", { name: "Menu openen" }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("AppShell teaching-context visibility by role", () => {
  it("shows no Cohorten link for a teacher", async () => {
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: true });
    await screen.findByText("Tools home");
    expect(screen.queryByRole("link", { name: "Cohorten" })).toBeNull();
  });

  it("keeps the Onderwijscontext link for a teacher", async () => {
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: true });
    await screen.findByText("Tools home");
    expect(screen.getAllByRole("link", { name: "Onderwijscontext" }).length).toBeGreaterThan(0);
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
  it("adds Beheer first for an admin", async () => {
    renderShellWithUser({ name: "Admin A", role: "admin", portfolio: true });
    await screen.findByText("Tools home");
    const primary = screen.getByRole("navigation", { name: "Hoofdnavigatie" });
    expect(topItems(primary)).toEqual(["Beheer", "Start", "Onderwijs", "BDB/BKE", "Tools"]);
  });

  it("opens Beheer on the overview and its four groups", async () => {
    const user = userEvent.setup();
    renderShellWithUser({ name: "Admin A", role: "admin", portfolio: true });
    await screen.findByText("Tools home");
    const button = screen.getByRole("button", { name: "Beheer" });
    await user.click(button);
    const panel = document.getElementById(button.getAttribute("aria-controls") ?? "")!;
    expect(within(panel).getByRole("link", { name: "Overzicht en inrichten" })).toHaveAttribute(
      "href",
      "/admin",
    );
    for (const group of ["Mensen", "Organisatie", "AI", "Controle"])
      expect(within(panel).getByRole("list", { name: group })).toBeInTheDocument();
    expect(
      within(within(panel).getByRole("list", { name: "Organisatie" }))
        .getAllByRole("link")
        .map((l) => l.getAttribute("href")),
    ).toEqual(["/admin/organisation", "/admin/context"]);
  });

  it("hides Beheer for a teacher", async () => {
    renderShellWithUser({ name: "Teacher T", role: "teacher", portfolio: true });
    await screen.findByText("Tools home");
    expect(screen.queryByRole("button", { name: "Beheer" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Beheer" })).toBeNull();
  });

  it("has no a11y violations with Beheer open", async () => {
    const user = userEvent.setup();
    const { container } = renderShellWithUser({ name: "Admin A", role: "admin" });
    await screen.findByText("Tools home");
    await user.click(screen.getByRole("button", { name: "Beheer" }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("offers an admin no view-as switch", async () => {
    renderShellWithUser({ name: "Admin A", role: "admin", portfolio: true });
    await screen.findByText("Tools home");
    expect(screen.queryByRole("button", { name: /Bekijk als docent|View as teacher/ })).toBeNull();
  });

  it("has no a11y violations for an admin", async () => {
    const { container } = renderShellWithUser({
      name: "Admin A",
      role: "admin",
    });
    await screen.findByText("Tools home");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("AppShell navigation a11y", () => {
  it("renders a skip link as the first focusable element, targeting #top", () => {
    renderShell();
    const skip = screen.getByRole("link", { name: "Naar hoofdinhoud" });
    expect(skip).toHaveAttribute("href", "#top");
    // First in DOM/tab order — before the logo and everything else.
    expect(screen.getAllByRole("link")[0]).toBe(skip);
    // Its target is focusable so activating it moves focus into the content.
    const main = document.querySelector("main#top");
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("does not announce or steal focus on initial mount", () => {
    renderShell();
    expect(screen.getByRole("status").textContent).toBe("");
    expect(document.activeElement).not.toBe(document.querySelector("main#top"));
  });

  it("announces the new page title and moves focus to main after client navigation", async () => {
    const user = userEvent.setup();
    renderShell("/");
    const announcer = screen.getByRole("status");
    expect(announcer.textContent).toBe("");

    // RR meta sets document.title post-navigation; simulate that here.
    document.title = "Onderwijscontext — LimeOnIt";
    await user.click(screen.getAllByRole("link", { name: "Onderwijscontext" })[0]!);
    await screen.findByText("Teaching context page");

    const main = document.querySelector("main#top");
    await waitFor(() => expect(document.activeElement).toBe(main));
    await waitFor(() => expect(announcer).toHaveTextContent("Onderwijscontext — LimeOnIt"));
  });

  it("has no a11y violations with the skip link and announcer present", async () => {
    const { container } = renderShell();
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

  it("has no link to a contact page", () => {
    renderShell();
    expect(document.querySelector('a[href="/contact"]')).toBeNull();
  });
});

describe("AppShell account menu (P27.3)", () => {
  it("has no a11y violations with the account menu open", async () => {
    const { container } = renderShellWithUser({ name: "Teacher T", role: "teacher" });
    await screen.findByText("Tools home");
    fireEvent.click(screen.getByText("Teacher T"));
    expect(container.querySelector("details")).toHaveAttribute("open");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
