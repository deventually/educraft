import { describe, it, expect, beforeAll } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type InviteRoute = typeof import("~/routes/invite");
type Users = typeof import("~/server/repositories/users.server");
type Cohorts = typeof import("~/server/repositories/cohorts.server");
let route: InviteRoute;
let users: Users;
let cohorts: Cohorts;

beforeAll(async () => {
  route = await import("~/routes/invite");
  users = await import("~/server/repositories/users.server");
  cohorts = await import("~/server/repositories/cohorts.server");
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
    const invite = await users.createInvite({ role: "student" });
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
    const invite = await users.createInvite({ role: "student" });
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
});

describe("invite flow — cohort provisioning (Phase 6)", () => {
  it("redeeming a cohort invite joins the redeemer to the cohort", async () => {
    const cohort = await cohorts.createCohort({
      createdByUserId: "teacher-x",
      name: "Cohort X",
      allowedToolSlugs: ["mentorai"],
    });
    const invite = await users.createInvite({
      role: "student",
      cohortId: cohort.id,
      createdByUserId: "teacher-x",
    });
    const res = await route.action({
      params: { token: invite.token },
      request: formRequest({
        name: "Sofie",
        email: "sofie@example.com",
        password: "supersecret10",
        confirm: "supersecret10",
      }),
    } as ActionArgs);
    expect((res as Response).status).toBe(302);

    const user = await users.getUserByEmail("sofie@example.com");
    expect(user?.role).toBe("student");
    expect((await cohorts.getCohortForUser(user!.id))?.id).toBe(cohort.id);
  });

  it("an email-bound cohort invite rejects a mismatching email and stays single-use", async () => {
    const cohort = await cohorts.createCohort({
      createdByUserId: "teacher-y",
      name: "Bound cohort",
      allowedToolSlugs: ["mentorai"],
    });
    const invite = await users.createInvite({
      role: "student",
      cohortId: cohort.id,
      email: "right@example.com",
    });

    // A different email is rejected; nothing is created and the link stays unused.
    const bad = await route.action({
      params: { token: invite.token },
      request: formRequest({
        name: "Impostor",
        email: "wrong@example.com",
        password: "supersecret10",
        confirm: "supersecret10",
      }),
    } as ActionArgs);
    expect(bad instanceof Response && bad.status === 302).toBe(false);
    expect(await users.getUserByEmail("wrong@example.com")).toBeNull();
    expect((await users.getInvite(invite.token))?.usedByUserId ?? null).toBeNull();

    // The intended email succeeds and joins the cohort.
    const good = await route.action({
      params: { token: invite.token },
      request: formRequest({
        name: "Rightful",
        email: "right@example.com",
        password: "supersecret10",
        confirm: "supersecret10",
      }),
    } as ActionArgs);
    expect((good as Response).status).toBe(302);
    const user = await users.getUserByEmail("right@example.com");
    expect(user).not.toBeNull();
    expect((await cohorts.getCohortForUser(user!.id))?.id).toBe(cohort.id);
  });
});

describe("invite flow — teacher tool allow-list (Phase 4)", () => {
  it("copies an admin-minted invite's tool allow-list onto the new teacher account", async () => {
    const invite = await users.createInvite({
      role: "teacher",
      createdByUserId: "admin-1",
      allowedToolSlugs: ["bloom-by-design", "arcs-reactor"],
    });
    const res = await route.action({
      params: { token: invite.token },
      request: formRequest({
        name: "Narrowed Teacher",
        email: "narrow@example.com",
        password: "supersecret10",
        confirm: "supersecret10",
      }),
    } as ActionArgs);
    expect((res as Response).status).toBe(302);

    const user = await users.getUserByEmail("narrow@example.com");
    const allow = await users.getUserToolAllowlist(user!.id);
    expect(allow).toBeInstanceOf(Set);
    expect(allow?.has("bloom-by-design")).toBe(true);
    expect(allow?.has("arcs-reactor")).toBe(true);
    expect(allow?.has("mentorai")).toBe(false);
  });
});
