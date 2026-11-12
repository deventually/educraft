// On the platform address the router lets only /platform, sign-in and two-step verification
// through, so the shell offers only those: no school menu, help or site footer.
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AppShell from "~/components/AppShell";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderShell(platform: boolean) {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      Component: AppShell,
      loader: () => ({ locale: "nl", platform, user: { name: "Bastiaan", role: "admin" } }),
      children: [{ index: true, Component: () => <p>Inhoud</p> }],
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("AppShell on the platform address", () => {
  it("shows only Platform in the menu, desktop and mobile", async () => {
    renderShell(true);
    await screen.findByText("Inhoud");
    const nav = screen.getByRole("navigation", { name: "Hoofdnavigatie" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href")),
    ).toEqual(["/platform"]);
    fireEvent.click(screen.getByRole("button", { name: "Menu openen" }));
    const panel = screen.getByRole("navigation", { name: "Mobiele navigatie" });
    expect(
      within(panel)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href")),
    ).toEqual(["/platform", "/account/2fa"]);
  });

  it("leads the logo to /platform and leaves out help, the school pages and the footer", async () => {
    renderShell(true);
    await screen.findByText("Inhoud");
    expect(screen.getByRole("link", { name: "LimeOnIt" })).toHaveAttribute("href", "/platform");
    expect(screen.queryByRole("link", { name: "Help" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Start" })).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
    expect(screen.getByRole("button", { name: "Uitloggen" })).toBeVisible();
  });

  it("is unchanged on a school's address", async () => {
    renderShell(false);
    await screen.findByText("Inhoud");
    expect(screen.queryByRole("link", { name: "Platform" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Start" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("contentinfo")).toBeVisible();
  });

  it("has no axe violations", async () => {
    const { container } = renderShell(true);
    await screen.findByText("Inhoud");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
