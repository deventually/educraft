import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AppShell from "~/components/AppShell";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

type Shown = { id: string; message: string; level: "info" | "warning" };

/** The shell with a signed-in teacher whose root loader carries `announcements`. */
function renderShell(announcements: Shown[], onDismiss?: (body: unknown) => void) {
  let current = announcements;
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      Component: AppShell,
      loader: () => ({
        locale: "nl",
        user: { name: "Anna", role: "teacher" },
        announcements: current,
      }),
      children: [{ index: true, Component: () => <p>Startpagina</p> }],
    },
    {
      path: "/api/announcements/dismiss",
      action: async ({ request }) => {
        const body = (await request.json()) as { id: string };
        onDismiss?.(body);
        current = current.filter((a) => a.id !== body.id);
        return Response.json({ ok: true });
      },
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

const region = () => screen.findByRole("region", { name: "Mededelingen van beheer" });

describe("Announcement banner", () => {
  it("shows nothing without announcements", async () => {
    renderShell([]);
    await screen.findByText("Startpagina");
    expect(screen.queryByRole("region", { name: "Mededelingen van beheer" })).toBeNull();
  });

  it("is a named region before the main content, with the level in words", async () => {
    renderShell([
      { id: "w", message: "Vanavond onderhoud", level: "warning" },
      { id: "i", message: "Nieuwe tool", level: "info" },
    ]);
    const banner = await region();
    expect(within(banner).getByText("Vanavond onderhoud")).toBeVisible();
    expect(within(banner).getByText("Let op:")).toBeVisible();
    expect(within(banner).getByText("Mededeling:")).toBeVisible();
    // Before <main> in reading order, so the skip link jumps past it.
    const main = screen.getByRole("main");
    expect(banner.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Not a live region: it is not read again on every page.
    expect(banner.closest("[aria-live]")).toBeNull();
  });

  it("closes one announcement for good and moves focus to the main content", async () => {
    const user = userEvent.setup();
    const sent: unknown[] = [];
    renderShell(
      [
        { id: "w", message: "Vanavond onderhoud", level: "warning" },
        { id: "i", message: "Nieuwe tool", level: "info" },
      ],
      (b) => sent.push(b),
    );
    const banner = await region();
    const buttons = within(banner).getAllByRole("button", { name: "Mededeling sluiten" });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[0]!);
    await waitFor(() => expect(screen.queryByText("Vanavond onderhoud")).toBeNull());
    expect(screen.getByText("Nieuwe tool")).toBeVisible();
    expect(screen.getByRole("main")).toHaveFocus();
    expect(sent).toEqual([{ id: "w" }]);
  });

  it("has no axe violations", async () => {
    const { container } = renderShell([
      { id: "w", message: "Vanavond onderhoud", level: "warning" },
      { id: "i", message: "Nieuwe tool", level: "info" },
    ]);
    await region();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
