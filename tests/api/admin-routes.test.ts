import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { listModels } from "~/lib/ai/models";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

// The admin is always "admin-1"; every route's requireRole returns them.
const { requireRoleMock } = vi.hoisted(() => ({ requireRoleMock: vi.fn() }));
// isOwner stays real: it reads the stored owner id (P18.6).
vi.mock("~/server/auth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/auth.server")>();
  return { ...actual, requireRole: requireRoleMock };
});

// Local discovery is env-dependent (Ollama/LM Studio may be running on the host);
// stub it out so the catalog is a known, hermetic static set (P14).
vi.mock("~/lib/ai/discover.server", () => ({ discoverLocalModels: vi.fn(async () => []) }));

type ToolsRoute = typeof import("~/routes/admin.tools");
type UsersRoute = typeof import("~/routes/admin.users");
type ContextRoute = typeof import("~/routes/admin.context");
type Settings = typeof import("~/server/repositories/settings.server");
type Users = typeof import("~/server/repositories/users.server");

let toolsRoute: ToolsRoute;
let usersRoute: UsersRoute;
let contextRoute: ContextRoute;
let settings: Settings;
let users: Users;

beforeAll(async () => {
  [toolsRoute, usersRoute, contextRoute, settings, users] = await Promise.all([
    import("~/routes/admin.tools"),
    import("~/routes/admin.users"),
    import("~/routes/admin.context"),
    import("~/server/repositories/settings.server"),
    import("~/server/repositories/users.server"),
  ]);
  requireRoleMock.mockImplementation(async () => ({
    id: "admin-1",
    name: "Admin A",
    email: "admin@example.com",
    role: "admin" as const,
    createdAt: new Date(0),
  }));
});

