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

function actAs(id: string, role: "student" | "teacher" | "admin") {
  requireUserMock.mockResolvedValue({
    id,
    name: `User ${id}`,
    email: null,
    role,
    createdAt: new Date(0),
  });
}

describe("account deletion (Phase 14)", () => {
  it("a student's request disables the account instead of hard-deleting it", async () => {
    const s = await users.createUser({
      id: "acc-student",
      name: "Student S",
      passwordHash: "scrypt:x:y",
      role: "student",
    });
    actAs(s.id, "student");
    await route.action({ request: deleteRequest() } as Parameters<typeof route.action>[0]);
    const row = await users.getUserById(s.id);
    expect(row).not.toBeNull(); // NOT deleted — held for the teacher
    expect(row?.disabledAt).toBeInstanceOf(Date);
    expect(row?.deletionRequestedAt).toBeInstanceOf(Date);
  });

  it("a teacher's deletion still hard-deletes their account", async () => {
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
