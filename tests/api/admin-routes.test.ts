import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { flashKeyOf } from "../helpers/flash";
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
type PersonRoute = typeof import("~/routes/admin.users.$id");
type ContextRoute = typeof import("~/routes/admin.context");
type Settings = typeof import("~/server/repositories/settings.server");
type Users = typeof import("~/server/repositories/users.server");

let toolsRoute: ToolsRoute;
let usersRoute: UsersRoute;
let personRoute: PersonRoute;
let contextRoute: ContextRoute;
let settings: Settings;
let users: Users;

beforeAll(async () => {
  [toolsRoute, usersRoute, personRoute, contextRoute, settings, users] = await Promise.all([
    import("~/routes/admin.tools"),
    import("~/routes/admin.users"),
    import("~/routes/admin.users.$id"),
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

/**
 * Invoke a route action or loader with a request, bypassing the RR arg-type ceremony.
 * The person page (P28.1) takes its user from the URL: a form's `userId` becomes
 * `params.id`, as if the form was posted on `/admin/users/:id`.
 */
async function invoke<T extends (arg: never) => unknown>(
  action: T,
  request: Request,
): Promise<Awaited<ReturnType<T>>> {
  const body = request.method === "POST" ? await request.clone().formData() : null;
  const id = body?.get("userId");
  return (await action({
    request,
    params: id ? { id: String(id) } : {},
    context: {},
  } as unknown as Parameters<T>[0])) as Awaited<ReturnType<T>>;
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
  it("sets a tool's instance stand (P28.3)", async () => {
    await invoke(toolsRoute.action, post({ intent: "tool", slug: "mentorai", stand: "request" }));
    expect((await settings.getToolStands()).get("mentorai")).toBe("request");
  });

  it("sets many tools at once; an unknown slug is skipped", async () => {
    const res = await invoke(
      toolsRoute.action,
      post({ intent: "toolsBulk", stand: "off", slugs: ["mentorai", "bloom-by-design", "nope"] }),
    );
    expect(res).toEqual({ saved: true, count: 2 });
    const stands = await settings.getToolStands();
    expect(stands.get("mentorai")).toBe("off");
    expect(stands.get("bloom-by-design")).toBe("off");
    expect(
      await invoke(toolsRoute.action, post({ intent: "toolsBulk", stand: "x", slugs: "mentorai" })),
    ).toEqual({ error: "invalid" });
    expect(await invoke(toolsRoute.action, post({ intent: "toolsBulk", stand: "on" }))).toEqual({
      error: "invalid",
    });
  });

  it("refuses an unknown stand or tool", async () => {
    const bad = await invoke(
      toolsRoute.action,
      post({ intent: "tool", slug: "mentorai", stand: "x" }),
    );
    expect(bad).toEqual({ error: "invalid" });
    const none = await invoke(
      toolsRoute.action,
      post({ intent: "tool", slug: "nope", stand: "on" }),
    );
    expect(none).toEqual({ error: "invalid" });
  });

  it("sets a feature's instance stand (P28.3)", async () => {
    await invoke(toolsRoute.action, post({ intent: "feature", id: "courses", stand: "off" }));
    expect((await settings.getFeatureStands()).courses).toBe("off");
    const bad = await invoke(
      toolsRoute.action,
      post({ intent: "feature", id: "nope", stand: "on" }),
    );
    expect(bad).toEqual({ error: "invalid" });
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
        choices: { id: string; group: string }[];
      };
      expect(data.choices.some((r) => r.group !== "frontier")).toBe(false);
      expect(data.choices.some((r) => r.id === "claude-code")).toBe(false);
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
      personRoute.action,
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
      personRoute.action,
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
      personRoute.action,
      post({ intent: "teacherModels", userId: teacher.id, mode: "own", models: all }),
    );
    expect([...(await users.getUserAssignedModels(teacher.id))!].sort()).toEqual([...all].sort());
  });

  it("[P14] mode=own persists a CLI model", async () => {
    const teacher = await newTeacher("cli");
    const res = (await invoke(
      personRoute.action,
      post({ intent: "teacherModels", userId: teacher.id, mode: "own", models: ["claude-code"] }),
    )) as { saved?: boolean };
    expect(res.saved).toBe(true);
    expect([...(await users.getUserAssignedModels(teacher.id))!]).toEqual(["claude-code"]);
  });

  it("mode=own with nothing chosen is refused and stores nothing", async () => {
    const teacher = await newTeacher("empty");
    await users.setUserAssignedModels(teacher.id, ["claude-haiku-4-5"]);
    const res = (await invoke(
      personRoute.action,
      post({ intent: "teacherModels", userId: teacher.id, mode: "own" }),
    )) as { error?: string; saved?: boolean };
    expect(res.error).toBe("atLeastOne");
    expect(res.saved).toBeUndefined();
    expect([...(await users.getUserAssignedModels(teacher.id))!]).toEqual(["claude-haiku-4-5"]);
  });

  it("drops unknown ids", async () => {
    const teacher = await newTeacher("unknown");
    await invoke(
      personRoute.action,
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
      personRoute.action,
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
        personRoute.action,
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
    const data = (await personRoute.loader({
      request: new Request(`http://localhost/admin/users/${teacher.id}`),
      params: { id: teacher.id },
      context: {},
    } as unknown as Parameters<typeof personRoute.loader>[0])) as {
      models: { base: { id: string }[]; mode: string; models: string[] };
    };
    const row = data.models;
    expect(row.mode).toBe("own");
    expect(row.models).toEqual(["claude-haiku-4-5"]);
    expect(row.base.map((b) => b.id)).toContain("claude-haiku-4-5"); // not in the instance set
    await settings.setEnabledModels(null); // reset
  });

  it("the loader prefills an inheriting teacher's boxes with the instance set (autosave starting point)", async () => {
    await settings.setEnabledModels(["claude-sonnet-4-6"]);
    const teacher = await newTeacher("prefill");
    const load = () =>
      personRoute.loader({
        request: new Request(`http://localhost/admin/users/${teacher.id}`),
        params: { id: teacher.id },
        context: {},
      } as unknown as Parameters<typeof personRoute.loader>[0]) as Promise<{
        models: { mode: string; models: string[] };
      }>;
    const row = (await load()).models;
    expect(row.mode).toBe("inherit");
    expect(row.models).toEqual(["claude-sonnet-4-6"]);
    // Unset instance list = the whole catalogue.
    await settings.setEnabledModels(null);
    const all = (await load()).models;
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
  });

  it("blocks an admin from changing their OWN role (self-demote guard)", async () => {
    const res = (await invoke(
      personRoute.action,
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
      invoke(personRoute.action, post({ intent: "role", userId: legacy.id, role: "teacher" })),
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
    await invoke(personRoute.action, post({ intent: "role", userId: teacher.id, role: "admin" }));
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
    await invoke(personRoute.action, post({ intent: "role", userId: teacher.id, role: "student" }));
    expect((await users.getUserById(teacher.id))?.role).toBe("teacher");
  });

  it("revokes an open invite (its token becomes unknown)", async () => {
    const invite = await users.createInvite({ role: "teacher", createdByUserId: "admin-1" });
    await invoke(usersRoute.action, post({ intent: "revoke", token: invite.token }));
    expect(await users.getInvite(invite.token)).toBeNull();
  });

  it("blocks an admin from deleting their OWN account (use /account instead)", async () => {
    const res = (await invoke(
      personRoute.action,
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
      personRoute.action,
      post({ intent: "deleteUser", userId: teacher.id }),
    )) as unknown as Response;
    // The person page is gone: back to the list (P28.1), with a toast (P16).
    expect(res.status).toBe(302);
    expect(await flashKeyOf(res)).toBe("userDeleted");
    expect(res.headers.get("Location")).toBe("/admin/users");
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
      personRoute.action,
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
      personRoute.action,
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
      personRoute.action,
      post({ intent: "role", userId: teacher.id, role: "admin" }),
    )) as { error?: string };
    expect(promote.error).toBe("ownerOnly");
    expect((await users.getUserById(teacher.id))?.role).toBe("teacher");
    const demote = (await invoke(
      personRoute.action,
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
      personRoute.action,
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
      personRoute.action,
      post({ intent: "role", userId: teacher.id, role: "admin" }),
    )) as { error?: string };
    expect(res.error).toBe("ownerOnly");
  });

  it("the owner promotes a teacher and demotes an admin", async () => {
    await actAsOwner();
    const teacher = await mkUser("PromoT", "teacher");
    const admin = await mkUser("DemoA", "admin");
    const up = (await invoke(
      personRoute.action,
      post({ intent: "role", userId: teacher.id, role: "admin" }),
    )) as { roleChanged?: boolean };
    expect(up.roleChanged).toBe(true);
    expect((await users.getUserById(teacher.id))?.role).toBe("admin");
    await invoke(personRoute.action, post({ intent: "role", userId: admin.id, role: "teacher" }));
    expect((await users.getUserById(admin.id))?.role).toBe("teacher");
  });

  it("a promotion voids reset links a regular admin minted while the user was a teacher", async () => {
    // Otherwise: regular admin mints a 48h reset link for a teacher, the owner promotes
    // that teacher, and the regular admin redeems the link — taking over an admin.
    actAsRegularAdmin();
    await settings.setOwnerUserId(OWNER_ID);
    const teacher = await mkUser("ResetThenPromote", "teacher");
    const minted = (await invoke(
      personRoute.action,
      post({ intent: "resetPassword", userId: teacher.id }),
    )) as { resetLink?: string };
    const token = minted.resetLink!.split("/reset/")[1];
    expect(await users.getPasswordReset(token)).not.toBeNull();

    await actAsOwner();
    await invoke(personRoute.action, post({ intent: "role", userId: teacher.id, role: "admin" }));
    expect((await users.getUserById(teacher.id))?.role).toBe("admin");
    expect(await users.getPasswordReset(token)).toBeNull();
    expect(await users.consumePasswordReset(token)).toBeNull();
  });

  it("the owner cannot change their own role (never an accidental self-demotion)", async () => {
    await actAsOwner();
    const res = (await invoke(
      personRoute.action,
      post({ intent: "role", userId: OWNER_ID, role: "teacher" }),
    )) as { error?: string };
    expect(res.error).toBe("selfDemote");
    expect((await users.getUserById(OWNER_ID))?.role).toBe("admin");
    expect(await settings.getOwnerUserId()).toBe(OWNER_ID);
  });

  it("the owner cannot delete or reset themselves either", async () => {
    await actAsOwner();
    const del = (await invoke(
      personRoute.action,
      post({ intent: "deleteUser", userId: OWNER_ID }),
    )) as { error?: string };
    expect(del.error).toBe("selfDelete");
    const reset = (await invoke(
      personRoute.action,
      post({ intent: "resetPassword", userId: OWNER_ID }),
    )) as { error?: string };
    expect(reset.error).toBe("selfReset");
    expect(await users.getUserById(OWNER_ID)).not.toBeNull();
  });

  it("no admin changes their own email here — that stays on /account with the password", async () => {
    await actAsOwner();
    const before = (await users.getUserById(OWNER_ID))?.email;
    const own = (await invoke(
      personRoute.action,
      post({ intent: "setEmail", userId: OWNER_ID, email: "hijack@example.com" }),
    )) as { error?: string };
    expect(own.error).toBe("selfEmail");
    expect((await users.getUserById(OWNER_ID))?.email).toBe(before);

    actAsRegularAdmin();
    const self = (await invoke(
      personRoute.action,
      post({ intent: "setEmail", userId: "admin-1", email: "hijack2@example.com" }),
    )) as { error?: string };
    expect(self.error).toBe("selfEmail");
  });

  it("a regular admin cannot delete, reset or re-email another admin", async () => {
    actAsRegularAdmin();
    await settings.setOwnerUserId(OWNER_ID);
    const target = await mkUser("Target", "admin", "target@example.com");

    const del = (await invoke(
      personRoute.action,
      post({ intent: "deleteUser", userId: target.id }),
    )) as { error?: string };
    expect(del.error).toBe("ownerOnly");
    expect(await users.getUserById(target.id)).not.toBeNull();

    const reset = (await invoke(
      personRoute.action,
      post({ intent: "resetPassword", userId: target.id }),
    )) as { error?: string; resetLink?: string };
    expect(reset.error).toBe("ownerOnly");
    expect(reset.resetLink).toBeUndefined();

    const email = (await invoke(
      personRoute.action,
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
      const res = (await invoke(personRoute.action, post_)) as { error?: string };
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
      personRoute.action,
      post({ intent: "setEmail", userId: t.id, email: "teachok2@example.com" }),
    )) as { emailSet?: boolean };
    expect(email.emailSet).toBe(true);
    expect((await users.getUserById(t.id))?.email).toBe("teachok2@example.com");

    const reset = (await invoke(
      personRoute.action,
      post({ intent: "resetPassword", userId: t.id }),
    )) as { resetLink?: string };
    expect(reset.resetLink).toMatch(/\/reset\//);

    const del = (await invoke(
      personRoute.action,
      post({ intent: "deleteUser", userId: t.id }),
    )) as unknown as Response;
    expect(del.status).toBe(302);
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
      personRoute.action,
      post({ intent: "deleteUser", userId: legacy.id }),
    )) as { error?: string };
    expect(res.error).toBe("ownerOnly");
    expect(await users.getUserById(legacy.id)).not.toBeNull();
  });

  it("the owner deletes, resets and re-emails an admin", async () => {
    await actAsOwner();
    const a = await mkUser("OwnerManaged", "admin", "managed@example.com");
    const email = (await invoke(
      personRoute.action,
      post({ intent: "setEmail", userId: a.id, email: "managed2@example.com" }),
    )) as { emailSet?: boolean };
    expect(email.emailSet).toBe(true);
    const reset = (await invoke(
      personRoute.action,
      post({ intent: "resetPassword", userId: a.id }),
    )) as { resetLink?: string };
    expect(reset.resetLink).toMatch(/\/reset\//);
    const del = (await invoke(
      personRoute.action,
      post({ intent: "deleteUser", userId: a.id }),
    )) as unknown as Response;
    expect(del.status).toBe(302);
    expect(await users.getUserById(a.id)).toBeNull();
  });

  it("an action on a user that does not exist is a 404, not a silent success", async () => {
    await actAsOwner();
    for (const intent of ["deleteUser", "resetPassword", "setEmail"]) {
      await expect(
        invoke(personRoute.action, post({ intent, userId: "ghost", email: "g@example.com" })),
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
        personRoute.action,
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

describe("admin.users action — owner accounts (P18.7)", () => {
  async function mkUser(name: string, role: "teacher" | "admin", email = `${name}@example.com`) {
    return users.createUser({ name, email, passwordHash: "scrypt:a:b", role });
  }
  type R = Record<string, unknown> & { error?: string };
  const run = (fields: Record<string, string | string[]>) =>
    invoke(
      fields.intent === "createAccount" ? usersRoute.action : personRoute.action,
      post(fields),
    ) as Promise<R>;
  const create = (extra: Record<string, string> = {}) =>
    run({
      intent: "createAccount",
      name: "New Person",
      email: "newperson@example.com",
      role: "teacher",
      passwordMode: "link",
      ...extra,
    });
  const password = () => import("~/server/password.server");

  it("the owner creates an account with a set-password link; no password works before it is used", async () => {
    await actAsOwner();
    const res = await create();
    expect(res.error).toBeUndefined();
    const link = res.setPasswordLink as string;
    expect(link).toMatch(/^http:\/\/localhost\/reset\/[A-Za-z0-9_-]{40,}$/);

    const row = await users.getUserByEmail("newperson@example.com");
    expect(row?.name).toBe("New Person");
    expect(row?.role).toBe("teacher");
    expect(row?.disabledAt).toBeNull();
    const pw = await password();
    expect(row?.passwordHash).toBe(pw.NO_PASSWORD);
    for (const typed of ["", "none", "anything-at-all"]) {
      expect(await pw.verifyPassword(typed, row!.passwordHash)).toBe(false);
    }

    // The link is a 7-day single-use reset for exactly this account.
    const token = link.split("/reset/")[1];
    const reset = await users.getPasswordReset(token);
    expect(reset?.userId).toBe(row!.id);
    const days = (reset!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7.01);
    // Nothing secret goes back to the client.
    expect(JSON.stringify(res)).not.toContain("scrypt");
    expect(JSON.stringify(res)).not.toContain("passwordHash");
  });

  it("the owner creates an account with an initial password; it is stored hashed", async () => {
    await actAsOwner();
    const secret = "initial-secret-123";
    const res = await create({
      name: "Pw Person",
      email: "pwperson@example.com",
      role: "admin",
      passwordMode: "password",
      password: secret,
      confirm: secret,
    });
    expect(res.accountCreated).toBe(true);
    expect(res.setPasswordLink).toBeUndefined();
    // The plaintext never goes back to the client.
    expect(JSON.stringify(res)).not.toContain(secret);

    const row = await users.getUserByEmail("pwperson@example.com");
    expect(row?.role).toBe("admin");
    expect(row?.passwordHash.startsWith("scrypt:")).toBe(true);
    expect(row?.passwordHash).not.toContain(secret);
    const pw = await password();
    expect(await pw.verifyPassword(secret, row!.passwordHash)).toBe(true);
    expect(await pw.verifyPassword("initial-secret-124", row!.passwordHash)).toBe(false);
    // No reset link was minted in this mode.
    const loginAction = (await import("~/routes/login")).action;
    const ok = await loginAction({
      request: new Request("http://localhost/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: "pwperson@example.com", password: secret }).toString(),
      }),
    } as Parameters<typeof loginAction>[0]);
    expect(ok instanceof Response).toBe(true);
  });

  it("refuses a taken email, a short password and an unknown role", async () => {
    await actAsOwner();
    await mkUser("Taken", "teacher", "taken-p187@example.com");
    const before = (await users.listUsers()).length;

    expect((await create({ email: "taken-p187@example.com" })).error).toBe("emailTaken");
    expect(
      (
        await create({
          email: "short@example.com",
          passwordMode: "password",
          password: "short",
          confirm: "short",
        })
      ).error,
    ).toBe("passwordTooShort");
    expect(
      (
        await create({
          email: "mismatch@example.com",
          passwordMode: "password",
          password: "long-enough-pw",
          confirm: "long-enough-px",
        })
      ).error,
    ).toBe("passwordMismatch");
    expect((await create({ email: "role@example.com", role: "student" })).error).toBe(
      "invalidRole",
    );
    expect((await create({ email: "role@example.com", role: "" })).error).toBe("invalidRole");
    expect((await create({ email: "not-an-email" })).error).toBe("invalidEmail");
    expect((await create({ email: "" })).error).toBe("invalidEmail");
    expect((await create({ email: "noname@example.com", name: "   " })).error).toBe("nameRequired");
    // An unknown mode is not silently treated as "link".
    expect((await create({ email: "mode@example.com", passwordMode: "magic" })).error).toBe(
      "unknown",
    );

    // Nothing was created by any of the refusals, and no reset link was minted.
    expect((await users.listUsers()).length).toBe(before);
    for (const e of ["short", "mismatch", "role", "noname", "mode"]) {
      expect(await users.getUserByEmail(`${e}@example.com`)).toBeNull();
    }
  });

  it("the owner sets a password: old cookies stop, the new password works", async () => {
    await actAsOwner();
    const auth = await import("~/server/auth.server");
    const pw = await password();
    const target = await users.createUser({
      name: "SetPw",
      email: "setpw@example.com",
      passwordHash: await pw.hashPassword("old-password-xx"),
      role: "teacher",
    });
    const cookie = (
      (await auth.createUserSession(target.id, "/")).headers.get("Set-Cookie") ?? ""
    ).split(";")[0];
    const asReq = () => new Request("http://localhost/", { headers: { Cookie: cookie } });
    expect((await auth.getUser(asReq()))?.id).toBe(target.id);

    const res = await run({
      intent: "setPassword",
      userId: target.id,
      password: "brand-new-secret",
      confirm: "brand-new-secret",
    });
    expect(res.passwordSet).toBe(true);
    expect(JSON.stringify(res)).not.toContain("brand-new-secret");
    const row = await users.getUserById(target.id);
    expect(await pw.verifyPassword("brand-new-secret", row!.passwordHash)).toBe(true);
    expect(await pw.verifyPassword("old-password-xx", row!.passwordHash)).toBe(false);
    expect(await auth.getUser(asReq())).toBeNull(); // logged out everywhere
  });

  it("setting a password voids the user's open reset and set-password links", async () => {
    await actAsOwner();
    const created = await run({
      intent: "createAccount",
      name: "Link Then Set",
      email: "linkthenset@example.com",
      role: "teacher",
      passwordMode: "link",
    });
    const token = String(created.setPasswordLink).split("/reset/")[1];
    const target = await users.getUserByEmail("linkthenset@example.com");
    const other = await users.createPasswordReset(target!.id);

    const res = await run({
      intent: "setPassword",
      userId: target!.id,
      password: "owner-chosen-secret",
      confirm: "owner-chosen-secret",
    });
    expect(res.passwordSet).toBe(true);
    // Whoever holds an older link can no longer overwrite the owner's password.
    expect(await users.getPasswordReset(token)).toBeNull();
    expect(await users.getPasswordReset(other.token)).toBeNull();
  });

  it("setPassword refuses a short or mismatching password and changes nothing", async () => {
    await actAsOwner();
    const pw = await password();
    const target = await users.createUser({
      name: "SetPwBad",
      email: "setpwbad@example.com",
      passwordHash: await pw.hashPassword("old-password-xx"),
      role: "teacher",
    });
    const v0 = (await users.getUserById(target.id))!.sessionVersion;
    expect(
      (await run({ intent: "setPassword", userId: target.id, password: "short", confirm: "short" }))
        .error,
    ).toBe("passwordTooShort");
    expect(
      (
        await run({
          intent: "setPassword",
          userId: target.id,
          password: "long-enough-pw",
          confirm: "long-enough-px",
        })
      ).error,
    ).toBe("passwordMismatch");
    const row = await users.getUserById(target.id);
    expect(await pw.verifyPassword("old-password-xx", row!.passwordHash)).toBe(true);
    expect(row!.sessionVersion).toBe(v0);
  });

  it("the owner deactivates and reactivates a user, never themself", async () => {
    await actAsOwner();
    const auth = await import("~/server/auth.server");
    const target = await mkUser("Toggle", "teacher", "toggle@example.com");
    const cookie = (
      (await auth.createUserSession(target.id, "/")).headers.get("Set-Cookie") ?? ""
    ).split(";")[0];
    const asReq = () => new Request("http://localhost/", { headers: { Cookie: cookie } });

    const off = await run({ intent: "deactivate", userId: target.id });
    expect(off.error).toBeUndefined();
    expect((await users.getUserById(target.id))?.disabledAt).toBeInstanceOf(Date);
    expect(await auth.getUser(asReq())).toBeNull();

    const on = await run({ intent: "reactivate", userId: target.id });
    expect(on.error).toBeUndefined();
    expect((await users.getUserById(target.id))?.disabledAt).toBeNull();
    expect(await auth.getUser(asReq())).toBeNull(); // the old cookie stays dead

    // Never themself.
    const self = await run({ intent: "deactivate", userId: OWNER_ID });
    expect(self.error).toBe("selfDeactivate");
    expect((await run({ intent: "reactivate", userId: OWNER_ID })).error).toBe("selfDeactivate");
    expect((await users.getUserById(OWNER_ID))?.disabledAt).toBeNull();
    const selfPw = await run({
      intent: "setPassword",
      userId: OWNER_ID,
      password: "brand-new-secret",
      confirm: "brand-new-secret",
    });
    expect(selfPw.error).toBe("selfPassword");
    expect((await users.getUserById(OWNER_ID))?.passwordHash).toBe("scrypt:x:y");
  });

  it("the owner may deactivate another admin and set an admin's password", async () => {
    await actAsOwner();
    const a = await mkUser("OtherAdmin", "admin", "otheradmin-p187@example.com");
    expect((await run({ intent: "deactivate", userId: a.id })).error).toBeUndefined();
    expect((await users.getUserById(a.id))?.disabledAt).toBeInstanceOf(Date);
    const res = await run({
      intent: "setPassword",
      userId: a.id,
      password: "brand-new-secret",
      confirm: "brand-new-secret",
    });
    expect(res.passwordSet).toBe(true);
    // Setting a password for a deactivated account does not reactivate it.
    expect((await users.getUserById(a.id))?.disabledAt).toBeInstanceOf(Date);
  });

  it("a regular admin can do none of these (ownerOnly), and nothing changes", async () => {
    actAsRegularAdmin();
    await settings.setOwnerUserId(OWNER_ID);
    const target = await mkUser("Untouched", "teacher", "untouched@example.com");
    const before = await users.getUserById(target.id);
    const count = (await users.listUsers()).length;

    const attempts: Record<string, string>[] = [
      {
        intent: "createAccount",
        name: "Sneaky",
        email: "sneaky@example.com",
        role: "admin",
        passwordMode: "link",
      },
      {
        intent: "createAccount",
        name: "Sneaky",
        email: "sneaky2@example.com",
        role: "teacher",
        passwordMode: "password",
        password: "sneaky-password-1",
        confirm: "sneaky-password-1",
      },
      {
        intent: "setPassword",
        userId: target.id,
        password: "sneaky-password-1",
        confirm: "sneaky-password-1",
      },
      { intent: "deactivate", userId: target.id },
      { intent: "reactivate", userId: target.id },
      // Not even on themselves or on the owner.
      { intent: "deactivate", userId: "admin-1" },
      {
        intent: "setPassword",
        userId: OWNER_ID,
        password: "sneaky-password-1",
        confirm: "sneaky-password-1",
      },
      { intent: "deactivate", userId: OWNER_ID },
    ];
    for (const fields of attempts) {
      const res = await run(fields);
      expect(res.error, JSON.stringify(fields)).toBe("ownerOnly");
      expect(res.setPasswordLink).toBeUndefined();
    }
    expect(await users.getUserById(target.id)).toEqual(before);
    expect((await users.listUsers()).length).toBe(count);
    expect(await users.getUserByEmail("sneaky@example.com")).toBeNull();
    expect((await users.getUserById(OWNER_ID))?.disabledAt).toBeNull();
    expect((await users.getUserById(OWNER_ID))?.passwordHash).toBe("scrypt:x:y");
  });

  it("with no owner set, nobody may use the owner intents", async () => {
    actAsRegularAdmin();
    await settings.setOwnerUserId(null);
    const target = await mkUser("NoOwnerT", "teacher", "noownert@example.com");
    expect((await run({ intent: "deactivate", userId: target.id })).error).toBe("ownerOnly");
    expect((await create({ email: "noowner@example.com" })).error).toBe("ownerOnly");
  });

  it("deactivate, reactivate and setPassword on a missing user are a 404; a legacy row is too", async () => {
    await actAsOwner();
    for (const intent of ["deactivate", "reactivate", "setPassword"]) {
      await expect(
        run({ intent, userId: "ghost", password: "brand-new-secret", confirm: "brand-new-secret" }),
      ).rejects.toMatchObject({ status: 404 });
    }
    const legacy = await users.createUser({
      name: "Old Student 2",
      email: "old-student2@example.com",
      passwordHash: "scrypt:x:y",
      role: "student" as never,
    });
    await expect(run({ intent: "deactivate", userId: legacy.id })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("the loader reports which users are deactivated, and never a hash", async () => {
    await actAsOwner();
    const t = await mkUser("ListedOff", "teacher", "listedoff@example.com");
    await users.setUserDisabled(t.id, true);
    const data = (await invoke(usersRoute.loader, new Request("http://localhost/admin/users"))) as {
      people: (Record<string, unknown> & { id: string; status: string })[];
    };
    expect(data.people.find((u) => u.id === t.id)?.status).toBe("disabled");
    expect(data.people.find((u) => u.id === OWNER_ID)?.status).toBe("active");
    expect(JSON.stringify(data)).not.toContain("scrypt");
    expect(JSON.stringify(data)).not.toContain("passwordHash");
  });

  it("the owner can still mint a reset link for a deactivated user (it works once they are reactivated)", async () => {
    await actAsOwner();
    const t = await mkUser("ResetOff", "teacher", "resetoff@example.com");
    await users.setUserDisabled(t.id, true);
    const res = await run({ intent: "resetPassword", userId: t.id });
    expect(res.resetLink).toMatch(/\/reset\//);
  });
});

describe("admin users — the list and the person page (P28.1)", () => {
  const get = (path: string) => new Request(`http://localhost${path}`);
  const loadPerson = (id: string) =>
    personRoute.loader({
      request: get(`/admin/users/${id}`),
      params: { id },
      context: {},
    } as unknown as Parameters<typeof personRoute.loader>[0]);

  it("the list loader filters on the server, from the query string", async () => {
    const t = await users.createUser({
      name: "Zoë Zoekbaar",
      email: "zoe@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    await users.createInvite({ role: "teacher", note: "Zoë's collega" });
    const data = (await invoke(usersRoute.loader, get("/admin/users?q=zoë&status=active"))) as {
      people: { id: string; kind: string }[];
      filter: { q: string; role: string; status: string };
    };
    expect(data.people.map((p) => p.id)).toEqual([t.id]);
    expect(data.filter).toEqual({ q: "zoë", role: "", status: "active", team: "" });
  });

  it("the list loader ignores a filter value it does not know", async () => {
    const data = (await invoke(
      usersRoute.loader,
      get("/admin/users?role=student&status=gone"),
    )) as { people: unknown[]; filter: { role: string; status: string } };
    expect(data.filter).toMatchObject({ role: "", status: "" });
    expect(data.people.length).toBeGreaterThan(0);
  });

  it("the list gives an open invite its link to copy", async () => {
    const invite = await users.createInvite({ role: "teacher", note: "Copy Me" });
    const data = (await invoke(usersRoute.loader, get("/admin/users?q=copy%20me"))) as {
      people: { kind: string; link?: string }[];
    };
    expect(data.people).toEqual([
      expect.objectContaining({ kind: "invite", link: `http://localhost/invite/${invite.token}` }),
    ]);
  });

  it("the person loader 404s an unknown id", async () => {
    await expect(loadPerson("ghost")).rejects.toMatchObject({ status: 404 });
  });

  it("the person loader shows a regular admin another admin, without managing it", async () => {
    actAsRegularAdmin();
    const other = await users.createUser({
      name: "Other Admin",
      email: "otheradmin-p281@example.com",
      passwordHash: "scrypt:a:b",
      role: "admin",
    });
    const data = (await loadPerson(other.id)) as {
      person: { id: string; email: string | null };
      canManage: boolean;
      models: unknown;
    };
    expect(data.person.id).toBe(other.id);
    expect(data.canManage).toBe(false);
    expect(data.models).toBeNull(); // models are per teacher
    expect(JSON.stringify(data)).not.toContain("scrypt");
  });

  it("the person action acts on the user in the URL, never on a userId in the form", async () => {
    const inUrl = await users.createUser({
      name: "In Url",
      email: "inurl@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const inForm = await users.createUser({
      name: "In Form",
      email: "inform@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    await personRoute.action({
      request: post({ intent: "setEmail", userId: inForm.id, email: "moved@example.com" }),
      params: { id: inUrl.id },
      context: {},
    } as unknown as Parameters<typeof personRoute.action>[0]);
    expect((await users.getUserById(inUrl.id))?.email).toBe("moved@example.com");
    expect((await users.getUserById(inForm.id))?.email).toBe("inform@example.com");
  });

  it("the list action no longer takes the person intents", async () => {
    const t = await users.createUser({
      name: "Not Here",
      email: "nothere@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    for (const intent of ["deleteUser", "resetPassword", "setEmail", "role", "teacherModels"]) {
      const res = (await usersRoute.action({
        request: post({ intent, userId: t.id, email: "x@example.com", role: "admin" }),
        params: {},
        context: {},
      } as unknown as Parameters<typeof usersRoute.action>[0])) as { error?: string };
      expect(res.error, intent).toBe("unknown");
    }
    expect(await users.getUserById(t.id)).toMatchObject({ email: "nothere@example.com" });
  });
});
