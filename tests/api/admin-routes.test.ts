import { describe, it, expect, beforeAll, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

// The admin is always "admin-1"; every route's requireRole returns them.
const { requireRoleMock } = vi.hoisted(() => ({ requireRoleMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireRole: requireRoleMock }));

type ToolsRoute = typeof import("~/routes/admin.tools");
type ModelsRoute = typeof import("~/routes/admin.models");
type InvitesRoute = typeof import("~/routes/admin.invites");
type CohortsRoute = typeof import("~/routes/admin.cohorts");
type ContextRoute = typeof import("~/routes/admin.context");
type Settings = typeof import("~/server/repositories/settings.server");
type Users = typeof import("~/server/repositories/users.server");
type Cohorts = typeof import("~/server/repositories/cohorts.server");

let toolsRoute: ToolsRoute;
let modelsRoute: ModelsRoute;
let invitesRoute: InvitesRoute;
let cohortsRoute: CohortsRoute;
let contextRoute: ContextRoute;
let settings: Settings;
let users: Users;
let cohorts: Cohorts;

beforeAll(async () => {
  [toolsRoute, modelsRoute, invitesRoute, cohortsRoute, contextRoute, settings, users, cohorts] =
    await Promise.all([
      import("~/routes/admin.tools"),
      import("~/routes/admin.models"),
      import("~/routes/admin.invites"),
      import("~/routes/admin.cohorts"),
      import("~/routes/admin.context"),
      import("~/server/repositories/settings.server"),
      import("~/server/repositories/users.server"),
      import("~/server/repositories/cohorts.server"),
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
  it("upserts a tool's enabled flag and audience override", async () => {
    await invoke(toolsRoute.action, post({ slug: "mentorai", enabled: "on", audience: "both" }));
    const row = await settings.getToolSetting("mentorai");
    expect(row?.enabled).toBe(true);
    expect(row?.audienceOverride).toBe("both");
  });
});

describe("admin.models action — lockout guard", () => {
  it("refuses an empty selection and does not persist", async () => {
    const res = (await invoke(modelsRoute.action, post({}))) as {
      error?: boolean;
      saved?: boolean;
    };
    expect(res.error).toBe(true);
    expect(await settings.getEnabledModels()).toBeNull(); // unchanged
  });

  it("persists a non-empty allow-list", async () => {
    const res = (await invoke(modelsRoute.action, post({ models: ["claude-haiku-4-5"] }))) as {
      saved?: boolean;
    };
    expect(res.saved).toBe(true);
    expect(await settings.getEnabledModels()).toEqual(["claude-haiku-4-5"]);
    await settings.setEnabledModels(null); // reset
  });
});

describe("admin.models action — per-teacher assignment (P13)", () => {
  it("persists a per-teacher model subset (narrows within the base)", async () => {
    await settings.setEnabledModels(null); // base = full selectable catalog
    const teacher = await users.createUser({
      name: "Model Teacher",
      email: "modelteacher@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const res = (await invoke(
      modelsRoute.action,
      post({ intent: "teacher", userId: teacher.id, models: ["claude-haiku-4-5"] }),
    )) as { saved?: boolean };
    expect(res.saved).toBe(true);
    expect([...(await users.getUserAssignedModels(teacher.id))!]).toEqual(["claude-haiku-4-5"]);
  });

  it("stores null (inherit) when all base models are selected, or none are", async () => {
    await settings.setEnabledModels(null);
    const teacher = await users.createUser({
      name: "Inherit Teacher",
      email: "inheritteacher@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    // All base models checked → inherit (not a stored full list).
    await invoke(
      modelsRoute.action,
      post({
        intent: "teacher",
        userId: teacher.id,
        models: ["claude-sonnet-4-6", "claude-haiku-4-5"],
      }),
    );
    expect(await users.getUserAssignedModels(teacher.id)).toBeNull();
    // None checked → inherit, never a lockout.
    await users.setUserAssignedModels(teacher.id, ["claude-haiku-4-5"]);
    await invoke(modelsRoute.action, post({ intent: "teacher", userId: teacher.id }));
    expect(await users.getUserAssignedModels(teacher.id)).toBeNull();
  });

  it("404s an unknown or non-teacher target", async () => {
    await expect(
      invoke(
        modelsRoute.action,
        post({ intent: "teacher", userId: "nobody", models: ["claude-haiku-4-5"] }),
      ),
    ).rejects.toMatchObject({ status: 404 });
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
    expect(await settings.getEnabledCountries()).toBeNull();
  });

  it("refuses when either axis is empty (a country but no sector)", async () => {
    const res = (await invoke(
      contextRoute.action,
      post({ intent: "instance", countries: ["NL"] }),
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
        countries: ["NL", "XX"],
        sectors: ["hbo", "wo", "bogus"],
        domains: ["ICT", "not-a-domain", "nt"],
      }),
    )) as { saved?: boolean };
    expect(res.saved).toBe(true);
    expect(await settings.getEnabledCountries()).toEqual(["NL"]);
    expect(await settings.getEnabledSectors()).toEqual(["hbo", "wo"]);
    expect(await settings.getEnabledDomains()).toEqual(["ICT", "nt"]);
    // Reset so later tests see the default-open state.
    await settings.setEnabledCountries(null);
    await settings.setEnabledSectors(null);
    await settings.setEnabledDomains(null);
  });

  it("clears instance domains when none are submitted (empty = all)", async () => {
    await settings.setEnabledDomains(["nt"]);
    await invoke(
      contextRoute.action,
      post({ intent: "instance", countries: ["NL"], sectors: ["hbo"] }),
    );
    expect(await settings.getEnabledDomains()).toBeNull();
    await settings.setEnabledCountries(null);
    await settings.setEnabledSectors(null);
  });

  it("loader builds all-checked rows + domain catalogue when nothing is configured", async () => {
    const data = (await invoke(contextRoute.loader, post({}))) as {
      countries: { id: string; checked: boolean }[];
      sectors: { id: string; checked: boolean }[];
      enabledDomains: string[] | null;
      domainCatalogueSectors: { sector: string; groups: unknown[] }[];
    };
    expect(data.countries.every((c) => c.checked)).toBe(true);
    expect(data.sectors.every((s) => s.checked)).toBe(true);
    expect(data.sectors.map((s) => s.id)).toEqual(["vo", "mbo", "hbo", "wo"]);
    // The instance domain axis: unset = null (= all), and the shared catalogue
    // carries the catalogued sectors (vo + hbo).
    expect(data.enabledDomains).toBeNull();
    expect(data.domainCatalogueSectors.map((d) => d.sector).sort()).toEqual(["hbo", "vo"]);
  });
});

describe("admin.context action — activation + per-teacher assignment (P12)", () => {
  it("activating persists the flag + axes; an empty axis is unrestricted", async () => {
    const teacher = await users.createUser({
      name: "Assignable",
      email: "assignable@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const res = (await invoke(
      contextRoute.action,
      post({
        intent: "teacher",
        userId: teacher.id,
        customAccess: "1",
        countries: ["NL"],
        sectors: ["mbo", "hbo"],
      }),
    )) as { saved?: boolean };
    expect(res.saved).toBe(true);
    expect(await users.getUserContextCustomAccess(teacher.id)).toBe(true);
    expect([...(await users.getUserAssignedCountries(teacher.id))!]).toEqual(["NL"]);
    expect([...(await users.getUserAssignedSectors(teacher.id))!].sort()).toEqual(["hbo", "mbo"]);

    // Still activated, but sectors omitted → that axis clears to unrestricted.
    await invoke(
      contextRoute.action,
      post({ intent: "teacher", userId: teacher.id, customAccess: "1", countries: ["NL"] }),
    );
    expect(await users.getUserContextCustomAccess(teacher.id)).toBe(true);
    expect(await users.getUserAssignedSectors(teacher.id)).toBeNull();
  });

  it("deactivating flips the flag off and leaves the saved assignments untouched", async () => {
    const teacher = await users.createUser({
      name: "Toggle",
      email: "toggle@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    // Activate + assign all three axes.
    await invoke(
      contextRoute.action,
      post({
        intent: "teacher",
        userId: teacher.id,
        customAccess: "1",
        sectors: ["mbo", "hbo"],
        domains: ["ICT"],
      }),
    );
    // Deactivate: no customAccess field → the flag goes off, assignments preserved.
    const res = (await invoke(
      contextRoute.action,
      post({ intent: "teacher", userId: teacher.id }),
    )) as { saved?: boolean };
    expect(res.saved).toBe(true);
    expect(await users.getUserContextCustomAccess(teacher.id)).toBe(false);
    expect([...(await users.getUserAssignedSectors(teacher.id))!].sort()).toEqual(["hbo", "mbo"]);
    expect([...(await users.getUserAssignedDomains(teacher.id))!]).toEqual(["ICT"]);

    // Re-activating restores exactly what was saved (round-trip).
    await invoke(
      contextRoute.action,
      post({
        intent: "teacher",
        userId: teacher.id,
        customAccess: "1",
        sectors: ["mbo", "hbo"],
        domains: ["ICT"],
      }),
    );
    expect(await users.getUserContextCustomAccess(teacher.id)).toBe(true);
  });

  it("catalogue-filters submitted codes + domains before writing (activated)", async () => {
    const teacher = await users.createUser({
      name: "Filtered",
      email: "filtered@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    await invoke(
      contextRoute.action,
      post({
        intent: "teacher",
        userId: teacher.id,
        customAccess: "1",
        sectors: ["wo", "not-a-sector"],
        domains: ["nt", "not-a-domain", "zw"],
      }),
    );
    expect([...(await users.getUserAssignedSectors(teacher.id))!]).toEqual(["wo"]);
    expect([...(await users.getUserAssignedDomains(teacher.id))!].sort()).toEqual(["nt", "zw"]);
  });

  it("refuses (404) a per-teacher write whose userId is not a teacher", async () => {
    const student = await users.createUser({
      name: "Not a teacher",
      passwordHash: "scrypt:a:b",
      role: "student",
    });
    await expect(
      invoke(
        contextRoute.action,
        post({ intent: "teacher", userId: student.id, customAccess: "1", sectors: ["mbo"] }),
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(await users.getUserAssignedSectors(student.id)).toBeNull(); // never written
    expect(await users.getUserContextCustomAccess(student.id)).toBe(false);
  });

  it("refuses (404) a per-teacher write for an unknown userId", async () => {
    await expect(
      invoke(contextRoute.action, post({ intent: "teacher", userId: "ghost", sectors: ["mbo"] })),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("admin.invites action", () => {
  it("mints a teacher invite carrying the chosen tool allow-list", async () => {
    const res = (await invoke(
      invitesRoute.action,
      post({ intent: "mint", toolMode: "restrict", tools: ["bloom-by-design"] }),
    )) as { link?: string };
    expect(res.link).toMatch(/\/invite\//);
    const token = res.link!.split("/invite/")[1];
    const invite = await users.getInvite(token);
    expect(invite?.role).toBe("teacher");
    expect(JSON.parse(invite!.allowedToolSlugs!)).toEqual(["bloom-by-design"]);
  });

  it("blocks an admin from changing their OWN role (self-demote guard)", async () => {
    const res = (await invoke(
      invitesRoute.action,
      post({ intent: "role", userId: "admin-1", role: "teacher" }),
    )) as { error?: string };
    expect(res.error).toBe("selfDemote");
  });

  it("promotes an existing user in place (role only — no new account, no password change)", async () => {
    const teacher = await users.createUser({
      name: "Promote Me",
      email: "promote@example.com",
      passwordHash: "scrypt:keep:me",
      role: "teacher",
    });
    await invoke(invitesRoute.action, post({ intent: "role", userId: teacher.id, role: "admin" }));
    const after = await users.getUserById(teacher.id);
    expect(after?.role).toBe("admin");
    expect(after?.passwordHash).toBe("scrypt:keep:me"); // untouched
  });

  it("revokes an open invite (its token becomes unknown)", async () => {
    const invite = await users.createInvite({ role: "teacher", createdByUserId: "admin-1" });
    await invoke(invitesRoute.action, post({ intent: "revoke", token: invite.token }));
    expect(await users.getInvite(invite.token)).toBeNull();
  });

  it("blocks an admin from deleting their OWN account (use /account instead)", async () => {
    const res = (await invoke(
      invitesRoute.action,
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
      invitesRoute.action,
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
      invitesRoute.action,
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
      role: "student",
    });
    await invoke(
      invitesRoute.action,
      post({ intent: "setEmail", userId: student.id, email: "recovered@example.com" }),
    );
    expect((await users.getUserById(student.id))?.email).toBe("recovered@example.com");
  });
});

describe("admin.cohorts action — oversight over any cohort", () => {
  it("assigns and removes a co-teacher, and deletes a cohort the admin did not create", async () => {
    const cohort = await cohorts.createCohort({
      createdByUserId: "some-teacher",
      name: "Not the admin's cohort",
      allowedToolSlugs: ["mentorai"],
    });

    await invoke(
      cohortsRoute.action,
      post({ intent: "assign", cohortId: cohort.id, userId: "co-t" }),
    );
    expect((await cohorts.getCohortTeacherIds(cohort.id)).has("co-t")).toBe(true);

    await invoke(
      cohortsRoute.action,
      post({ intent: "remove", cohortId: cohort.id, userId: "co-t" }),
    );
    expect((await cohorts.getCohortTeacherIds(cohort.id)).has("co-t")).toBe(false);

    await invoke(cohortsRoute.action, post({ intent: "delete", cohortId: cohort.id }));
    expect(await cohorts.getCohort(cohort.id)).toBeNull();
  });

  it("reassigns ownership of an orphan cohort to a new teacher", async () => {
    const orphan = await cohorts.createCohort({
      createdByUserId: "deleted-owner",
      name: "Orphaned cohort",
      allowedToolSlugs: ["mentorai"],
    });
    await invoke(
      cohortsRoute.action,
      post({ intent: "reassignOwner", cohortId: orphan.id, userId: "new-owner" }),
    );
    expect((await cohorts.getCohort(orphan.id))?.createdByUserId).toBe("new-owner");
  });
});
