import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { HealthPanel, formatBytes } from "~/components/admin/HealthPanel";
import type { AdminHealth } from "~/lib/health";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const GB = 1024 ** 3;
const MB = 1024 ** 2;

function renderPanel(health: AdminHealth) {
  const Stub = createRoutesStub([
    { path: "/admin", Component: () => <HealthPanel health={health} /> },
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