function post(fields: Record<string, string | string[]>): Request {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) for (const x of v) body.append(k, x);
    else body.append(k, v);
  }
  return new Request("http://localhost/admin", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

/** Invoke a route action with a form request, bypassing the RR arg-type ceremony. */
function invoke<T extends (arg: never) => unknown>(action: T, request: Request): ReturnType<T> {
  return action({
    request,
    params: {},
    context: {},
  } as unknown as Parameters<T>[0]) as ReturnType<T>;
}

const OWNER_ID = "owner-1";
const regularAdmin = {
  id: "admin-1",
  name: "Admin A",
  email: "admin@example.com",
  role: "admin" as const,
  createdAt: new Date(0),
};

/** Act as the stored owner (a real admin row), for the owner-only intents. */
async function actAsOwner() {
  if (!(await users.getUserById(OWNER_ID))) {
    await users.createUser({
      id: OWNER_ID,
      name: "Owner O",
      email: "owner@example.com",
      passwordHash: "scrypt:x:y",
      role: "admin",
    });
  }
  await settings.setOwnerUserId(OWNER_ID);
  requireRoleMock.mockImplementation(async () => ({
    ...regularAdmin,
    id: OWNER_ID,
    name: "Owner O",
    email: "owner@example.com",
  }));
}

/** Act as a regular admin (admin-1): signed in as admin, but not the owner. */
function actAsRegularAdmin() {
  requireRoleMock.mockImplementation(async () => regularAdmin);
}

// Every test starts as a regular admin with no owner; owner tests opt in.
beforeEach(async () => {
  actAsRegularAdmin();
  await settings.setOwnerUserId(null);
});

describe("admin.tools action", () => {
  it("upserts a tool's enabled flag", async () => {
    await invoke(toolsRoute.action, post({ intent: "tool", slug: "mentorai", enabled: "on" }));
    const row = await settings.getToolSetting("mentorai");
    expect(row?.enabled).toBe(true);
  });
});

describe("admin.tools action — instance models lockout guard", () => {
  it("refuses an empty selection and does not persist", async () => {
    const res = (await invoke(toolsRoute.action, post({ intent: "models" }))) as {
      error?: boolean;
      saved?: boolean;
    };
    expect(res.error).toBe(true);
    expect(await settings.getEnabledModels()).toBeNull(); // unchanged
  });

  it("persists a non-empty allow-list", async () => {
    const res = (await invoke(
      toolsRoute.action,
      post({ intent: "models", models: ["claude-haiku-4-5"] }),
    )) as {
      saved?: boolean;
    };
    expect(res.saved).toBe(true);
    expect(await settings.getEnabledModels()).toEqual(["claude-haiku-4-5"]);
    await settings.setEnabledModels(null); // reset
  });

  it("[P14] persists a list including a local/CLI model", async () => {
    const res = (await invoke(
      toolsRoute.action,
      post({ intent: "models", models: ["claude-haiku-4-5", "claude-code"] }),
    )) as { saved?: boolean };
    expect(res.saved).toBe(true);
    expect(await settings.getEnabledModels()).toEqual(["claude-haiku-4-5", "claude-code"]);
    await settings.setEnabledModels(null); // reset
  });

  it("the loader lists no CLI or local models in production", async () => {
    const discover = await import("~/lib/ai/discover.server");
    vi.mocked(discover.discoverLocalModels).mockClear();
    vi.stubEnv("NODE_ENV", "production");
    try {
      const data = (await toolsRoute.loader({
        request: new Request("http://localhost/admin/tools"),
        params: {},
        context: {},
      } as unknown as Parameters<typeof toolsRoute.loader>[0])) as {
        models: { id: string; group: string }[];
      };
      expect(data.models.some((r) => r.group !== "frontier")).toBe(false);
      expect(data.models.some((r) => r.id === "claude-code")).toBe(false);
      expect(discover.discoverLocalModels).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("the action ignores a CLI model id in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const res = (await invoke(
        toolsRoute.action,
        post({ intent: "models", models: ["claude-code"] }),
      )) as {
        error?: boolean;
      };
      expect(res.error).toBe(true); // nothing valid chosen
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("admin.users action — teacherModels override (P18)", () => {
  async function newTeacher(tag: string) {
    return users.createUser({
      name: `Model Teacher ${tag}`,
      email: `modelteacher-${tag}@example.com`,
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
  }

  it("mode=inherit clears the teacher's set", async () => {
    const teacher = await newTeacher("inherit");
    await users.setUserAssignedModels(teacher.id, ["claude-haiku-4-5"]);
    const res = (await invoke(
      usersRoute.action,
      post({
        intent: "teacherModels",
        userId: teacher.id,
        mode: "inherit",
        models: ["claude-haiku-4-5"],
      }),
    )) as { saved?: boolean };
    expect(res.saved).toBe(true);
    expect(await users.getUserAssignedModels(teacher.id)).toBeNull();
  });

  it("mode=own stores exactly the chosen set, also outside the instance set", async () => {
    await settings.setEnabledModels(["claude-sonnet-4-6"]); // haiku is not enabled instance-wide
    const teacher = await newTeacher("own");
    const res = (await invoke(
      usersRoute.action,
      post({
        intent: "teacherModels",
        userId: teacher.id,
        mode: "own",
        models: ["claude-haiku-4-5"],
      }),
    )) as { saved?: boolean };
    expect(res.saved).toBe(true);
    expect([...(await users.getUserAssignedModels(teacher.id))!]).toEqual(["claude-haiku-4-5"]);
    await settings.setEnabledModels(null); // reset
  });

  it("mode=own with every catalogue model keeps the full list (no collapse to inherit)", async () => {
    await settings.setEnabledModels(null);
    const teacher = await newTeacher("all");
    const all = listModels()
      .filter((mdl) => mdl.clientSelectable)
      .map((mdl) => mdl.id);
    await invoke(
      usersRoute.action,
      post({ intent: "teacherModels", userId: teacher.id, mode: "own", models: all }),
    );
    expect([...(await users.getUserAssignedModels(teacher.id))!].sort()).toEqual([...all].sort());
  });

  it("[P14] mode=own persists a CLI model", async () => {
    const teacher = await newTeacher("cli");
    const res = (await invoke(
      usersRoute.action,
      post({ intent: "teacherModels", userId: teacher.id, mode: "own", models: ["claude-code"] }),
    )) as { saved?: boolean };
    expect(res.saved).toBe(true);
    expect([...(await users.getUserAssignedModels(teacher.id))!]).toEqual(["claude-code"]);
  });

  it("mode=own with nothing chosen is refused and stores nothing", async () => {
    const teacher = await newTeacher("empty");
    await users.setUserAssignedModels(teacher.id, ["claude-haiku-4-5"]);
    const res = (await invoke(
      usersRoute.action,
      post({ intent: "teacherModels", userId: teacher.id, mode: "own" }),
    )) as { error?: string; saved?: boolean };
    expect(res.error).toBe("atLeastOne");
    expect(res.saved).toBeUndefined();
    expect([...(await users.getUserAssignedModels(teacher.id))!]).toEqual(["claude-haiku-4-5"]);
  });

  it("drops unknown ids", async () => {
    const teacher = await newTeacher("unknown");
    await invoke(
      usersRoute.action,
      post({
        intent: "teacherModels",
        userId: teacher.id,
        mode: "own",
        models: ["claude-haiku-4-5", "nonexistent-model-xyz", "claude-opus-4-8"],
      }),
    );
    expect([...(await users.getUserAssignedModels(teacher.id))!]).toEqual(["claude-haiku-4-5"]);
    // Only unknown ids = nothing chosen → refused.
    const res = (await invoke(
      usersRoute.action,
      post({
        intent: "teacherModels",
        userId: teacher.id,
        mode: "own",
        models: ["nonexistent-model-xyz"],
      }),
    )) as { error?: string };
    expect(res.error).toBe("atLeastOne");
  });

  it("404s an unknown or non-teacher target", async () => {
    await expect(
      invoke(
        usersRoute.action,
        post({
          intent: "teacherModels",
          userId: "nobody",
          mode: "own",
          models: ["claude-haiku-4-5"],
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("the loader gives each teacher a mode and lists the whole catalogue, not the instance set", async () => {
    await settings.setEnabledModels(["claude-sonnet-4-6"]);
    const teacher = await newTeacher("loader");
    await users.setUserAssignedModels(teacher.id, ["claude-haiku-4-5"]);
    const data = (await usersRoute.loader({
      request: new Request("http://localhost/admin/users"),
      params: {},
      context: {},
    } as unknown as Parameters<typeof usersRoute.loader>[0])) as {
      base: { id: string }[];
      teachers: { id: string; mode: string; models: string[] }[];
    };
    const row = data.teachers.find((t) => t.id === teacher.id)!;
    expect(row.mode).toBe("own");
    expect(row.models).toEqual(["claude-haiku-4-5"]);
    expect(data.base.map((b) => b.id)).toContain("claude-haiku-4-5"); // not in the instance set
    await settings.setEnabledModels(null); // reset
  });

  it("the loader prefills an inheriting teacher's boxes with the instance set (autosave starting point)", async () => {
    await settings.setEnabledModels(["claude-sonnet-4-6"]);
    const teacher = await newTeacher("prefill");
    const load = () =>
      usersRoute.loader({
        request: new Request("http://localhost/admin/users"),
        params: {},
        context: {},
      } as unknown as Parameters<typeof usersRoute.loader>[0]) as Promise<{
        teachers: { id: string; mode: string; models: string[] }[];
      }>;
    const row = (await load()).teachers.find((t) => t.id === teacher.id)!;
    expect(row.mode).toBe("inherit");
    expect(row.models).toEqual(["claude-sonnet-4-6"]);
    // Unset instance list = the whole catalogue.
    await settings.setEnabledModels(null);
    const all = (await load()).teachers.find((t) => t.id === teacher.id)!;
    expect(all.models.length).toBeGreaterThan(1);
  });
});

describe("admin.context action — instance lockout guard", () => {
  it("refuses an empty selection and does not persist", async () => {
    const res = (await invoke(contextRoute.action, post({ intent: "instance" }))) as {
      error?: string;
      saved?: boolean;
    };
    expect(res.error).toBe("instance-empty");
    expect(await settings.getEnabledSectors()).toBeNull(); // unchanged
  });

  it("refuses an empty sector selection", async () => {
    const res = (await invoke(
      contextRoute.action,
      post({ intent: "instance", domains: ["nt"] }),
    )) as { error?: string };
    expect(res.error).toBe("instance-empty");
    expect(await settings.getEnabledSectors()).toBeNull();
  });

  it("persists a valid instance selection incl. domains (catalogue-filtered)", async () => {
    const res = (await invoke(
      contextRoute.action,
      // Junk values are dropped; only shipped catalogue codes survive on every axis.
      post({
        intent: "instance",
        sectors: ["hbo", "wo", "bogus"],
        domains: ["ICT", "not-a-domain", "nt"],
      }),
    )) as { saved?: boolean };
    expect(res.saved).toBe(true);
    expect(await settings.getEnabledSectors()).toEqual(["hbo", "wo"]);
    expect(await settings.getEnabledDomains()).toEqual(["ICT", "nt"]);
    // Reset so later tests see the default-open state.
    await settings.setEnabledSectors(null);
    await settings.setEnabledDomains(null);
  });

  it("clears instance domains when none are submitted (empty = all)", async () => {
    await settings.setEnabledDomains(["nt"]);
    await invoke(contextRoute.action, post({ intent: "instance", sectors: ["hbo"] }));
    expect(await settings.getEnabledDomains()).toBeNull();
    await settings.setEnabledSectors(null);
  });

  it("loader builds all-checked rows + domain catalogue when nothing is configured", async () => {
    const data = (await invoke(contextRoute.loader, post({}))) as {
      sectors: { id: string; checked: boolean }[];
      enabledDomains: string[] | null;
      domainCatalogueSectors: { sector: string; groups: unknown[] }[];
    };
    expect(data).not.toHaveProperty("countries");
    expect(data).not.toHaveProperty("teachers");
    expect(data.sectors.every((s) => s.checked)).toBe(true);
    expect(data.sectors.map((s) => s.id)).toEqual(["vo", "mbo", "hbo", "wo"]);
    // The instance domain axis: unset = null (= all), and the shared catalogue
    // carries the catalogued sectors (vo + hbo).
    expect(data.enabledDomains).toBeNull();
    expect(data.domainCatalogueSectors.map((d) => d.sector).sort()).toEqual(["hbo", "vo"]);
  });
});

describe("admin.context action — no per-teacher intent (P18.2)", () => {
  it("rejects the retired teacher intent with a 400", async () => {
    const teacher = await users.createUser({
      name: "Assignable",
      email: "assignable@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    await expect(
      invoke(
        contextRoute.action,
        post({ intent: "teacher", userId: teacher.id, customAccess: "1", sectors: ["mbo"] }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("admin.users action", () => {
  it("mints a plain teacher invite (no tool list)", async () => {
    const res = (await invoke(
      usersRoute.action,
      // A stale client may still send the old fields; they are ignored.
      post({ intent: "mint", toolMode: "restrict", tools: ["bloom-by-design"] }),
    )) as { link?: string };
    expect(res.link).toMatch(/\/invite\//);
    const token = res.link!.split("/invite/")[1];
    const invite = await users.getInvite(token);
    expect(invite?.role).toBe("teacher");
    expect(invite!.allowedToolSlugs).toBeNull();
  });

  it("blocks an admin from changing their OWN role (self-demote guard)", async () => {
    const res = (await invoke(
      usersRoute.action,
      post({ intent: "role", userId: "admin-1", role: "teacher" }),
    )) as { error?: string };
    expect(res.error).toBe("selfDemote");
  });

  it("refuses a role change for a user whose stored role is no longer valid", async () => {
    await actAsOwner();
    const legacy = await users.createUser({
      name: "Legacy Student",
      email: "legacy-student@example.com",
      passwordHash: "scrypt:x:y",
      role: "student" as never,
    });
    await expect(
      invoke(usersRoute.action, post({ intent: "role", userId: legacy.id, role: "teacher" })),
    ).rejects.toMatchObject({ status: 404 });
    expect((await users.getUserById(legacy.id))?.role).toBe("student");
  });

  it("promotes an existing user in place (role only — no new account, no password change)", async () => {
    await actAsOwner();
    const teacher = await users.createUser({
      name: "Promote Me",
      email: "promote@example.com",
      passwordHash: "scrypt:keep:me",
      role: "teacher",
    });
    await invoke(usersRoute.action, post({ intent: "role", userId: teacher.id, role: "admin" }));
    const after = await users.getUserById(teacher.id);
    expect(after?.role).toBe("admin");
    expect(after?.passwordHash).toBe("scrypt:keep:me"); // untouched
  });

  it("refuses to set the legacy student role", async () => {
    await actAsOwner();
    const teacher = await users.createUser({
      name: "Stay Teacher",
      email: "stay@example.com",
      passwordHash: "scrypt:keep:me",
      role: "teacher",
    });
    await invoke(usersRoute.action, post({ intent: "role", userId: teacher.id, role: "student" }));
    expect((await users.getUserById(teacher.id))?.role).toBe("teacher");
  });

  it("revokes an open invite (its token becomes unknown)", async () => {
    const invite = await users.createInvite({ role: "teacher", createdByUserId: "admin-1" });
    await invoke(usersRoute.action, post({ intent: "revoke", token: invite.token }));
    expect(await users.getInvite(invite.token)).toBeNull();
  });

  it("blocks an admin from deleting their OWN account (use /account instead)", async () => {
    const res = (await invoke(
      usersRoute.action,
      post({ intent: "deleteUser", userId: "admin-1" }),
    )) as { error?: string };
    expect(res.error).toBe("selfDelete");
  });

  it("removes another user's account (cascade)", async () => {
    const teacher = await users.createUser({
      name: "Remove Me",
      email: "remove@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const res = (await invoke(
      usersRoute.action,
      post({ intent: "deleteUser", userId: teacher.id }),
    )) as { userDeleted?: boolean };
    expect(res.userDeleted).toBe(true);
    expect(await users.getUserById(teacher.id)).toBeNull();
  });

  it("mints a single-use password-reset link for a user (admin never sets the password)", async () => {
    const teacher = await users.createUser({
      name: "Forgot Pw",
      email: "forgot@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const res = (await invoke(
      usersRoute.action,
      post({ intent: "resetPassword", userId: teacher.id }),
    )) as { resetLink?: string };
    expect(res.resetLink).toMatch(/\/reset\//);
    const token = res.resetLink!.split("/reset/")[1];
    expect((await users.getPasswordReset(token))?.userId).toBe(teacher.id);
  });

  it("sets a user's email (recovers an email-less account)", async () => {
    const student = await users.createUser({
      name: "No Email",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    await invoke(
      usersRoute.action,
      post({ intent: "setEmail", userId: student.id, email: "recovered@example.com" }),
    );
    expect((await users.getUserById(student.id))?.email).toBe("recovered@example.com");
  });
});

describe("admin.users action — owner (P18.6)", () => {
  async function mkUser(name: string, role: "teacher" | "admin", email = `${name}@example.com`) {
    return users.createUser({ name, email, passwordHash: "scrypt:a:b", role });
  }

  it("a regular admin cannot change any role", async () => {
    actAsRegularAdmin();
    await settings.setOwnerUserId(OWNER_ID);
    const teacher = await mkUser("RoleT", "teacher");
    const other = await mkUser("RoleA", "admin");
    const promote = (await invoke(
      usersRoute.action,
      post({ intent: "role", userId: teacher.id, role: "admin" }),
    )) as { error?: string };
    expect(promote.error).toBe("ownerOnly");
    expect((await users.getUserById(teacher.id))?.role).toBe("teacher");
    const demote = (await invoke(
      usersRoute.action,
      post({ intent: "role", userId: other.id, role: "teacher" }),
    )) as { error?: string };
    expect(demote.error).toBe("ownerOnly");
    expect((await users.getUserById(other.id))?.role).toBe("admin");
  });

  it("with no owner set nobody can change a role", async () => {
    actAsRegularAdmin();
    await settings.setOwnerUserId(null);
    const teacher = await mkUser("NoOwnerT", "teacher");
    const res = (await invoke(
      usersRoute.action,
      post({ intent: "role", userId: teacher.id, role: "admin" }),
    )) as { error?: string };
    expect(res.error).toBe("ownerOnly");
    expect((await users.getUserById(teacher.id))?.role).toBe("teacher");
  });

  it("an admin who is not the stored owner is refused even if their id looks like the owner's", async () => {
    // The stored id belongs to someone else; this actor is admin-1.
    await settings.setOwnerUserId("someone-else");
    actAsRegularAdmin();
    const teacher = await mkUser("LookT", "teacher");
    const res = (await invoke(
      usersRoute.action,
      post({ intent: "role", userId: teacher.id, role: "admin" }),
    )) as { error?: string };
    expect(res.error).toBe("ownerOnly");
  });

  it("the owner promotes a teacher and demotes an admin", async () => {
    await actAsOwner();
    const teacher = await mkUser("PromoT", "teacher");
    const admin = await mkUser("DemoA", "admin");
    const up = (await invoke(
      usersRoute.action,
      post({ intent: "role", userId: teacher.id, role: "admin" }),
    )) as { roleChanged?: boolean };
    expect(up.roleChanged).toBe(true);
    expect((await users.getUserById(teacher.id))?.role).toBe("admin");
    await invoke(usersRoute.action, post({ intent: "role", userId: admin.id, role: "teacher" }));
    expect((await users.getUserById(admin.id))?.role).toBe("teacher");
  });

  it("a promotion voids reset links a regular admin minted while the user was a teacher", async () => {
    // Otherwise: regular admin mints a 48h reset link for a teacher, the owner promotes
    // that teacher, and the regular admin redeems the link — taking over an admin.
    actAsRegularAdmin();
    await settings.setOwnerUserId(OWNER_ID);
    const teacher = await mkUser("ResetThenPromote", "teacher");
    const minted = (await invoke(
      usersRoute.action,
      post({ intent: "resetPassword", userId: teacher.id }),
    )) as { resetLink?: string };
    const token = minted.resetLink!.split("/reset/")[1];
    expect(await users.getPasswordReset(token)).not.toBeNull();

    await actAsOwner();
    await invoke(usersRoute.action, post({ intent: "role", userId: teacher.id, role: "admin" }));
    expect((await users.getUserById(teacher.id))?.role).toBe("admin");
    expect(await users.getPasswordReset(token)).toBeNull();
    expect(await users.consumePasswordReset(token)).toBeNull();
  });

  it("the owner cannot change their own role (never an accidental self-demotion)", async () => {
    await actAsOwner();
    const res = (await invoke(
      usersRoute.action,
      post({ intent: "role", userId: OWNER_ID, role: "teacher" }),
    )) as { error?: string };
    expect(res.error).toBe("selfDemote");
    expect((await users.getUserById(OWNER_ID))?.role).toBe("admin");
    expect(await settings.getOwnerUserId()).toBe(OWNER_ID);
  });

  it("the owner cannot delete or reset themselves either", async () => {
    await actAsOwner();
    const del = (await invoke(
      usersRoute.action,
      post({ intent: "deleteUser", userId: OWNER_ID }),
    )) as { error?: string };
    expect(del.error).toBe("selfDelete");
    const reset = (await invoke(
      usersRoute.action,
      post({ intent: "resetPassword", userId: OWNER_ID }),
    )) as { error?: string };
    expect(reset.error).toBe("selfReset");
    expect(await users.getUserById(OWNER_ID)).not.toBeNull();
  });

  it("a regular admin cannot delete, reset or re-email another admin", async () => {
    actAsRegularAdmin();
    await settings.setOwnerUserId(OWNER_ID);
    const target = await mkUser("Target", "admin", "target@example.com");

    const del = (await invoke(
      usersRoute.action,
      post({ intent: "deleteUser", userId: target.id }),
    )) as { error?: string };
    expect(del.error).toBe("ownerOnly");
    expect(await users.getUserById(target.id)).not.toBeNull();

    const reset = (await invoke(
      usersRoute.action,
      post({ intent: "resetPassword", userId: target.id }),
    )) as { error?: string; resetLink?: string };
    expect(reset.error).toBe("ownerOnly");
    expect(reset.resetLink).toBeUndefined();

    const email = (await invoke(
      usersRoute.action,
      post({ intent: "setEmail", userId: target.id, email: "hijack@example.com" }),
    )) as { error?: string };
    expect(email.error).toBe("ownerOnly");
    expect((await users.getUserById(target.id))?.email).toBe("target@example.com");
  });

  it("a regular admin cannot touch the owner's account either", async () => {
    await actAsOwner();
    actAsRegularAdmin();
    for (const post_ of [
      post({ intent: "deleteUser", userId: OWNER_ID }),
      post({ intent: "resetPassword", userId: OWNER_ID }),
      post({ intent: "setEmail", userId: OWNER_ID, email: "taken@example.com" }),
      post({ intent: "role", userId: OWNER_ID, role: "teacher" }),
    ]) {
      const res = (await invoke(usersRoute.action, post_)) as { error?: string };
      expect(res.error).toBe("ownerOnly");
    }
    const row = await users.getUserById(OWNER_ID);
    expect(row?.role).toBe("admin");
    expect(row?.email).toBe("owner@example.com");
  });

  it("a regular admin still deletes, resets and re-emails a teacher", async () => {
    actAsRegularAdmin();
    await settings.setOwnerUserId(OWNER_ID);
    const t = await mkUser("TeachOK", "teacher", "teachok@example.com");

    const email = (await invoke(
      usersRoute.action,
      post({ intent: "setEmail", userId: t.id, email: "teachok2@example.com" }),
    )) as { emailSet?: boolean };
    expect(email.emailSet).toBe(true);
    expect((await users.getUserById(t.id))?.email).toBe("teachok2@example.com");

    const reset = (await invoke(
      usersRoute.action,
      post({ intent: "resetPassword", userId: t.id }),
    )) as { resetLink?: string };
    expect(reset.resetLink).toMatch(/\/reset\//);

    const del = (await invoke(usersRoute.action, post({ intent: "deleteUser", userId: t.id }))) as {
      userDeleted?: boolean;
    };
    expect(del.userDeleted).toBe(true);
    expect(await users.getUserById(t.id)).toBeNull();
  });

  it("a regular admin cannot manage a legacy-role row (fail closed: teachers only)", async () => {
    actAsRegularAdmin();
    await settings.setOwnerUserId(OWNER_ID);
    const legacy = await users.createUser({
      name: "Old Student",
      email: "old-student@example.com",
      passwordHash: "scrypt:x:y",
      role: "student" as never,
    });
    const res = (await invoke(
      usersRoute.action,
      post({ intent: "deleteUser", userId: legacy.id }),
    )) as { error?: string };
    expect(res.error).toBe("ownerOnly");
    expect(await users.getUserById(legacy.id)).not.toBeNull();
  });

  it("the owner deletes, resets and re-emails an admin", async () => {
    await actAsOwner();
    const a = await mkUser("OwnerManaged", "admin", "managed@example.com");
    const email = (await invoke(
      usersRoute.action,
      post({ intent: "setEmail", userId: a.id, email: "managed2@example.com" }),
    )) as { emailSet?: boolean };
    expect(email.emailSet).toBe(true);
    const reset = (await invoke(
      usersRoute.action,
      post({ intent: "resetPassword", userId: a.id }),
    )) as { resetLink?: string };
    expect(reset.resetLink).toMatch(/\/reset\//);
    const del = (await invoke(usersRoute.action, post({ intent: "deleteUser", userId: a.id }))) as {
      userDeleted?: boolean;
    };
    expect(del.userDeleted).toBe(true);
    expect(await users.getUserById(a.id)).toBeNull();
  });

  it("an action on a user that does not exist is a 404, not a silent success", async () => {
    await actAsOwner();
    for (const intent of ["deleteUser", "resetPassword", "setEmail"]) {
      await expect(
        invoke(usersRoute.action, post({ intent, userId: "ghost", email: "g@example.com" })),
      ).rejects.toMatchObject({ status: 404 });
    }
  });

  it("an invite never makes an admin, whatever the form says", async () => {
    await actAsOwner(); // even the owner's invite form mints teachers only
    const res = (await invoke(usersRoute.action, post({ intent: "mint", role: "admin" }))) as {
      link?: string;
    };
    const invite = await users.getInvite(res.link!.split("/invite/")[1]);
    expect(invite?.role).toBe("teacher");
  });

  it("a regular admin can still manage a teacher's models, the owner too", async () => {
    const t = await mkUser("ModelsT", "teacher");
    for (const act of [actAsRegularAdmin, actAsOwner]) {
      await act();
      const res = (await invoke(
        usersRoute.action,
        post({ intent: "teacherModels", userId: t.id, mode: "inherit" }),
      )) as { saved?: boolean };
      expect(res.saved).toBe(true);
    }
  });

  it("the loader tells the page who the owner is and whether the viewer is the owner", async () => {
    await actAsOwner();
    const asOwner = (await invoke(
      usersRoute.loader,
      new Request("http://localhost/admin/users"),
    )) as {
      isOwner: boolean;
      ownerId: string | null;
    };
    expect(asOwner.isOwner).toBe(true);
    expect(asOwner.ownerId).toBe(OWNER_ID);
    actAsRegularAdmin();
    const asAdmin = (await invoke(
      usersRoute.loader,
      new Request("http://localhost/admin/users"),
    )) as {
      isOwner: boolean;
      ownerId: string | null;
    };
    expect(asAdmin.isOwner).toBe(false);
    expect(asAdmin.ownerId).toBe(OWNER_ID);
  });

  it("the loader reports no owner when the stored id is no admin any more", async () => {
    actAsRegularAdmin();
    const demoted = await mkUser("FormerOwner", "teacher");
    await settings.setOwnerUserId(demoted.id);
    const data = (await invoke(usersRoute.loader, new Request("http://localhost/admin/users"))) as {
      ownerId: string | null;
    };
    expect(data.ownerId).toBeNull();
  });
});
