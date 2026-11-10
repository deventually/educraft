// The role agents' admin page (/admin/agents): the main switch (the `roleAgents` feature)
// and per hat On / Off on the instance. An untouched hat is on.
import { beforeAll, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { AGENTS } from "~/lib/agents/registry";

process.env.DATABASE_URL = "file::memory:";

let route: typeof import("~/routes/admin.agents");
let settings: typeof import("~/server/repositories/settings.server");

beforeAll(async () => {
  route = await import("~/routes/admin.agents");
  settings = await import("~/server/repositories/settings.server");
  await signInAs({ id: "admin-1", role: "admin" });
});

function post(fields: Record<string, string>) {
  const request = signedRequest("http://localhost/admin/agents", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
  return route.action({ request, params: {}, context: {} } as never) as Promise<unknown>;
}

const load = () =>
  route.loader({
    request: signedRequest("http://localhost/admin/agents"),
    params: {},
    context: {},
  } as never) as Promise<{
    main: string;
    agents: { id: string; role: { nl: string }; watches: string[]; stand: string }[];
  }>;

describe("admin.agents", () => {
  it("lists every hat as on and the main switch at its default", async () => {
    const data = await load();
    expect(data.main).toBe("on");
    expect(data.agents.map((a) => [a.id, a.stand])).toEqual(AGENTS.map((a) => [a.id, "on"]));
    expect(data.agents[0]!.role.nl).toBe("Toetsdeskundige");
    expect(data.agents[0]!.watches).toEqual(["course", "generation"]);
  });

  it("switches one hat off and on again", async () => {
    expect(await post({ intent: "agent", id: "designer", stand: "off" })).toEqual({ saved: true });
    expect((await load()).agents.find((a) => a.id === "designer")?.stand).toBe("off");
    await post({ intent: "agent", id: "designer", stand: "on" });
    expect((await settings.getAgentStands()).designer).toBe("on");
  });

  it("sets the main switch, the roleAgents feature (same setting as /admin/tools)", async () => {
    expect(await post({ intent: "main", stand: "request" })).toEqual({ saved: true });
    expect((await settings.getFeatureStands()).roleAgents).toBe("request");
    expect((await load()).main).toBe("request");
  });

  it("refuses an unknown hat, an unknown stand and an unknown intent", async () => {
    expect(await post({ intent: "agent", id: "nope", stand: "off" })).toEqual({
      error: "invalid",
    });
    // A hat is on or off; "on request" belongs to the main switch only.
    expect(await post({ intent: "agent", id: "designer", stand: "request" })).toEqual({
      error: "invalid",
    });
    expect(await post({ intent: "main", stand: "x" })).toEqual({ error: "invalid" });
    expect(await post({ intent: "feature", id: "courses", stand: "off" })).toEqual({
      error: "invalid",
    });
    expect((await settings.getFeatureStands()).courses).toBeUndefined();
  });
});
