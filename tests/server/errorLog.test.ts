import { describe, it, expect, beforeEach, vi } from "vitest";
import { RouterContextProvider, data } from "react-router";
import {
  MAX_RECENT_ERRORS,
  clearRecentErrors,
  handleServerError,
  recentErrors,
  recordError,
} from "~/server/errorLog.server";
import { requestIdContext } from "~/server/requestId.server";

const where = { requestId: "req-1", method: "GET", path: "/courses/42" };

function contextWithId(id: string) {
  const context = new RouterContextProvider();
  context.set(requestIdContext, id);
  return context;
}

beforeEach(() => {
  clearRecentErrors();
  vi.restoreAllMocks();
});

describe("recordError: unexpected errors as one JSON line with the request id", () => {
  it("writes one JSON line with event, request id, method, path and the error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    recordError(new TypeError("x is undefined"), where);
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line).toMatchObject({
      event: "unexpected_error",
      requestId: "req-1",
      method: "GET",
      path: "/courses/42",
      name: "TypeError",
      message: "x is undefined",
    });
    expect(line.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(line.stack).toContain("TypeError");
  });

  it("logs the path without the query string (it can carry search terms)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    recordError(new Error("boom"), { ...where, path: "/admin/users?q=anna" });
    expect(recentErrors()[0].path).toBe("/admin/users");
  });

  it("keeps a thrown non-Error readable", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    recordError("plain string", where);
    expect(recentErrors()[0]).toMatchObject({ name: "Error", message: "plain string" });
  });

  it("caps a long message and stack, so one error cannot flood the log", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("a".repeat(5000));
    recordError(err, where);
    const [entry] = recentErrors();
    expect(entry.message.length).toBeLessThanOrEqual(500);
    expect(entry.stack.split("\n").length).toBeLessThanOrEqual(20);
  });

  it("keeps the newest errors first, and only the last few", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < MAX_RECENT_ERRORS + 5; i++) {
      recordError(new Error(`e${i}`), { ...where, requestId: `r${i}` });
    }
    const list = recentErrors();
    expect(list).toHaveLength(MAX_RECENT_ERRORS);
    expect(list[0].requestId).toBe(`r${MAX_RECENT_ERRORS + 4}`);
  });
});

describe("handleServerError (React Router's handleError)", () => {
  it("records an unexpected loader/action/render error with the request's id", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    handleServerError(new Error("db locked"), {
      request: new Request("http://localhost/portfolio/7", { method: "POST" }),
      params: {},
      context: contextWithId("abc"),
    });
    expect(recentErrors()[0]).toMatchObject({
      requestId: "abc",
      method: "POST",
      path: "/portfolio/7",
      message: "db locked",
    });
  });

  it("skips an aborted request (the user navigated away, nothing broke)", () => {
    const ctrl = new AbortController();
    ctrl.abort();
    handleServerError(new Error("aborted"), {
      request: new Request("http://localhost/", { signal: ctrl.signal }),
      params: {},
      context: contextWithId("abc"),
    });
    expect(recentErrors()).toEqual([]);
  });

  it("skips an expected response (a 404 or 403 is not a bug)", () => {
    handleServerError(new Response("Not found", { status: 404 }), {
      request: new Request("http://localhost/x"),
      params: {},
      context: contextWithId("abc"),
    });
    handleServerError(data("nope", { status: 403 }), {
      request: new Request("http://localhost/x"),
      params: {},
      context: contextWithId("abc"),
    });
    expect(recentErrors()).toEqual([]);
  });

  it("still records when no request id is known", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    handleServerError(new Error("early"), {
      request: new Request("http://localhost/"),
      params: {},
      context: new RouterContextProvider(),
    });
    expect(recentErrors()[0].requestId).toBe("-");
  });
});
