import { describe, expect, it } from "vitest";
import { getDb } from "~/server/db.server";
import { users } from "~/server/schema.server";
import {
  currentTenant,
  parseTenants,
  runWithTenant,
  tenantForHost,
  tenantMiddleware,
  type Tenant,
} from "~/server/tenants.server";

const hsl: Tenant = { id: "hsl", hosts: ["hsl.limeonit.test"], dbPath: ":memory:" };
const hhs: Tenant = { id: "hhs", hosts: ["hhs.limeonit.test"], dbPath: ":memory:" };

async function addUser(email: string) {
  await getDb().insert(users).values({
    id: crypto.randomUUID(),
    email,
    name: email,
    passwordHash: "x",
    role: "teacher",
    createdAt: new Date(),
  });
}

const emails = async () =>
  (await getDb().select({ email: users.email }).from(users)).map((u) => u.email);

describe("parseTenants", () => {
  it("is one instance on the configured database when nothing is set", () => {
    expect(parseTenants(undefined, "/data/limeonit.db")).toEqual([
      { id: "default", hosts: [], dbPath: "/data/limeonit.db" },
    ]);
    expect(parseTenants("  ", "/data/limeonit.db")).toHaveLength(1);
  });

  it("gives each institution its own database, next to the configured one by default", () => {
    const list = parseTenants(
      JSON.stringify([
        { id: "hsl", hosts: ["HSL.LimeOnIt.nl"], database: "file:/data/limeonit.db" },
        { id: "hhs", hosts: ["hhs.limeonit.nl"] },
      ]),
      "/data/limeonit.db",
    );
    expect(list).toEqual([
      { id: "hsl", hosts: ["hsl.limeonit.nl"], dbPath: "/data/limeonit.db" },
      { id: "hhs", hosts: ["hhs.limeonit.nl"], dbPath: "/data/hhs.db" },
    ]);
  });

  it("refuses a list that could mix two institutions up", () => {
    const parse = (value: unknown) => () => parseTenants(JSON.stringify(value), "/data/x.db");
    expect(parse("hsl")).toThrow(/TENANTS/);
    expect(parse([{ id: "Bad Id", hosts: ["a.nl"] }])).toThrow(/TENANTS/);
    expect(parse([{ id: "hsl", hosts: [] }])).toThrow(/TENANTS/);
    expect(
      parse([
        { id: "hsl", hosts: ["a.nl"] },
        { id: "hsl", hosts: ["b.nl"] },
      ]),
    ).toThrow(/twice/);
    expect(
      parse([
        { id: "hsl", hosts: ["a.nl"] },
        { id: "hhs", hosts: ["A.nl"] },
      ]),
    ).toThrow(/twice/);
    expect(
      parse([
        { id: "hsl", hosts: ["a.nl"], database: "file:/data/same.db" },
        { id: "hhs", hosts: ["b.nl"], database: "/data/same.db" },
      ]),
    ).toThrow(/twice/);
    expect(() => parseTenants("{not json", "/data/x.db")).toThrow(/TENANTS/);
  });
});

describe("tenantForHost", () => {
  const list = [hsl, hhs];

  it("finds the institution by its address, ignoring case and port", () => {
    expect(tenantForHost("hhs.limeonit.test", list)?.id).toBe("hhs");
    expect(tenantForHost("HSL.limeonit.test:3000", list)?.id).toBe("hsl");
  });

  it("knows no institution for any other address", () => {
    expect(tenantForHost("evil.test", list)).toBeNull();
    expect(tenantForHost("", list)).toBeNull();
  });

  it("serves every address when there is one instance", () => {
    expect(tenantForHost("anything.test", parseTenants(undefined, ":memory:"))?.id).toBe("default");
  });
});

describe("one database per institution", () => {
  it("keeps what a teacher at one institution makes out of the other's database", async () => {
    await runWithTenant(hsl, () => addUser("docent@hsl.nl"));
    await runWithTenant(hhs, () => addUser("docent@hhs.nl"));

    expect(await runWithTenant(hsl, emails)).toEqual(["docent@hsl.nl"]);
    expect(await runWithTenant(hhs, emails)).toEqual(["docent@hhs.nl"]);
  });

  it("stays on the institution through work that finishes after the request returns", async () => {
    const later = { promise: Promise.resolve() };
    runWithTenant(hhs, () => {
      later.promise = new Promise<void>((resolve) => setTimeout(resolve, 5)).then(() =>
        addUser("later@hhs.nl"),
      );
    });
    await later.promise;
    expect(await runWithTenant(hhs, emails)).toContain("later@hhs.nl");
    expect(await runWithTenant(hsl, emails)).not.toContain("later@hhs.nl");
  });

  it("uses the one instance's database outside a request", () => {
    expect(currentTenant().id).toBe("default");
  });
});

describe("tenantMiddleware", () => {
  const middleware = tenantMiddleware([hsl, hhs]);
  const call = (url: string, next: () => Promise<Response>) =>
    middleware({ request: new Request(url) } as never, next as never) as Promise<Response>;

  it("runs the request on the institution of its address", async () => {
    const seen: string[] = [];
    await call("https://hhs.limeonit.test/courses", async () => {
      seen.push(currentTenant().id);
      return new Response("ok");
    });
    expect(seen).toEqual(["hhs"]);
  });

  it("answers an unknown address with 404, in both languages, and runs nothing", async () => {
    let ran = false;
    const response = await call("https://other.test/", async () => {
      ran = true;
      return new Response("ok");
    });
    expect(ran).toBe(false);
    expect(response.status).toBe(404);
    const text = await response.text();
    expect(text).toMatch(/instelling/i);
    expect(text).toMatch(/institution/i);
  });
});

describe("the health probe", () => {
  it("passes on any address, because the container checks itself on 127.0.0.1", async () => {
    const middleware = tenantMiddleware([hsl, hhs]);
    const response = (await middleware(
      { request: new Request("http://127.0.0.1:3000/healthz") } as never,
      (async () => new Response("ok")) as never,
    )) as Response;
    expect(response.status).toBe(200);
  });

  it("checks every institution's database", async () => {
    const { pingDb } = await import("~/server/db.server");
    expect(() => pingDb([hsl, hhs])).not.toThrow();
    const broken: Tenant = { id: "ping-broken", hosts: ["x.test"], dbPath: "/dev/null/x.db" };
    expect(() => pingDb([hsl, broken])).toThrow();
  });
});

describe("the root route", () => {
  it("picks the institution before anything that reads a database, after the headers", async () => {
    const root = await import("~/root");
    const { securityHeadersMiddleware } = await import("~/server/securityHeaders.server");
    const { sessionRefreshMiddleware } = await import("~/server/session.server");
    const { tenantRouting } = await import("~/server/tenants.server");
    const order = root.middleware;
    expect(order).toContain(tenantRouting);
    expect(order.indexOf(tenantRouting)).toBeGreaterThan(order.indexOf(securityHeadersMiddleware));
    expect(order.indexOf(tenantRouting)).toBeLessThan(order.indexOf(sessionRefreshMiddleware));
  });
});
