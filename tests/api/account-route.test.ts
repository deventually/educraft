import { describe, it, expect, beforeAll, vi } from "vitest";
import { flashKeyOf } from "../helpers/flash";

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
    const res = await route.action({ request: deleteRequest() } as Parameters<
      typeof route.action
    >[0]);
    expect(await users.getUserById(tch.id)).toBeNull();
    // P16: the login page says the account is gone.
    expect(await flashKeyOf(res)).toBe("accountDeleted");
  });
});

describe("account deletion — the owner (P18.6)", () => {
  it("refuses to delete the owner's account", async () => {
    const settings = await import("~/server/repositories/settings.server");
    const owner = await users.createUser({
      id: "acc-owner",
      name: "Owner O",
      passwordHash: "scrypt:x:y",
      role: "admin",
    });
    await settings.setOwnerUserId(owner.id);
    actAs(owner.id, "admin");
    const res = (await route.action({ request: deleteRequest() } as Parameters<
      typeof route.action
    >[0])) as { error?: string };
    const m = i18n.getMessages(localeServer.getLocale(new Request("http://localhost/account")));
    expect(res.error).toBe(m.account.ownerCannotDelete);
    expect(await users.getUserById(owner.id)).not.toBeNull();
    await settings.setOwnerUserId(null);
  });

  it("still lets a regular admin delete their own account", async () => {
    const adm = await users.createUser({
      id: "acc-regular-admin",
      name: "Regular A",
      passwordHash: "scrypt:x:y",
      role: "admin",
    });
    actAs(adm.id, "admin");
    await route.action({ request: deleteRequest() } as Parameters<typeof route.action>[0]);
    expect(await users.getUserById(adm.id)).toBeNull();
  });

  it("the loader tells the page whether the viewer is the owner", async () => {
    const settings = await import("~/server/repositories/settings.server");
    const owner = await users.createUser({
      id: "acc-owner-2",
      name: "Owner Two",
      passwordHash: "scrypt:x:y",
      role: "admin",
    });
    await settings.setOwnerUserId(owner.id);
    actAs(owner.id, "admin");
    const asOwner = (await route.loader({
      request: new Request("http://localhost/account"),
    } as Parameters<typeof route.loader>[0])) as { isOwner: boolean };
    expect(asOwner.isOwner).toBe(true);
    actAs("someone-else", "admin");
    const asOther = (await route.loader({
      request: new Request("http://localhost/account"),
    } as Parameters<typeof route.loader>[0])) as { isOwner: boolean };
    expect(asOther.isOwner).toBe(false);
    await settings.setOwnerUserId(null);
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
      passwordHash: await pw.hashPassword("old-password-x"),
      role: "teacher",
    });
    const cookieOf = (setCookie: string | null) => (setCookie ?? "").split(";")[0]!;
    const asRequest = (cookie: string) =>
      new Request("http://localhost/", { headers: { Cookie: cookie } });

    const otherDevice = cookieOf(
      (await auth.createUserSession(u.id, "/")).headers.get("Set-Cookie"),
    );
    expect((await auth.getUser(asRequest(otherDevice!)))?.id).toBe(u.id);

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
    expect(await auth.getUser(asRequest(otherDevice!))).toBeNull();
    const headers = new Headers(res.init?.headers);
    const fresh = cookieOf(headers.get("Set-Cookie"));
    expect(fresh).toContain("__session=");
    expect((await auth.getUser(asRequest(fresh!)))?.id).toBe(u.id);
  });
});

describe("log out everywhere (P1-4)", () => {
  it("signs the account out on every device, this one included", async () => {
    const auth = await import("~/server/auth.server");
    const u = await users.createUser({
      id: "acc-everywhere",
      name: "Everywhere E",
      passwordHash: "scrypt:x:y",
      role: "teacher",
    });
    const cookieOf = (setCookie: string | null) => (setCookie ?? "").split(";")[0]!;
    const asRequest = (cookie: string) =>
      new Request("http://localhost/", { headers: { Cookie: cookie } });
    const laptop = cookieOf((await auth.createUserSession(u.id, "/")).headers.get("Set-Cookie"));
    const phone = cookieOf((await auth.createUserSession(u.id, "/")).headers.get("Set-Cookie"));

    actAs(u.id, "teacher");
    const res = (await route.action({
      request: new Request("http://localhost/account", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: laptop,
        },
        body: new URLSearchParams({ intent: "logoutEverywhere" }).toString(),
      }),
    } as Parameters<typeof route.action>[0])) as Response;

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
    expect(await flashKeyOf(res)).toBe("signedOutEverywhere");
    expect(await auth.getUser(asRequest(laptop!))).toBeNull();
    expect(await auth.getUser(asRequest(phone!))).toBeNull();
    // Logging in again afterwards works as usual.
    const again = cookieOf((await auth.createUserSession(u.id, "/")).headers.get("Set-Cookie"));
    expect((await auth.getUser(asRequest(again!)))?.id).toBe(u.id);
  });
});
