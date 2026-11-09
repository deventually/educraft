import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "file::memory:";

const who = vi.hoisted(() => ({ owner: true }));

vi.mock("~/server/auth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/auth.server")>();
  return {
    ...actual,
    requireRole: vi.fn(async () => ({ id: "admin", role: "admin" })),
    isOwner: vi.fn(async () => who.owner),
  };
});

let route: typeof import("~/routes/admin.errors");
let log: typeof import("~/server/errorLog.server");

beforeAll(async () => {
  route = await import("~/routes/admin.errors");
  log = await import("~/server/errorLog.server");
});

beforeEach(() => {
  log.clearRecentErrors();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const load = () => route.loader({ request: new Request("http://localhost/admin/errors") } as never);

describe("admin errors loader", () => {
  it("gives the owner the recent errors, newest first", async () => {
    who.owner = true;
    log.recordError(new Error("first"), { requestId: "a", method: "GET", path: "/x" });
    log.recordError(new Error("second"), { requestId: "b", method: "GET", path: "/y" });
    const data = await load();
    expect(data.errors.map((e) => e.requestId)).toEqual(["b", "a"]);
    expect(data.max).toBe(log.MAX_RECENT_ERRORS);
  });

  it("is a 404 for an admin who is not the owner", async () => {
    who.owner = false;
    const thrown = await load().catch((e) => e);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(404);
  });
});
