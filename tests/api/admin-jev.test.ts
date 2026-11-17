import { beforeAll, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Jev's one switch on Beheer → Tools (BESLUIT-2026-11-17-1): an admin switches it, the page says
// who did and when, and the audit log keeps it. Switching on is the institution's consent.
process.env.DATABASE_URL = "file::memory:";

let users: typeof import("~/server/repositories/users.server");
let settings: typeof import("~/server/repositories/settings.server");
let audit: typeof import("~/server/repositories/auditLog.server");
let tools: typeof import("~/routes/admin.tools");

beforeAll(async () => {
  users = await import("~/server/repositories/users.server");
  settings = await import("~/server/repositories/settings.server");
  audit = await import("~/server/repositories/auditLog.server");
  tools = await import("~/routes/admin.tools");
});

let n = 0;
async function admin(name: string) {
  n++;
  const u = await users.createUser({
    name,
    email: `jev.admin.${n}@school.nl`,
    passwordHash: "scrypt:a:b",
    role: "admin",
  });
  await signInAs({ id: u.id });
  return u;
}

function post(fields: Record<string, string>): Request {
  return signedRequest("http://localhost/admin/tools", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}
const act = (fields: Record<string, string>) =>
  tools.action({ request: post(fields), params: {}, context: {} } as never);
const load = () =>
  tools.loader({
    request: signedRequest("http://localhost/admin/tools"),
    params: {},
    context: {},
  } as never);

describe("Jev's switch on /admin/tools", () => {
  it("is off and never set on a fresh instance", async () => {
    await admin("Eerste Beheerder");
    // Never set: no one and no time (and this test has no JEV_API_KEY).
    expect((await load()).jev).toEqual({ on: false, keySet: false });
  });

  it("switching on records the admin and the time, and the audit log keeps it", async () => {
    const a = await admin("Anna Beheer");
    expect(await act({ intent: "jev", on: "on" })).toEqual({ saved: true });
    expect(await settings.getJevConsent()).toMatchObject({ on: true, by: a.id });
    const jev = (await load()).jev;
    expect(jev).toMatchObject({ on: true, byName: "Anna Beheer" });
    expect(typeof jev.at).toBe("string");
    expect((await audit.listAdminActions())[0]).toMatchObject({
      action: "jevSwitchedOn",
      actorUserId: a.id,
    });
  });

  it("switching off (no checkbox in the form) records who did it as well", async () => {
    const b = await admin("Bram Beheer");
    await act({ intent: "jev" });
    expect(await settings.getJevConsent()).toMatchObject({ on: false, by: b.id });
    expect((await load()).jev).toMatchObject({ on: false, byName: "Bram Beheer" });
    expect((await audit.listAdminActions())[0]).toMatchObject({ action: "jevSwitchedOff" });
  });

  it("saving the stand it already has adds no audit line", async () => {
    await admin("Carla Beheer");
    const before = (await audit.listAdminActions()).length;
    await act({ intent: "jev" });
    expect((await audit.listAdminActions()).length).toBe(before);
  });

  it("is for admins only", async () => {
    const t = await users.createUser({
      name: "Docent",
      email: "jev.docent@school.nl",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    await signInAs({ id: t.id });
    await expect(act({ intent: "jev", on: "on" })).rejects.toBeInstanceOf(Response);
    expect((await settings.getJevConsent()).on).toBe(false);
  });
});
