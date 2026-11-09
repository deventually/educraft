import { describe, it, expect, beforeAll } from "vitest";
import { flashKeyOf } from "../helpers/flash";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type InviteRoute = typeof import("~/routes/invite");
type Users = typeof import("~/server/repositories/users.server");
let route: InviteRoute;
let users: Users;

beforeAll(async () => {
  route = await import("~/routes/invite");
  users = await import("~/server/repositories/users.server");
});

function formRequest(fields: Record<string, string>): Request {
  const body = new URLSearchParams(fields).toString();
  return new Request("http://localhost/invite/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

type LoaderArgs = Parameters<InviteRoute["loader"]>[0];
type ActionArgs = Parameters<InviteRoute["action"]>[0];

describe("invite flow (loader + action)", () => {
  it("shows an invalid state for an unknown token", async () => {
    const data = await route.loader({
      params: { token: "unknown-token" },
      request: new Request("http://localhost/invite/unknown-token"),
    } as LoaderArgs);
    expect(data.valid).toBe(false);
  });

  it("walks the happy path: valid loader → account+session → single-use", async () => {
    const invite = await users.createInvite({ role: "teacher", note: "Jan" });

    // Loader validates the token.
    const loaderData = await route.loader({
      params: { token: invite.token },
      request: new Request(`http://localhost/invite/${invite.token}`),
    } as LoaderArgs);
    expect(loaderData.valid).toBe(true);

    // Action creates the account + session and redirects home.
    const res = await route.action({
      params: { token: invite.token },
      request: formRequest({
        name: "Jan de Vries",
        email: "jan@example.com",
        password: "supersecret10",
        confirm: "supersecret10",
      }),
    } as ActionArgs);
    expect(res).toBeInstanceOf(Response);
    const response = res as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
    // P16: the landing page welcomes the new user with a toast.
    expect(await flashKeyOf(response)).toBe("welcome");
    expect(response.headers.get("Set-Cookie") ?? "").toContain("__session=");

    // The account exists with the invite's role.
    const user = await users.getUserByEmail("jan@example.com");
    expect(user?.role).toBe("teacher");

    // The invite is now consumed.
    const consumed = await users.getInvite(invite.token);
    expect(consumed?.usedByUserId).toBe(user?.id);

    // A second POST with the same token is rejected (returns an error, not a redirect).
    const second = await route.action({
      params: { token: invite.token },
      request: formRequest({
        name: "Impostor",
        email: "impostor@example.com",
        password: "supersecret10",
        confirm: "supersecret10",
      }),
    } as ActionArgs);
    // Not a redirect: the action returns a plain object carrying an error.
    expect(second instanceof Response && second.status === 302).toBe(false);
    expect(await users.getUserByEmail("impostor@example.com")).toBeNull();
  });

  it("rejects a password/confirm mismatch without creating a user", async () => {
    const invite = await users.createInvite({ role: "teacher" });
    const res = await route.action({
      params: { token: invite.token },
      request: formRequest({
        name: "Mismatch",
        email: "mismatch@example.com",
        password: "supersecret10",
        confirm: "different99",
      }),
    } as ActionArgs);
    expect(res instanceof Response && res.status === 302).toBe(false);
    expect(await users.getUserByEmail("mismatch@example.com")).toBeNull();
    // Invite stays unused.
    expect((await users.getInvite(invite.token))?.usedByUserId ?? null).toBeNull();
  });

  it("rejects a too-short password", async () => {
    const invite = await users.createInvite({ role: "teacher" });
    const res = await route.action({
      params: { token: invite.token },
      request: formRequest({
        name: "Shorty",
        email: "shorty@example.com",
        password: "short",
        confirm: "short",
      }),
    } as ActionArgs);
    expect(res instanceof Response && res.status === 302).toBe(false);
    expect(await users.getUserByEmail("shorty@example.com")).toBeNull();
  });

  it("rejects a commonly used password", async () => {
    const invite = await users.createInvite({ role: "teacher" });
    const res = (await route.action({
      params: { token: invite.token },
      request: formRequest({
        name: "Common",
        email: "common-invite@example.com",
        password: "Wachtwoord123",
        confirm: "Wachtwoord123",
      }),
    } as ActionArgs)) as { error?: string };
    expect(res.error).toMatch(/veelgebruikt|commonly used/);
    expect(await users.getUserByEmail("common-invite@example.com")).toBeNull();
    expect((await users.getInvite(invite.token))?.usedByUserId ?? null).toBeNull();
  });
});

describe("invite flow — legacy invites (P17)", () => {
  async function insertRaw(values: { role: string }) {
    const { getDb } = await import("~/server/db.server");
    const { invites } = await import("~/server/schema.server");
    const token = `legacy-${Math.random().toString(36).slice(2)}`;
    getDb()
      .insert(invites)
      .values({
        token,
        role: values.role,
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
      } as never)
      .run();
    return token;
  }

  it("a legacy student invite is invalid", async () => {
    const token = await insertRaw({ role: "student" });
    const data = await route.loader({
      params: { token },
      request: new Request(`http://localhost/invite/${token}`),
    } as LoaderArgs);
    expect(data.valid).toBe(false);
    const res = await route.action({
      params: { token },
      request: formRequest({
        name: "Sofie",
        email: "sofie@example.com",
        password: "supersecret10",
        confirm: "supersecret10",
      }),
    } as ActionArgs);
    expect(res instanceof Response && res.status === 302).toBe(false);
    expect(await users.getUserByEmail("sofie@example.com")).toBeNull();
  });
});

describe("invite flow — never an admin (P18.6)", () => {
  it("an admin invite is invalid and creates no account", async () => {
    const { getDb } = await import("~/server/db.server");
    const { invites } = await import("~/server/schema.server");
    const token = "admin-invite-token";
    getDb()
      .insert(invites)
      .values({
        token,
        role: "admin",
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
      })
      .run();
    const data = await route.loader({
      params: { token },
      request: new Request(`http://localhost/invite/${token}`),
    } as LoaderArgs);
    expect(data.valid).toBe(false);
    const res = await route.action({
      params: { token },
      request: formRequest({
        name: "Sneaky",
        email: "sneaky@example.com",
        password: "supersecret10",
        confirm: "supersecret10",
      }),
    } as ActionArgs);
    expect(res instanceof Response && res.status === 302).toBe(false);
    expect(await users.getUserByEmail("sneaky@example.com")).toBeNull();
    expect((await users.getInvite(token))?.usedByUserId ?? null).toBeNull();
  });

  it("a redeemed teacher invite always creates a teacher, whatever the form posts", async () => {
    const invite = await users.createInvite({ role: "teacher" });
    await route.action({
      params: { token: invite.token },
      request: formRequest({
        name: "Role Poster",
        email: "roleposter@example.com",
        password: "supersecret10",
        confirm: "supersecret10",
        role: "admin",
      }),
    } as ActionArgs);
    expect((await users.getUserByEmail("roleposter@example.com"))?.role).toBe("teacher");
  });
});
