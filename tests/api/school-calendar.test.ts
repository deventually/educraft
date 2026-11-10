import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type ContextRoute = typeof import("~/routes/admin.context");
type Settings = typeof import("~/server/repositories/settings.server");

let contextRoute: ContextRoute;
let settings: Settings;

beforeAll(async () => {
  [contextRoute, settings] = await Promise.all([
    import("~/routes/admin.context"),
    import("~/server/repositories/settings.server"),
  ]);
  await signInAs({ id: "admin-1", role: "admin", name: "Admin A", email: "admin@example.com" });
});

beforeEach(async () => {
  await settings.setBreakWeeks([]);
});

function post(fields: Record<string, string>): Request {
  return signedRequest("http://localhost/admin/context", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

// biome-ignore lint/suspicious/noExplicitAny: route args ceremony
const call = (fn: (a: any) => unknown, request: Request) =>
  fn({ request, params: {}, context: {} }) as Promise<Record<string, unknown>>;

describe("school calendar settings (P22.1)", () => {
  it("has no break weeks and Europe/Amsterdam on a fresh instance", async () => {
    expect(await settings.getBreakWeeks()).toEqual([]);
    expect(await settings.getTimeZone()).toBe("Europe/Amsterdam");
  });

  it("stores break weeks as sorted Mondays without duplicates", async () => {
    await settings.setBreakWeeks(["2026-12-30", "2026-10-21", "2026-10-19"]);
    expect(await settings.getBreakWeeks()).toEqual(["2026-10-19", "2026-12-28"]);
  });
});

describe("admin.context action — intent calendar", () => {
  it("saves one date per line, any day of the week, blank lines ignored", async () => {
    const res = await call(
      contextRoute.action,
      post({ intent: "calendar", breakWeeks: "2026-10-21\r\n\n 2026-12-21 \n2026-12-28\n" }),
    );
    expect(res).toEqual({ saved: true });
    expect(await settings.getBreakWeeks()).toEqual(["2026-10-19", "2026-12-21", "2026-12-28"]);
  });

  it("clears the list when the field is empty", async () => {
    await settings.setBreakWeeks(["2026-10-19"]);
    await call(contextRoute.action, post({ intent: "calendar", breakWeeks: "" }));
    expect(await settings.getBreakWeeks()).toEqual([]);
  });

  it("refuses a line that is not a real date, and keeps the saved list", async () => {
    await settings.setBreakWeeks(["2026-10-19"]);
    const res = await call(
      contextRoute.action,
      post({ intent: "calendar", breakWeeks: "2026-12-21\n2026-02-30" }),
    );
    expect(res).toEqual({ error: "calendar-invalid" });
    expect(await settings.getBreakWeeks()).toEqual(["2026-10-19"]);
  });

  it("refuses more than 52 weeks", async () => {
    const lines = Array.from({ length: 53 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 5 + 7 * i));
      return d.toISOString().slice(0, 10);
    }).join("\n");
    const res = await call(contextRoute.action, post({ intent: "calendar", breakWeeks: lines }));
    expect(res).toEqual({ error: "calendar-too-many" });
    expect(await settings.getBreakWeeks()).toEqual([]);
  });

  it("loader returns the saved break weeks", async () => {
    await settings.setBreakWeeks(["2026-10-19"]);
    const data = await call(contextRoute.loader, signedRequest("http://localhost/admin/context"));
    expect(data.breakWeeks).toEqual(["2026-10-19"]);
  });
});
