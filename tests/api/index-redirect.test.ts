import { describe, it, expect, beforeAll } from "vitest";
import { signIn, withCookie } from "../helpers/session";

type IndexRoute = typeof import("~/routes/index");
let route: IndexRoute;

beforeAll(async () => {
  route = await import("~/routes/index");
});

async function loaderWith(role: "admin" | "teacher") {
  const cookie = await signIn({ id: `index-${role}`, role });
  return route.loader({
    request: withCookie(new Request("http://localhost/"), cookie),
    params: {},
    context: {},
  } as never);
}

describe("home redirector", () => {
  it("sends an admin to the user list (home = /admin/users)", async () => {
    const res = (await loaderWith("admin").catch((r) => r)) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin/users");
  });

  it("sends a teacher to Start (P27.3)", async () => {
    const res = (await loaderWith("teacher").catch((r) => r)) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/start");
  });
});
