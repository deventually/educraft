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
let list: typeof import("~/routes/portfolio._index");
let overview: typeof import("~/routes/portfolio.$id");
let exportRoute: typeof import("~/routes/portfolio.$id.export");
let adminUsers: typeof import("~/routes/admin.users");
let root: typeof import("~/root");

beforeAll(async () => {
  repo = await import("~/server/repositories/portfolio.server");
  users = await import("~/server/repositories/users.server");
  list = await import("~/routes/portfolio._index");
  overview = await import("~/routes/portfolio.$id");
  exportRoute = await import("~/routes/portfolio.$id.export");
  adminUsers = await import("~/routes/admin.users");
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
    const r = await root.loader({ request: get() } as never);
    expect(r.user).toMatchObject({ portfolio: false });
  });

  it("stays on for a teacher who already has a dossier (the transition)", async () => {
    const d = await repo.createDossier("t-old", "Mijn BDB", sampleDossier());
    as("t-old");
    expect(await status(list.loader({ request: get() } as never))).toBeUndefined();
    expect(
      await status(overview.loader({ request: get(), params: { id: d.id } } as never)),
    ).toBeUndefined();
    expect((await root.loader({ request: get() } as never)).user).toMatchObject({
      portfolio: true,
    });
  });

  it("switched off: pages, export and actions are 404; switching back loses nothing", async () => {
    const d = await repo.createDossier("t-off", "Mijn BDB", sampleDossier());
    await users.setPortfolioEnabled("t-off", false);
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
    await users.setPortfolioEnabled("t-off", true);
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

  it("turns it on and off with autosave, and shows the state in the loader", async () => {
    const t = await teacher("switch");
    as("admin-1", "admin");
    const on = await adminUsers.action({
      request: post({ intent: "portfolioAccess", userId: t.id, enabled: "1" }),
    } as never);
    expect(on).toEqual({ saved: true });
    expect(await users.getPortfolioEnabled(t.id)).toBe(true);
    const data = await adminUsers.loader({ request: get() } as never);
    expect(data.teachers.find((x) => x.id === t.id)?.portfolio).toBe(true);
    await adminUsers.action({
      request: post({ intent: "portfolioAccess", userId: t.id }),
    } as never);
    expect(await users.getPortfolioEnabled(t.id)).toBe(false);
  });

  it("refuses a non-teacher target", async () => {
    as("admin-1", "admin");
    expect(
      await status(
        adminUsers.action({
          request: post({ intent: "portfolioAccess", userId: "nobody", enabled: "1" }),
        } as never),
      ),
    ).toBe(404);
  });
});
