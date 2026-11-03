import { describe, it, expect, beforeAll, vi } from "vitest";
import { listModels } from "~/lib/ai/models";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

// The admin is always "admin-1"; every route's requireRole returns them.
const { requireRoleMock } = vi.hoisted(() => ({ requireRoleMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireRole: requireRoleMock }));

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
