import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signIn, withCookie } from "../helpers/session";

let route: typeof import("~/routes/admin.errors");
let log: typeof import("~/server/errorLog.server");
let settings: typeof import("~/server/repositories/settings.server");
let cookie: string;

beforeAll(async () => {
  route = await import("~/routes/admin.errors");
  log = await import("~/server/errorLog.server");
  settings = await import("~/server/repositories/settings.server");
  cookie = await signIn({ id: "errors-admin", role: "admin" });
});

beforeEach(() => {
  log.clearRecentErrors();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const load = () =>
  route.loader({
    request: withCookie(new Request("http://localhost/admin/errors"), cookie),
  } as never);

describe("admin errors loader", () => {
  it("gives the owner the recent errors, newest first", async () => {
    await settings.setOwnerUserId("errors-admin");
    log.recordError(new Error("first"), { requestId: "a", method: "GET", path: "/x" });
    log.recordError(new Error("second"), { requestId: "b", method: "GET", path: "/y" });
    const data = await load();
    expect(data.errors.map((e) => e.requestId)).toEqual(["b", "a"]);
    expect(data.max).toBe(log.MAX_RECENT_ERRORS);
    // Times in the school's zone, so they match what the teacher's error page showed.
    expect(data.timeZone).toBe("Europe/Amsterdam");
  });

  it("is a 404 for an admin who is not the owner", async () => {
    await settings.setOwnerUserId("someone-else");
    const thrown = await load().catch((e) => e);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(404);
  });
});
