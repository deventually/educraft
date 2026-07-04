import { describe, it, expect, beforeAll } from "vitest";

// Point at an isolated in-memory DB before the route (and its DB probe) loads.
process.env.DATABASE_URL = "file::memory:";

type HealthzMod = typeof import("~/routes/healthz");
let loader: HealthzMod["loader"];

beforeAll(async () => {
  ({ loader } = await import("~/routes/healthz"));
});

function invoke() {
  const request = new Request("http://localhost/healthz");
  return loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);
}

describe("healthz", () => {
  it("returns 200 and {ok:true} when the DB probe succeeds", async () => {
    const res = await invoke();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("does not require authentication (no redirect)", async () => {
    const res = await invoke();
    // A 3xx would indicate an auth redirect leaked into a public endpoint.
    expect(res.status).toBeLessThan(300);
  });
});
