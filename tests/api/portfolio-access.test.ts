import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleDossier } from "../portfolio/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { currentUser } = vi.hoisted(() => ({
  currentUser: { value: { id: "t-new", name: "N", email: null, role: "teacher" } as never },
}));
vi.mock("~/server/auth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/auth.server")>();
  return {
    ...actual,
    requireUser: vi.fn(async () => currentUser.value),
    requireRole: vi.fn(async () => currentUser.value),
    getUser: vi.fn(async () => currentUser.value),
  };
});
vi.mock("~/lib/ai/discover.server", () => ({ discoverLocalModels: vi.fn(async () => []) }));

let repo: typeof import("~/server/repositories/portfolio.server");
let users: typeof import("~/server/repositories/users.server");
let exceptions: typeof import("~/server/repositories/exceptions.server");
let list: typeof import("~/routes/portfolio._index");
let overview: typeof import("~/routes/portfolio.$id");
let exportRoute: typeof import("~/routes/portfolio.$id.export");
let adminUser: typeof import("~/routes/admin.users.$id");
let root: typeof import("~/root");

beforeAll(async () => {
  repo = await import("~/server/repositories/portfolio.server");
  users = await import("~/server/repositories/users.server");
  exceptions = await import("~/server/repositories/exceptions.server");
  list = await import("~/routes/portfolio._index");
  overview = await import("~/routes/portfolio.$id");
  exportRoute = await import("~/routes/portfolio.$id.export");
  adminUser = await import("~/routes/admin.users.$id");
  root = await import("~/root");
});

const as = (id: string, role: "teacher" | "admin" = "teacher") => {
  currentUser.value = { id, name: id, email: null, role } as never;
};
beforeEach(() => as("t-new"));

const get = (path = "/x") => new Request(`http://localhost${path}`);
function post(fields: Record<string, string>): Request {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}
async function status(p: Promise<unknown>): Promise<number | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

describe("BDB/BKE per teacher", () => {
  it("is off for a new teacher: list, actions and the menu", async () => {
    as("t-new");
    expect(await status(list.loader({ request: get() } as never))).toBe(404);
    expect(
      await status(list.action({ request: post({ intent: "create", name: "X" }) } as never)),
    ).toBe(404);
    const r = (await root.loader({ request: get() } as never)).data;
    expect(r.user).toMatchObject({ portfolio: false });
  });

  it("stays on for a teacher who already has a dossier (the transition)", async () => {
    const d = await repo.createDossier("t-old", "Mijn BDB", sampleDossier());
    as("t-old");
    expect(await status(list.loader({ request: get() } as never))).toBeUndefined();
    expect(
      await status(overview.loader({ request: get(), params: { id: d.id } } as never)),
    ).toBeUndefined();
    expect((await root.loader({ request: get() } as never)).data.user).toMatchObject({
      portfolio: true,
    });
  });

  it("switched off: pages, export and actions are 404; switching back loses nothing", async () => {
    const d = await repo.createDossier("t-off", "Mijn BDB", sampleDossier());
    await exceptions.setException("t-off", exceptions.featureKey("portfolio"), "off");
    as("t-off");
    const params = { id: d.id };
    expect(await status(list.loader({ request: get() } as never))).toBe(404);
    expect(await status(overview.loader({ request: get(), params } as never))).toBe(404);
    expect(await status(exportRoute.loader({ request: get(), params } as never))).toBe(404);
    expect(
      await status(
        overview.action({ request: post({ intent: "coachMode", mode: "draft" }), params } as never),
      ),
    ).toBe(404);
    await exceptions.setException("t-off", exceptions.featureKey("portfolio"), "on");
    const page = await overview.loader({ request: get(), params } as never);
    expect(page.name).toBe("Mijn BDB");
  });

  it("is always on for an admin", async () => {
    as("a-1", "admin");
    expect(await status(list.loader({ request: get() } as never))).toBeUndefined();
  });
});

describe("admin switches the workplace per teacher", () => {
  async function teacher(tag: string) {
    return users.createUser({
      name: `T ${tag}`,
      email: `t-${tag}@example.com`,
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
  }

  const portfolioKey = "feature:portfolio";
  const portfolioRow = (d: { features: { key: string }[] | null }) =>
    d.features?.find((r) => r.key === portfolioKey);

  it("sets and clears an exception (P28.3), and the loader shows where the stand comes from", async () => {
    const t = await teacher("switch");
    as("admin-1", "admin");
    const before = await adminUser.loader({ request: get(), params: { id: t.id } } as never);
    expect(portfolioRow(before)).toMatchObject({ on: false, source: "default" });
    const on = await adminUser.action({
      request: post({ intent: "exception", key: portfolioKey, choice: "on" }),
      params: { id: t.id },
    } as never);
    expect(on).toEqual({ saved: true });
    expect((await exceptions.getExceptions(t.id)).get(portfolioKey)).toBe("on");
    const data = await adminUser.loader({ request: get(), params: { id: t.id } } as never);
    expect(portfolioRow(data)).toMatchObject({ on: true, source: "exception", exception: "on" });
    await adminUser.action({
      request: post({ intent: "exception", key: portfolioKey, choice: "" }),
      params: { id: t.id },
    } as never);
    expect((await exceptions.getExceptions(t.id)).has(portfolioKey)).toBe(false);
  });

  it("refuses an unknown key or choice, and a non-teacher target", async () => {
    const t = await teacher("bad");
    as("admin-1", "admin");
    for (const fields of [
      { intent: "exception", key: "feature:nope", choice: "on" },
      { intent: "exception", key: portfolioKey, choice: "maybe" },
    ]) {
      expect(
        await adminUser.action({ request: post(fields), params: { id: t.id } } as never),
      ).toEqual({ error: "invalid" });
    }
    expect(
      await status(
        adminUser.action({
          request: post({ intent: "exception", key: portfolioKey, choice: "on" }),
          params: { id: "nobody" },
        } as never),
      ),
    ).toBe(404);
  });
});
