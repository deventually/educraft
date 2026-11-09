import { describe, it, expect, beforeAll } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Users = typeof import("~/server/repositories/users.server");
type Usage = typeof import("~/server/repositories/usage.server");
let users: Users;
let usage: Usage;

beforeAll(async () => {
  users = await import("~/server/repositories/users.server");
  usage = await import("~/server/repositories/usage.server");

  const ana = await users.createUser({
    name: "Ana Active",
    email: "ana@school.nl",
    passwordHash: "scrypt:a:b",
    role: "teacher",
  });
  await users.createUser({
    name: "Bob Boss",
    email: "bob@school.nl",
    passwordHash: "scrypt:a:b",
    role: "admin",
  });
  const dee = await users.createUser({
    name: "Dee Dormant",
    email: "dee@school.nl",
    passwordHash: "scrypt:a:b",
    role: "teacher",
  });
  await users.setUserDisabled(dee.id, true);
  await usage.recordUsage(ana.id, { chars: 10 }, "2026-11-01");
  await usage.recordUsage(ana.id, { chars: 10 }, "2026-11-03");

  // One open invite, one used and one expired: only the open one is a row.
  await users.createInvite({ role: "teacher", note: "Ivo Invited" });
  const used = await users.createInvite({ role: "teacher", note: "Used Invite" });
  await users.consumeInvite(used.token, ana.id);
  await users.createInvite({
    role: "teacher",
    note: "Expired Invite",
    expiresAt: new Date(Date.now() - 1000),
  });
});

const names = (rows: { name: string | null }[]) => rows.map((r) => r.name);

describe("listPeople (P28.1)", () => {
  it("lists every account and each open invite, with a status", async () => {
    const rows = await users.listPeople({});
    expect(rows.find((r) => r.name === "Ana Active")).toMatchObject({
      kind: "user",
      status: "active",
      role: "teacher",
      email: "ana@school.nl",
    });
    expect(rows.find((r) => r.name === "Dee Dormant")?.status).toBe("disabled");
    expect(rows.find((r) => r.name === "Ivo Invited")).toMatchObject({
      kind: "invite",
      status: "invited",
      role: "teacher",
    });
    expect(names(rows)).not.toContain("Used Invite");
    expect(names(rows)).not.toContain("Expired Invite");
  });

  it("gives the last day of use, or null when never used", async () => {
    const rows = await users.listPeople({});
    expect(rows.find((r) => r.name === "Ana Active")?.lastActiveDay).toBe("2026-11-03");
    expect(rows.find((r) => r.name === "Bob Boss")?.lastActiveDay).toBeNull();
  });

  it("searches name and e-mail, case-insensitively, and invite notes", async () => {
    expect(names(await users.listPeople({ q: "ana" }))).toEqual(["Ana Active"]);
    expect(names(await users.listPeople({ q: "BOB@SCHOOL" }))).toEqual(["Bob Boss"]);
    expect(names(await users.listPeople({ q: "ivo" }))).toEqual(["Ivo Invited"]);
    // A LIKE wildcard is plain text here.
    expect(await users.listPeople({ q: "%" })).toEqual([]);
  });

  it("filters on role and status", async () => {
    expect(names(await users.listPeople({ role: "admin" }))).toEqual(["Bob Boss"]);
    expect(names(await users.listPeople({ status: "disabled" }))).toEqual(["Dee Dormant"]);
    expect(names(await users.listPeople({ status: "invited" }))).toEqual(["Ivo Invited"]);
    const active = names(await users.listPeople({ status: "active" }));
    expect(active).toContain("Ana Active");
    expect(active).not.toContain("Dee Dormant");
    expect(active).not.toContain("Ivo Invited");
    // An invite only ever makes a teacher.
    expect(names(await users.listPeople({ role: "admin", status: "invited" }))).toEqual([]);
  });

  it("caps the list at Math.min(limit ?? 50, 500)", async () => {
    expect((await users.listPeople({ limit: 2 })).length).toBe(2);
    for (let i = 0; i < 60; i++) {
      await users.createUser({ name: `Bulk ${i}`, passwordHash: "scrypt:a:b", role: "teacher" });
    }
    expect((await users.listPeople({})).length).toBe(50);
    expect((await users.listPeople({ limit: 10_000 })).length).toBeLessThanOrEqual(500);
    expect((await users.listPeople({ limit: 10_000 })).length).toBeGreaterThan(50);
  });
});

describe("getLastActiveDay (P28.1)", () => {
  it("is the newest usage day of that user only", async () => {
    const ana = (await users.listPeople({ q: "ana@" }))[0];
    expect(await usage.getLastActiveDay(ana!.id)).toBe("2026-11-03");
    expect(await usage.getLastActiveDay("nobody")).toBeNull();
  });
});
