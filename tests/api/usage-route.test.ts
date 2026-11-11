import { beforeAll, describe, expect, it } from "vitest";
import { signIn, withCookie } from "../helpers/session";
import { flatRoutes } from "../helpers/routes";

let route: typeof import("~/routes/usage");
let teamId = "";
const cookies: Record<string, string> = {};
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  route = await import("~/routes/usage");
  const usage = await import("~/server/repositories/aiUsage.server");
  const teams = await import("~/server/repositories/teams.server");
  const settings = await import("~/server/repositories/settings.server");
  for (const id of ["use-teacher", "use-lead", "use-m1", "use-m2"]) {
    cookies[id] = await signIn({ id, name: `Naam ${id}` });
  }
  cookies.admin = await signIn({ id: "use-admin", role: "admin", name: "Beheer" });
  cookies.owner = await signIn({ id: "use-owner", role: "admin", name: "Eigenaar" });
  await settings.setOwnerUserId("use-owner");

  const team = await teams.createTeam("Gebruik team");
  teamId = team.id;
  for (const id of ["use-lead", "use-m1", "use-m2"]) await teams.addMember(teamId, id);
  await teams.setLead(teamId, "use-lead", true);

  const call = {
    source: "lesson-plan",
    model: "claude-sonnet-5-5",
    usage: { input: 100, cacheRead: 900, cacheWrite: 0, output: 50, reasoning: 0 },
    costMicros: 2_000,
  };
  for (const id of ["use-teacher", "use-lead", "use-m1", "use-m2"]) {
    await usage.recordAiUsage(id, call, today);
  }
});

const load = (who: string, q = "") =>
  route.loader({
    request: withCookie(new Request(`http://localhost/usage${q}`), cookies[who] ?? ""),
  } as never);

describe("/usage", () => {
  it("is a page in the app shell", () => {
    expect(flatRoutes()).toContainEqual({
      path: "/usage",
      file: "routes/usage.tsx",
      inShell: true,
    });
  });

  it("sends a visitor without a session to the login", async () => {
    const res = await route
      .loader({ request: new Request("http://localhost/usage") } as never)
      .catch((r: unknown) => r);
    expect((res as Response).headers.get("Location")).toBe("/login");
  });

  it("shows a teacher their own use and quota, no money and nobody else", async () => {
    const data = await load("use-teacher");
    expect(data.month).toBe(today.slice(0, 7));
    expect(data.own.calls).toBe(1);
    expect(data.own.sources).toEqual([{ key: "lesson-plan", calls: 1 }]);
    expect(data.own.quota?.limit).toBeGreaterThan(0);
    expect(data.teams).toEqual([]);
    expect(data.instance).toBeNull();
    expect(data.money).toBeNull();
    expect(JSON.stringify(data)).not.toContain("costMicros");
  });

  it("adds a lead's team as totals, without names or money", async () => {
    const data = await load("use-lead");
    expect(data.teams).toHaveLength(1);
    expect(data.teams[0]).toMatchObject({ id: teamId, activeMembers: 3, calls: 3 });
    expect(data.teams[0]?.sources).toEqual([{ key: "lesson-plan", calls: 3 }]);
    const json = JSON.stringify(data);
    expect(json).not.toContain("use-m1");
    expect(json).not.toContain("costMicros");
  });

  it("gives an admin everyone, per person and with costs, but no forecast", async () => {
    const data = await load("admin");
    expect(data.own.quota).toBeNull(); // admins are exempt
    expect(data.instance?.total.calls).toBe(4);
    expect(data.instance?.total.costMicros).toBe(8_000);
    expect(data.instance?.cacheShare).toBe(0.9);
    expect(data.instance?.users.map((u) => u.label)).toContain("Naam use-m1");
    expect(data.money).toBeNull();
    // Most used first.
    const calls = data.instance?.sources.map((x) => x.calls) ?? [];
    expect(calls).toEqual([...calls].sort((a, b) => b - a));
    // Providers and models carry the provider's name from the catalog, not its id.
    expect(data.instance?.providers[0]?.label).toBe("Anthropic (Claude)");
    expect(data.instance?.models[0]).toMatchObject({
      name: "Claude Sonnet 5.5",
      label: "Anthropic (Claude)",
    });
  });

  it("gives the owner the forecast and what caching saved too", async () => {
    const data = await load("owner");
    expect(data.money?.forecastMicros).toBeGreaterThanOrEqual(8_000);
    // 3,600 cache tokens at the catalog's Sonnet rates: a saving, not a cost.
    expect(data.money?.savingsMicros).toBeGreaterThan(0);
  });

  it("falls back to the current month for an unknown ?month", async () => {
    expect((await load("use-teacher", "?month=1999-01")).month).toBe(today.slice(0, 7));
  });
});
