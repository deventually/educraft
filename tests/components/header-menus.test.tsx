import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import AppShell from "~/components/AppShell";

// Seam: the rendered header (roles, names, focus). The two disclosures of the
// header — the account menu and the mobile menu — follow the WAI-ARIA APG
// "disclosure navigation" pattern: Esc and a click outside close them, arrow
// keys move through the links (round-robin), Home/End jump to the ends.

function renderShell() {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      Component: AppShell,
      loader: () => ({ locale: "nl", user: { name: "Teacher T", role: "teacher" } }),
      children: [{ index: true, Component: () => <p>Tools home</p> }],
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

async function openAccountMenu() {
  const user = userEvent.setup();
  const { container } = renderShell();
  await screen.findByText("Tools home");
  const summary = screen.getByText("Teacher T");
  await user.click(summary);
  const details = container.querySelector("details") as HTMLDetailsElement;
  expect(details).toHaveAttribute("open");
  const menu = screen.getByRole("navigation", { name: "Account" });
  return { user, summary, details, menu };
}

async function openMobileMenu() {
  const user = userEvent.setup();
  renderShell();
  await screen.findByText("Tools home");
  await user.click(screen.getByRole("button", { name: "Menu openen" }));
  const panel = screen.getByRole("navigation", { name: "Mobiele navigatie" });
  return { user, panel };
}

const linkNames = (nav: HTMLElement) =>
  Array.from(nav.querySelectorAll("a")).map((a) => a.textContent);

describe("account menu: closing", () => {
  it("closes on Escape and returns focus to its button", async () => {
    const { user, summary, details, menu } = await openAccountMenu();
    (menu.querySelector("a") as HTMLElement).focus();
    await user.keyboard("{Escape}");
    expect(details).not.toHaveAttribute("open");
    expect(summary).toHaveFocus();
  });

  it("closes on a click outside, without stealing the focus", async () => {
    const { user, details } = await openAccountMenu();
    await user.click(screen.getByText("Tools home"));
    expect(details).not.toHaveAttribute("open");
  });

  it("stays open on a click inside", async () => {
    const { details, menu } = await openAccountMenu();
    const user = userEvent.setup();
    await user.click(menu);
    expect(details).toHaveAttribute("open");
  });
});

describe("account menu: arrow keys", () => {
  it("moves to the first link with ArrowDown from the button", async () => {
    const { user, summary, menu } = await openAccountMenu();
    summary.focus();
    await user.keyboard("{ArrowDown}");
    expect(menu.querySelector("a")).toHaveFocus();
  });

  it("moves round-robin with ArrowDown/ArrowUp and jumps with Home/End", async () => {
    const { user, menu } = await openAccountMenu();
    const links = Array.from(menu.querySelectorAll("a"));
    expect(linkNames(menu)).toEqual([
      "Account",
      "Onderwijscontext",
      "Beoordelingsmodellen",
      "Gebruik",
    ]);
    links[0]?.focus();
    await user.keyboard("{ArrowDown}");
    expect(links[1]).toHaveFocus();
    await user.keyboard("{End}");
    expect(links[3]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(links[0]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(links[3]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(links[0]).toHaveFocus();
  });
});

describe("mobile menu", () => {
  it("closes on Escape and returns focus to the menu button", async () => {
    const { user, panel } = await openMobileMenu();
    (panel.querySelector("a") as HTMLElement).focus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "Mobiele navigatie" })).toBeNull();
    expect(screen.getByRole("button", { name: "Menu openen" })).toHaveFocus();
  });

  it("closes on a click outside", async () => {
    const { user } = await openMobileMenu();
    await user.click(screen.getByText("Tools home"));
    expect(screen.queryByRole("navigation", { name: "Mobiele navigatie" })).toBeNull();
  });

  it("does not reopen when the click outside is on its own button", async () => {
    const { user } = await openMobileMenu();
    await user.click(screen.getByRole("button", { name: "Menu sluiten" }));
    expect(screen.queryByRole("navigation", { name: "Mobiele navigatie" })).toBeNull();
  });

  it("moves round-robin through all its links, across both groups", async () => {
    const { user, panel } = await openMobileMenu();
    const links = Array.from(panel.querySelectorAll("a"));
    expect(links.length).toBeGreaterThan(4);
    screen.getByRole("button", { name: "Menu sluiten" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(links[0]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(links.at(-1)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(links[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(links.at(-1)).toHaveFocus();
  });
});

describe("focus is visible on the menu links (WCAG 2.4.7)", () => {
  it("gives every link in the account menu a focus ring", async () => {
    const { menu } = await openAccountMenu();
    for (const link of Array.from(menu.querySelectorAll("a"))) {
      expect(link.className).toContain("focus-visible:ring-2");
    }
  });
});
