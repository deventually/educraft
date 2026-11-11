import { beforeAll, describe, expect, it } from "vitest";
import { signIn, withCookie } from "../helpers/session";
import { flatRoutes } from "../helpers/routes";

let route: typeof import("~/routes/api.ai-limit");
const cookies: Record<string, string> = {};

beforeAll(async () => {
  route = await import("~/routes/api.ai-limit");
  cookies.teacher = await signIn({ id: "alr-teacher", name: "Docent" });
  cookies.admin = await signIn({ id: "alr-admin", role: "admin", name: "Beheer" });
  const usage = await import("~/server/repositories/aiUsage.server");
  const call = {
    source: "lesson-plan",
    model: "claude-sonnet-5-5",
    usage: { input: 10, cacheRead: 0, cacheWrite: 0, output: 10, reasoning: 0 },
    costMicros: 9_000,
  };
  await usage.recordAiUsage("alr-teacher", call, new Date().toISOString().slice(0, 10));
  const repo = await import("~/server/repositories/aiLimits.server");
  await repo.setAiLimit({ kind: "user", id: "alr-teacher" }, 0.01);
});

const load = (who?: string) =>
  route.loader({
    request: withCookie(new Request("http://localhost/api/ai-limit"), who ? cookies[who]! : ""),
    params: {},
    context: {},
  } as never);

describe("/api/ai-limit", () => {
  it("is a resource route without the app shell", () => {
    expect(flatRoutes()).toContainEqual({
      path: "/api/ai-limit",
      file: "routes/api.ai-limit.tsx",
      inShell: false,
    });
  });

  it("gives a teacher their monthly limit as a share, never in euros", async () => {
    const data = await load("teacher");
    expect(data.limit).toMatchObject({ scope: "user", state: "warn" });
    expect(JSON.stringify(data)).not.toMatch(/euros|Micros/);
  });

  it("gives an admin no limit", async () => {
    expect((await load("admin")).limit).toBeNull();
  });

  it("sends a visitor without a session to the login", async () => {
    const res = await Promise.resolve(load()).catch((r: unknown) => r);
    expect((res as Response).headers.get("Location")).toBe("/login");
  });
});
