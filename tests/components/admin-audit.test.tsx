import { describe, expect, it } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminAudit from "~/routes/admin.audit";
import { AUDIT_ACTIONS } from "~/lib/auditLog";
import { messages } from "~/lib/i18n";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const at = new Date("2026-11-09T09:30:00Z");
const entry = (over: object) => ({
  id: Math.random().toString(36),
  at,
  actorUserId: "owner",
  actorName: "Bastiaan",
  targetUserId: null,
  targetName: null,
  detail: null,
  ...over,
});

const entries = [
  entry({
    action: "roleChanged",
    targetUserId: "u1",
    targetName: "Anna",
    detail: { from: "teacher", to: "admin" },
  }),
  entry({ action: "deactivated", targetUserId: "u2", targetName: "Piet", detail: { bulk: true } }),
  entry({ action: "inviteCreated", detail: { count: 3 } }),
  entry({ action: "accountDeleted", targetUserId: "gone" }),
  entry({
    action: "teacherModelsChanged",
    targetUserId: "u1",
    targetName: "Anna",
    detail: { models: null },
  }),
  entry({ action: "instanceModelsChanged", detail: { models: ["claude-haiku-4-5", "gpt-5"] } }),
];

function renderRoute(data: unknown = { entries, canClean: false }) {
  const props = { loaderData: data } as unknown as ComponentProps<typeof AdminAudit>;
  const Stub = createRoutesStub([
    { path: "/admin/audit", Component: () => <AdminAudit {...props} /> },
  ]);
  return render(<Stub initialEntries={["/admin/audit"]} />);
}

describe("Admin audit log", () => {
  it("has a label for every action, in both languages", () => {
    for (const locale of ["nl", "en"] as const) {
      for (const action of AUDIT_ACTIONS) {
        expect(messages[locale].auditLog.actions[action], `${locale}.${action}`).toBeTruthy();
      }
    }
  });

  it("shows one row per action: when, who, what and for whom", () => {
    renderRoute();
    const table = screen.getByRole("table", { name: /logboek/i });
    const rows = within(table).getAllByRole("row").slice(1); // minus the header row
    expect(rows).toHaveLength(entries.length);
    const first = rows[0]!;
    expect(first).toHaveTextContent("Bastiaan");
    expect(first).toHaveTextContent("Rol gewijzigd");
    expect(first).toHaveTextContent("Docent → Beheerder");
    expect(within(first).getByRole("link", { name: "Anna" })).toHaveAttribute(
      "href",
      "/admin/users/u1",
    );
  });

  it("explains the details: bulk, a count, a deleted account and the model choice", () => {
    renderRoute();
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows[1]).toHaveTextContent("via selectie");
    expect(rows[2]).toHaveTextContent("3 uitnodigingen");
    expect(rows[3]).toHaveTextContent("Verwijderd account");
    expect(rows[4]).toHaveTextContent("Volgt de instantie");
    expect(rows[5]).toHaveTextContent("claude-haiku-4-5, gpt-5");
  });

  it("explains a model price change, and a removed price", () => {
    renderRoute({
      entries: [
        entry({
          action: "modelPriceChanged",
          detail: { models: ["claude-sonnet-5-5"], price: { input: 3, output: 15 } },
        }),
        entry({ action: "modelPriceChanged", detail: { models: ["gpt-5"], price: null } }),
      ],
      canClean: false,
    });
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Prijs van een model gewijzigd");
    expect(rows[0]).toHaveTextContent(
      "claude-sonnet-5-5 · € 3,00 in, € 15,00 uit per miljoen tokens",
    );
    expect(rows[1]).toHaveTextContent("gpt-5 · prijs weggehaald");
  });

  it("says so when nothing has happened yet", () => {
    renderRoute({ entries: [], canClean: false });
    expect(screen.getByText(/nog geen beheeracties/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("explains a cleanup entry", () => {
    renderRoute({
      entries: [entry({ action: "logCleaned", detail: { olderThanDays: 90, count: 4 } })],
      canClean: false,
    });
    const row = within(screen.getByRole("table")).getAllByRole("row")[1]!;
    expect(row).toHaveTextContent("Logboek opgeruimd");
    expect(row).toHaveTextContent("4 regels ouder dan 90 dagen");
  });

  it("offers cleaning up only to the owner, with a choice of how old", async () => {
    renderRoute();
    expect(screen.queryByRole("button", { name: /logboek opruimen/i })).toBeNull();
    renderRoute({ entries, canClean: true });
    await userEvent.click(screen.getByRole("button", { name: /logboek opruimen/i }));
    const dialog = screen.getByRole("dialog");
    const select = within(dialog).getByRole("combobox", { name: /wat verwijderen/i });
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => (o as HTMLOptionElement).value),
    ).toEqual(["30", "90", "180", "all"]);
    // Everyone sees the automatic retention; only the owner gets the button.
    expect(screen.getAllByText(/na een jaar/i).length).toBeGreaterThan(0);
  });

  it("warns loudly that a cleanup cannot be undone, and asks to type a word first", async () => {
    renderRoute({ entries, canClean: true });
    await userEvent.click(screen.getByRole("button", { name: /logboek opruimen/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/niet terug te draaien/i)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: /definitief verwijderen/i });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox"), "OPRUIMEN");
    expect(confirm).toBeEnabled();
  });

  it("has no axe violations, also with the cleanup dialog open", async () => {
    const { container } = renderRoute({ entries, canClean: true });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: /logboek opruimen/i }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
