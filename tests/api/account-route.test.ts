import { describe, it, expect, beforeAll, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

// The route reads the acting user via requireUser; we stub it per-test. logout and
// the rest of auth stay real (logout returns a redirect regardless of session).
const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("~/server/auth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/auth.server")>();
  return { ...actual, requireUser: requireUserMock };
});

type Route = typeof import("~/routes/account");
type Users = typeof import("~/server/repositories/users.server");
type I18n = typeof import("~/lib/i18n");
type LocaleServer = typeof import("~/lib/i18n/locale.server");

let route: Route;
let users: Users;
let i18n: I18n;
let localeServer: LocaleServer;

beforeAll(async () => {
  route = await import("~/routes/account");
  users = await import("~/server/repositories/users.server");
  i18n = await import("~/lib/i18n");
  localeServer = await import("~/lib/i18n/locale.server");
});

/** A delete/request POST carrying the locale's confirmation word. */
function deleteRequest(): Request {
  const headersReq = new Request("http://localhost/account");
  const m = i18n.getMessages(localeServer.getLocale(headersReq));
  return new Request("http://localhost/account", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ intent: "delete", confirm: m.account.confirmWord }).toString(),
  });
}

function actAs(id: string, role: "teacher" | "admin") {
  requireUserMock.mockResolvedValue({
    id,
    name: `User ${id}`,
    email: null,
    role,
    createdAt: new Date(0),
  });
}

describe("account deletion (P17)", () => {
  it("a teacher's deletion hard-deletes their account", async () => {
    const tch = await users.createUser({
      id: "acc-teacher",
      name: "Teacher T",
      passwordHash: "scrypt:x:y",
      role: "teacher",
    });
    actAs(tch.id, "teacher");
    await route.action({ request: deleteRequest() } as Parameters<typeof route.action>[0]);
    expect(await users.getUserById(tch.id)).toBeNull();
  });
});

describe("account password change (P17)", () => {
  it("logs out other devices but keeps the changing device signed in", async () => {
    const auth = await import("~/server/auth.server");
    const pw = await import("~/server/password.server");
    const u = await users.createUser({
      id: "acc-pwchange",
      name: "Pw Changer",
      email: "pwchanger@example.com",
      passwordHash: pw.hashPassword("old-password-x"),
      role: "teacher",
    });
    const cookieOf = (setCookie: string | null) => (setCookie ?? "").split(";")[0];
    const asRequest = (cookie: string) =>
      new Request("http://localhost/", { headers: { Cookie: cookie } });

    const otherDevice = cookieOf(
      (await auth.createUserSession(u.id, "/")).headers.get("Set-Cookie"),
    );
    expect((await auth.getUser(asRequest(otherDevice)))?.id).toBe(u.id);

    actAs(u.id, "teacher");
    const res = (await route.action({
      request: new Request("http://localhost/account", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          intent: "changePassword",
          currentPassword: "old-password-x",
          password: "brand-new-secret",
          confirm: "brand-new-secret",
        }).toString(),
      }),
    } as Parameters<typeof route.action>[0])) as unknown as {
      data: { ok?: string };
      init: { headers: Headers | Record<string, string> } | null;
    };

    expect(res.data.ok).toBe("password");
    expect(await auth.getUser(asRequest(otherDevice))).toBeNull();
    const headers = new Headers(res.init?.headers);
    const fresh = cookieOf(headers.get("Set-Cookie"));
    expect(fresh).toContain("__session=");
    expect((await auth.getUser(asRequest(fresh)))?.id).toBe(u.id);
  });
});
