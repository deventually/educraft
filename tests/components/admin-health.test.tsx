import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { HealthPanel, formatBytes } from "~/components/admin/HealthPanel";
import type { AdminHealth } from "~/lib/health";
import type { GateHealth } from "~/lib/privacy/gateHealth";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const GB = 1024 ** 3;
const MB = 1024 ** 2;

function renderPanel(health: AdminHealth, gate?: GateHealth) {
  const Stub = createRoutesStub([
    { path: "/admin", Component: () => <HealthPanel health={health} gate={gate} /> },
  ]);
  return render(<Stub initialEntries={["/admin"]} />);
}

describe("formatBytes", () => {
  it("uses MB below a gigabyte and GB above, in the reader's locale", () => {
    expect(formatBytes(12.3 * MB, "nl")).toBe("12,3 MB");
    expect(formatBytes(12.3 * MB, "en")).toBe("12.3 MB");
    expect(formatBytes(2.5 * GB, "nl")).toBe("2,5 GB");
  });
});

describe("HealthPanel (admin only, P1)", () => {
  it("shows the backup age, database size and free disk space under one heading", () => {
    renderPanel({
      backup: { state: "ok", at: "2026-11-08T02:00:00.000Z", ageHours: 10 },
      databaseBytes: 12.3 * MB,
      freeDiskBytes: 2.5 * GB,
      version: "1.2.3",
    });
    expect(screen.getByRole("heading", { name: "Gezondheid" })).toBeInTheDocument();
    expect(screen.getByText("10 uur geleden")).toBeInTheDocument();
    expect(screen.getByText("12,3 MB")).toBeInTheDocument();
    expect(screen.getByText("2,5 GB")).toBeInTheDocument();
    expect(screen.queryByText(/ouder dan 36 uur/)).not.toBeInTheDocument();
  });

  it("names the running version, so a report from a teacher can be tied to a release", () => {
    renderPanel({
      backup: { state: "ok", at: "2026-11-08T02:00:00.000Z", ageHours: 10 },
      databaseBytes: MB,
      freeDiskBytes: GB,
      version: "1.2.3",
    });
    const term = screen.getByText("Versie");
    expect(term.tagName).toBe("DT");
    expect(term.nextElementSibling).toHaveTextContent("1.2.3");
  });

  it("says 'less than an hour' for a fresh backup, not '0 hours'", () => {
    renderPanel({
      backup: { state: "ok", at: "2026-11-09T11:30:00.000Z", ageHours: 0 },
      databaseBytes: MB,
      freeDiskBytes: GB,
      version: "1.2.3",
    });
    expect(screen.getByText("Minder dan een uur geleden")).toBeInTheDocument();
  });

  it("counts in days once a backup is two days old, and warns", () => {
    renderPanel({
      backup: { state: "stale", at: "2026-11-06T02:00:00.000Z", ageHours: 80 },
      databaseBytes: MB,
      freeDiskBytes: GB,
      version: "1.2.3",
    });
    expect(screen.getByText("3 dagen geleden")).toBeInTheDocument();
    expect(screen.getByText(/ouder dan 36 uur/)).toBeInTheDocument();
  });

  it("warns when there is no backup yet", () => {
    renderPanel({
      backup: { state: "none" },
      databaseBytes: MB,
      freeDiskBytes: GB,
      version: "1.2.3",
    });
    expect(screen.getByText("Nog geen back-up")).toBeInTheDocument();
    expect(screen.getByText(/ouder dan 36 uur|nog geen back-up gemaakt/i)).toBeInTheDocument();
  });

  it("says plainly when the built-in backup is off, without a warning", () => {
    renderPanel({
      backup: { state: "off" },
      databaseBytes: null,
      freeDiskBytes: null,
      version: "1.2.3",
    });
    expect(screen.getByText("Ingebouwde back-up staat uit")).toBeInTheDocument();
    expect(screen.getAllByText("Onbekend")).toHaveLength(2);
    expect(screen.queryByText(/ouder dan 36 uur/)).not.toBeInTheDocument();
  });

  it("has no a11y violations, with and without a warning", async () => {
    const { container, unmount } = renderPanel({
      backup: { state: "ok", at: "2026-11-08T02:00:00.000Z", ageHours: 10 },
      databaseBytes: MB,
      freeDiskBytes: GB,
      version: "1.2.3",
    });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    unmount();
    const stale = renderPanel({
      backup: { state: "none" },
      databaseBytes: MB,
      freeDiskBytes: GB,
      version: "1.2.3",
    });
    expect((await axe(stale.container, axeOpts)).violations).toEqual([]);
  });
});

const ok: AdminHealth = {
  backup: { state: "ok", at: "2026-11-08T02:00:00.000Z", ageHours: 10 },
  databaseBytes: MB,
  freeDiskBytes: GB,
  version: "1.2.3",
};
const zero = { recent: 0, previous: 0, spike: false };
const gate: GateHealth = {
  calls: 38,
  stopped: 2,
  kinds: [
    { kind: "teacher", ...zero },
    { kind: "colleague", recent: 12, previous: 9, spike: false },
    { kind: "email", recent: 4, previous: 5, spike: false },
    { kind: "phone", recent: 30, previous: 2, spike: true },
    { kind: "iban", ...zero },
    { kind: "postcode", ...zero },
    { kind: "number", ...zero },
  ],
};

/**
 * The anonymiseerpoort's counters on the health screen (PR 5): per kind how often the gate found
 * something this week and the week before, never a word, and a warning when one kind jumps.
 */
describe("HealthPanel — the anonymiseerpoort's counters", () => {
  it("sums up the week in one line, with the counts per kind behind it", async () => {
    renderPanel(ok, gate);
    const summary = screen.getByText(/38 aanroepen/);
    expect(summary).toHaveTextContent("2 keer eerst aan de docent voorgelegd");
    await userEvent.click(summary);
    const table = screen.getByRole("table", { name: "Gevonden per soort" });
    const row = within(table).getByRole("row", { name: /collega/i });
    expect(within(row).getByText("12")).toBeVisible();
    expect(within(row).getByText("9")).toBeVisible();
  });

  it("warns about a kind that suddenly goes off far more often, outside the fold", () => {
    renderPanel(ok, gate);
    expect(
      screen.getByText(/telefoonnummers: deze week 30 keer, de week ervoor 2 keer/i),
    ).toBeVisible();
  });

  it("shows nothing about the gate when there are no counters", () => {
    renderPanel(ok);
    expect(screen.queryByText(/aanroepen/)).not.toBeInTheDocument();
  });

  it("has no a11y violations, open and closed", async () => {
    const { container } = renderPanel(ok, gate);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await userEvent.click(screen.getByText(/38 aanroepen/));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
