import { describe, it, expect } from "vitest";
import { RouterContextProvider } from "react-router";
import { REQUEST_ID_HEADER, requestIdMiddleware, requestIdOf } from "~/server/requestId.server";

/** The middleware always returns a Response (it wraps `next()`). */
const run = async (a: never, next: () => Promise<Response>): Promise<Response> =>
  (await requestIdMiddleware(a, next)) as Response;

const args = (context = new RouterContextProvider()) =>
  ({ request: new Request("http://localhost/"), params: {}, context }) as never;

describe("request id (one per request)", () => {
  it("gives every request its own id, readable from the context during the request", async () => {
    const context = new RouterContextProvider();
    let seen: string | null = null;
    const res = await run(args(context), async () => {
      seen = requestIdOf(context);
      return new Response("ok");
    });
    expect(seen).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe(seen);
  });

  it("never reuses an id", async () => {
    const ids = new Set<string | null>();
    for (let i = 0; i < 5; i++) {
      const res = await run(args(), async () => new Response("ok"));
      ids.add(res.headers.get(REQUEST_ID_HEADER));
    }
    expect(ids.size).toBe(5);
  });

  it("ignores an id the client sends (it cannot pick its own)", async () => {
    const context = new RouterContextProvider();
    const request = new Request("http://localhost/", {
      headers: { [REQUEST_ID_HEADER]: "forged" },
    });
    const res = await run(
      { request, params: {}, context } as never,
      async () => new Response("ok"),
    );
    expect(res.headers.get(REQUEST_ID_HEADER)).not.toBe("forged");
  });

  it("also sets the header on a response with immutable headers (a redirect)", async () => {
    const res = await run(args(), async () => Response.redirect("http://localhost/login", 302));
    expect(res.status).toBe(302);
    expect(res.headers.get(REQUEST_ID_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns null outside a request (no middleware ran)", () => {
    expect(requestIdOf(new RouterContextProvider())).toBeNull();
    expect(requestIdOf(undefined)).toBeNull();
  });
});

describe("wiring", () => {
  it("runs the request-id middleware first on every route (root)", async () => {
    const root = await import("~/root");
    expect(root.middleware[0]).toBe(requestIdMiddleware);
  });

  it("hands React Router's handleError to the error log (entry.server)", async () => {
    const entry = await import("~/entry.server");
    const { handleServerError } = await import("~/server/errorLog.server");
    expect(entry.handleError).toBe(handleServerError);
  });
});
