import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { flatRoutes } from "../helpers/routes";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let users: typeof import("~/server/repositories/users.server");
let settings: typeof import("~/server/repositories/settings.server");
let audit: typeof import("~/server/repositories/auditLog.server");
let list: typeof import("~/routes/admin.users");
let person: typeof import("~/routes/admin.users.$id");
let tools: typeof import("~/routes/admin.tools");
let auditRoute: typeof import("~/routes/admin.audit");

beforeAll(async () => {
  users = await import("~/server/repositories/users.server");
  settings = await import("~/server/repositories/settings.server");
  audit = await import("~/server/repositories/auditLog.server");
  list = await import("~/routes/admin.users");
  person = await import("~/routes/admin.users.$id");
  tools = await import("~/routes/admin.tools");
  auditRoute = await import("~/routes/admin.audit");
});

let n = 0;
async function mk(name: string, role: "teacher" | "admin" = "teacher") {
  n++;
  return users.createUser({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}.${n}@school.nl`,
    passwordHash: "scrypt:a:b",
    role,
  });
}
const as = (u: { id: string }) => signInAs({ id: u.id });

function post(fields: Record<string, string | string[]>): Request {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields))
    for (const value of Array.isArray(v) ? v : [v]) body.append(k, value);
  return signedRequest("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}
const call = <F extends (a: never) => unknown>(fn: F, args: object) =>
  fn({ params: {}, context: {}, ...args } as never) as Promise<Awaited<ReturnType<F>>>;
const onPerson = (id: string, fields: Record<string, string | string[]>) =>
  call(person.action, { request: post(fields), params: { id } });
const onList = (fields: Record<string, string | string[]>) =>
  call(list.action, { request: post(fields) });

/** The newest entry, as the log page shows it. */
const latest = async () => (await audit.listAdminActions())[0];

let owner: Awaited<ReturnType<typeof mk>>;
beforeEach(async () => {
  owner ??= await mk("Eigenaar", "admin");
  await settings.setOwnerUserId(owner.id);
  await as(owner);
});

describe("the audit log records every admin action that changes access", () => {
  it("a role change, with who did it, to whom, and from what to what", async () => {
    const t = await mk("Rol Docent");
    await onPerson(t.id, { intent: "role", role: "admin" });
    expect(await latest()).toMatchObject({
      action: "roleChanged",
      actorUserId: owner.id,
      actorName: "Eigenaar",
      targetUserId: t.id,
      targetName: "Rol Docent",
      detail: { from: "teacher", to: "admin" },
    });
  });

  it("a password set by the owner, and a reset link, never the password itself", async () => {
    const t = await mk("Wachtwoord Docent");
    await onPerson(t.id, {
      intent: "setPassword",
      password: "geheim-geheim",
      confirm: "geheim-geheim",
    });
    const set = await latest();
    expect(set).toMatchObject({ action: "passwordSet", targetUserId: t.id });
    expect(JSON.stringify(set)).not.toContain("geheim");

    await onPerson(t.id, { intent: "resetPassword" });
    const reset = await latest();
    expect(reset).toMatchObject({ action: "resetLinkCreated", targetUserId: t.id });
    // The single-use link is a secret: it never lands in the log.
    expect(JSON.stringify(reset)).not.toMatch(/reset\//);
  });

  it("deactivation and reactivation, on the person page and in bulk", async () => {
    const a = await mk("Uit A");
    const b = await mk("Uit B");
    await onPerson(a.id, { intent: "deactivate" });
    expect(await latest()).toMatchObject({ action: "deactivated", targetUserId: a.id });
    await onPerson(a.id, { intent: "reactivate" });
    expect(await latest()).toMatchObject({ action: "reactivated", targetUserId: a.id });

    await onList({ intent: "bulk", action: "deactivate", userIds: [a.id, b.id] });
    const [first, second] = await audit.listAdminActions();
    expect([first?.targetUserId, second?.targetUserId].sort()).toEqual([a.id, b.id].sort());
    expect(first).toMatchObject({ action: "deactivated", detail: { bulk: true } });
  });

  it("an invite, a pasted list of invites and a revoked invite, without names or links", async () => {
    const minted = (await onList({ intent: "mint", note: "Voor Piet" })) as { link: string };
    const created = await latest();
    expect(created).toMatchObject({
      action: "inviteCreated",
      targetUserId: null,
      detail: { count: 1 },
    });
    expect(JSON.stringify(created)).not.toContain("Piet");

    await onList({ intent: "mintList", people: "Ann <ann@school.nl>\nBob <bob@school.nl>" });
    expect(await latest()).toMatchObject({ action: "inviteCreated", detail: { count: 2 } });

    const token = minted.link.split("/invite/")[1] ?? "";
    await onList({ intent: "revoke", token });
    const revoked = await latest();
    expect(revoked).toMatchObject({ action: "inviteRevoked" });
    expect(JSON.stringify(revoked)).not.toContain(token);
  });

  it("an account created and an account deleted, which stays in the log", async () => {
    await onList({
      intent: "createAccount",
      name: "Nieuw Account",
      email: "nieuw.account@school.nl",
      role: "teacher",
      passwordMode: "link",
    });
    const created = await latest();
    expect(created).toMatchObject({
      action: "accountCreated",
      targetName: "Nieuw Account",
      detail: { role: "teacher" },
    });

    const id = created?.targetUserId ?? "";
    await onPerson(id, { intent: "deleteUser" });
    expect(await latest()).toMatchObject({
      action: "accountDeleted",
      targetUserId: id,
      // The account is gone; the log keeps the fact, not the person's name.
      targetName: null,
    });
  });

  it("the model choice of the instance and of one teacher", async () => {
    await call(tools.action, { request: post({ intent: "models", models: ["claude-haiku-4-5"] }) });
    expect(await latest()).toMatchObject({
      action: "instanceModelsChanged",
      targetUserId: null,
      detail: { models: ["claude-haiku-4-5"] },
    });

    const t = await mk("Model Docent");
    await onPerson(t.id, { intent: "teacherModels", mode: "own", models: ["claude-haiku-4-5"] });
    expect(await latest()).toMatchObject({
      action: "teacherModelsChanged",
      targetUserId: t.id,
      detail: { models: ["claude-haiku-4-5"] },
    });
    await onPerson(t.id, { intent: "teacherModels", mode: "inherit" });
    expect(await latest()).toMatchObject({
      action: "teacherModelsChanged",
      detail: { models: null },
    });
  });

  it("records nothing when an action is refused", async () => {
    await settings.setOwnerUserId(null); // now a regular admin
    const t = await mk("Geweigerd");
    const before = (await audit.listAdminActions()).length;
    expect(await onPerson(t.id, { intent: "role", role: "admin" })).toEqual({ error: "ownerOnly" });
    expect(await onPerson(t.id, { intent: "deactivate" })).toEqual({ error: "ownerOnly" });
    await onList({ intent: "revoke", token: "bestaat-niet" });
    expect((await audit.listAdminActions()).length).toBe(before);
  });
});

describe("the log page (/admin/audit)", () => {
  it("is an admin route", () => {
    expect(flatRoutes()).toContainEqual(
      expect.objectContaining({ path: "/admin/audit", file: "routes/admin.audit.tsx" }),
    );
  });

  it("lists the newest entries first, for an admin", async () => {
    const t = await mk("Pagina Docent");
    await onPerson(t.id, { intent: "deactivate" });
    await onPerson(t.id, { intent: "reactivate" });
    const data = await call(auditRoute.loader, {
      request: signedRequest("http://localhost/admin/audit"),
    });
    expect(data.entries[0]).toMatchObject({ action: "reactivated", targetName: "Pagina Docent" });
    expect(data.entries[1]).toMatchObject({ action: "deactivated" });
  });

  it("is closed to a teacher", async () => {
    await as(await mk("Nieuwsgierig"));
    await expect(
      call(auditRoute.loader, { request: signedRequest("http://localhost/admin/audit") }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("caps the list", async () => {
    for (let i = 0; i < 5; i++) {
      await audit.recordAdminAction({
        actorUserId: owner.id,
        action: "inviteCreated",
        detail: { count: 1 },
      });
    }
    expect(await audit.listAdminActions(3)).toHaveLength(3);
  });
});

const DAY = 24 * 60 * 60 * 1000;

/** Record one entry as if it happened `daysAgo` days ago. */
async function recordAgo(daysAgo: number) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(Date.now() - daysAgo * DAY));
  try {
    await audit.recordAdminAction({ actorUserId: owner.id, action: "inviteRevoked" });
  } finally {
    vi.useRealTimers();
  }
}
const ages = async () =>
  (await audit.listAdminActions(500)).map((e) => Math.round((Date.now() - +e.at) / DAY));
const cleanup = (fields: Record<string, string>) =>
  call(auditRoute.action, { request: post({ intent: "cleanup", ...fields }) });

describe("cleaning up the log", () => {
  it("keeps a year: older entries go when a new action is recorded", async () => {
    await cleanup({ olderThan: "all" });
    await recordAgo(400);
    await recordAgo(300);
    await audit.recordAdminAction({ actorUserId: owner.id, action: "inviteRevoked" });
    const left = await ages();
    expect(left.some((d) => d >= 365)).toBe(false);
    expect(left).toContain(300);
  });

  it("keeps a year: opening the page also clears what is older", async () => {
    await cleanup({ olderThan: "all" });
    await recordAgo(400);
    await call(auditRoute.loader, { request: signedRequest("http://localhost/admin/audit") });
    expect((await ages()).some((d) => d >= 365)).toBe(false);
  });

  it("the owner removes entries older than a chosen age, and that is logged itself", async () => {
    await cleanup({ olderThan: "all" });
    await recordAgo(100);
    await recordAgo(40);
    await recordAgo(5);
    expect(await cleanup({ olderThan: "30" })).toEqual({ cleaned: 2 });
    const entries = await audit.listAdminActions();
    expect(entries[0]).toMatchObject({
      action: "logCleaned",
      actorUserId: owner.id,
      detail: { olderThanDays: 30, count: 2 },
    });
    expect((await ages()).filter((d) => d >= 30)).toEqual([]);
  });

  it("the owner can clear everything; only the cleanup itself remains", async () => {
    await recordAgo(2);
    await cleanup({ olderThan: "all" });
    const entries = await audit.listAdminActions();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ action: "logCleaned", detail: { olderThanDays: null } });
  });

  it("refuses a regular admin and an unknown choice, deleting nothing", async () => {
    await recordAgo(100);
    const before = (await audit.listAdminActions(500)).length;
    expect(await cleanup({ olderThan: "7" })).toEqual({ error: "invalid" });
    await settings.setOwnerUserId(null);
    expect(await cleanup({ olderThan: "all" })).toEqual({ error: "ownerOnly" });
    expect((await audit.listAdminActions(500)).length).toBe(before);
  });

  it("tells the page whether the viewer may clean up", async () => {
    const req = () => signedRequest("http://localhost/admin/audit");
    expect((await call(auditRoute.loader, { request: req() })).canClean).toBe(true);
    await settings.setOwnerUserId(null);
    expect((await call(auditRoute.loader, { request: req() })).canClean).toBe(false);
  });
});
