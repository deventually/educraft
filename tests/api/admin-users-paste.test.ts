import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

// Who is signed in; isOwner stays real (it reads the stored owner id).
const { currentUser } = vi.hoisted(() => ({
  currentUser: { value: null as unknown },
}));
vi.mock("~/server/auth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/auth.server")>();
  return {
    ...actual,
    requireUser: vi.fn(async () => currentUser.value),
    requireRole: vi.fn(async (_req: Request, ...roles: string[]) => {
      const u = currentUser.value as { role: string };
      if (!roles.includes(u.role)) throw new Response("Forbidden", { status: 403 });
      return u;
    }),
  };
});
vi.mock("~/lib/ai/discover.server", () => ({ discoverLocalModels: vi.fn(async () => []) }));

let teams: typeof import("~/server/repositories/teams.server");
let users: typeof import("~/server/repositories/users.server");
let settings: typeof import("~/server/repositories/settings.server");
let list: typeof import("~/routes/admin.users");

beforeAll(async () => {
  teams = await import("~/server/repositories/teams.server");
  users = await import("~/server/repositories/users.server");
  settings = await import("~/server/repositories/settings.server");
  list = await import("~/routes/admin.users");
});

type Row =
  | { line: number; name: string; email: string; link: string }
  | { line: number; text: string; reason: string };
type Result = { pasted?: Row[]; error?: string };

function post(fields: Record<string, string>): Request {
  return new Request("http://localhost/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}
const paste = (people: string, extra: Record<string, string> = {}) =>
  list.action({
    request: post({ intent: "mintList", people, ...extra }),
    params: {},
    context: {},
  } as never) as Promise<Result>;
const tokenOf = (row: Row) => ("link" in row ? row.link.split("/invite/")[1] : "");

let admin: Awaited<ReturnType<typeof users.createUser>>;
beforeEach(async () => {
  admin ??= await users.createUser({
    name: "Regular Admin",
    email: "regular.admin@school.nl",
    passwordHash: "scrypt:a:b",
    role: "admin",
  });
  // A regular admin, not the super admin: inviting teachers is every admin's job.
  await settings.setOwnerUserId(null);
  currentUser.value = { ...admin };
});

describe("/admin/users: paste a list (P28.5)", () => {
  it("mints one teacher invite per accepted line, for the chosen team, named after the person", async () => {
    const team = await teams.createTeam("Plakteam");
    const res = await paste("Jan de Vries, jan.paste@school.nl\nAnna Bos; anna.paste@school.nl", {
      teamId: team.id,
    });
    expect(res.pasted).toHaveLength(2);
    const [jan, anna] = res.pasted ?? [];
    expect(jan).toMatchObject({ line: 1, name: "Jan de Vries", email: "jan.paste@school.nl" });
    expect(anna).toMatchObject({ line: 2, name: "Anna Bos" });
    for (const row of [jan, anna]) {
      expect("link" in row && row.link).toMatch(/^http:\/\/localhost\/invite\/[\w-]+$/);
      const invite = await users.getInvite(tokenOf(row));
      expect(invite?.role).toBe("teacher");
      expect(invite?.teamId).toBe(team.id);
      expect(invite?.createdByUserId).toBe(admin.id);
      expect(invite?.expiresAt?.getTime()).toBeGreaterThan(Date.now());
    }
    expect((await users.getInvite(tokenOf(jan)))?.note).toBe("Jan de Vries <jan.paste@school.nl>");
  });

  it("refuses a line per person with a reason, and still invites the rest", async () => {
    await users.createUser({
      name: "Bestaand",
      email: "Taken.Paste@School.nl",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const res = await paste(
      [
        "Bestaand, taken.paste@school.nl",
        "Zonder adres",
        "Goed, goed.paste@school.nl",
        "Dubbel, goed.paste@school.nl",
      ].join("\n"),
    );
    expect(res.pasted).toEqual([
      { line: 1, text: "Bestaand, taken.paste@school.nl", reason: "emailTaken" },
      { line: 2, text: "Zonder adres", reason: "invalidEmail" },
      expect.objectContaining({ line: 3, name: "Goed", email: "goed.paste@school.nl" }),
      { line: 4, text: "Dubbel, goed.paste@school.nl", reason: "duplicate" },
    ]);
  });

  it("refuses someone who already has an open invite from an earlier list", async () => {
    await paste("Eerder, eerder.paste@school.nl");
    const res = await paste("Eerder, eerder.paste@school.nl");
    expect(res.pasted).toEqual([
      { line: 1, text: "Eerder, eerder.paste@school.nl", reason: "alreadyInvited" },
    ]);
  });

  it("says so when the list is empty", async () => {
    expect(await paste("  \n\n")).toEqual({ error: "emptyList" });
  });

  it("never mints an admin, whatever the form says", async () => {
    const res = await paste("Stiekem, stiekem.paste@school.nl", { role: "admin" });
    const row = res.pasted?.[0] as Row;
    expect((await users.getInvite(tokenOf(row)))?.role).toBe("teacher");
  });

  it("is for admins only", async () => {
    currentUser.value = { ...admin, role: "teacher" };
    await expect(paste("X, x.paste@school.nl")).rejects.toMatchObject({ status: 403 });
  });
});
