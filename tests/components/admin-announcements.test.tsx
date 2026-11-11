import { describe, expect, it } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminAnnouncements from "~/routes/admin.announcements";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const loaderData = {
  today: "2026-11-11",
  teams: [{ id: "t1", name: "Biologie" }],
  people: [{ id: "u1", name: "Anna", email: "anna@school.nl" }],
  announcements: [
    {
      id: "a1",
      message: "Vanavond onderhoud",
      level: "warning",
      audience: { kind: "all" },
      endsOn: "2026-11-12",
      remindAfterDays: 2,
      active: true,
    },
    {
      id: "a2",
      message: "Welkom team",
      level: "info",
      audience: { kind: "team", id: "t1", name: "Biologie" },
      endsOn: "2026-11-01",
      remindAfterDays: null,
      active: false,
    },
  ],
};

function renderPage(action?: (fd: FormData) => unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof AdminAnnouncements>;
  const Stub = createRoutesStub([
    {
      path: "/admin/announcements",
      Component: () => (
        <ToastProvider>
          <AdminAnnouncements {...props} />
        </ToastProvider>
      ),
      action: async ({ request }) =>
        (action ?? (() => ({ created: true })))(await request.formData()),
    },
  ]);
  return render(<Stub initialEntries={["/admin/announcements"]} />);
}

describe("Admin announcements", () => {
  it("has a labelled form: text, kind, audience, last day and return interval", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Mededelingen" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: /tekst/i })).toBeRequired();
    const kind = screen.getByRole("group", { name: "Soort" });
    expect(within(kind).getByRole("radio", { name: "Mededeling" })).toBeChecked();
    expect(within(kind).getByRole("radio", { name: "Waarschuwing" })).toBeVisible();
    const audience = screen.getByRole("group", { name: "Voor wie" });
    expect(within(audience).getByRole("radio", { name: "Iedereen" })).toBeChecked();
    expect(screen.getByLabelText(/laatste dag/i)).toHaveAttribute("min", "2026-11-11");
    expect(screen.getByLabelText(/terugkomen na/i)).toHaveAttribute("max", "30");
  });

  it("asks for the team or person only when that audience is chosen", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByRole("combobox", { name: "Team" })).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Eén team" }));
    expect(screen.getByRole("combobox", { name: "Team" })).toBeRequired();
    await user.click(screen.getByRole("radio", { name: "Eén persoon" }));
    expect(screen.queryByRole("combobox", { name: "Team" })).toBeNull();
    expect(
      within(screen.getByRole("combobox", { name: "Persoon" }))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toContain("Anna (anna@school.nl)");
  });

  it("places an announcement and reports it in a toast", async () => {
    const user = userEvent.setup();
    let sent: FormData | undefined;
    renderPage((fd) => {
      sent = fd;
      return { created: true };
    });
    await user.type(screen.getByRole("textbox", { name: /tekst/i }), "Storing");
    await user.click(screen.getByRole("radio", { name: "Waarschuwing" }));
    await user.click(screen.getByRole("button", { name: "Plaatsen" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/geplaatst/i));
    expect(sent?.get("intent")).toBe("create");
    expect(sent?.get("message")).toBe("Storing");
    expect(sent?.get("level")).toBe("warning");
    expect(sent?.get("audience")).toBe("all");
  });

  it("lists the announcements with who they are for and whether they still show", () => {
    renderPage();
    const table = screen.getByRole("table", { name: "Geplaatste mededelingen" });
    const first = within(table).getByRole("row", { name: /vanavond onderhoud/i });
    expect(within(first).getByText("Iedereen")).toBeVisible();
    expect(within(first).getByText("Zichtbaar")).toBeVisible();
    expect(within(first).getByText(/terug na 2 dagen/i)).toBeVisible();
    const second = within(table).getByRole("row", { name: /welkom team/i });
    expect(within(second).getByText("Team Biologie")).toBeVisible();
    expect(within(second).getByText("Afgelopen")).toBeVisible();
  });

  it("removes an announcement by its id", async () => {
    const user = userEvent.setup();
    let sent: FormData | undefined;
    renderPage((fd) => {
      sent = fd;
      return { removed: true };
    });
    await user.click(screen.getByRole("button", { name: "Weghalen: Vanavond onderhoud" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/weggehaald/i));
    expect(sent?.get("intent")).toBe("remove");
    expect(sent?.get("id")).toBe("a1");
  });

  it("has no axe violations", async () => {
    const { container } = renderPage();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
