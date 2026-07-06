import { describe, it, expect, beforeAll } from "vitest";

// Isolated in-memory SQLite before any server module loads. This is the sibling
// of tests/lib/context-availability.test.ts (which mocks the P8 read getters):
// here the P9 setters + real storage drive the P8 compose seam end-to-end.
process.env.DATABASE_URL = "file::memory:";

type Availability = typeof import("~/server/availability.server");
type Settings = typeof import("~/server/repositories/settings.server");
type Users = typeof import("~/server/repositories/users.server");

let availability: Availability;
let settings: Settings;
let users: Users;

beforeAll(async () => {
  [availability, settings, users] = await Promise.all([
    import("~/server/availability.server"),
    import("~/server/repositories/settings.server"),
    import("~/server/repositories/users.server"),
  ]);
});

describe("P9 write side ↔ P8 compose seam (real storage, no mocks)", () => {
  it("narrows getAvailableSectors by the written instance + teacher assignment", async () => {
    const row = await users.createUser({
      name: "Real",
      email: "real@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const teacher = { id: row.id, role: "teacher" as const };
    await settings.setEnabledSectors(["mbo", "hbo", "wo"]);
    await users.setUserAssignedSectors(teacher.id, ["mbo", "hbo"]);

    // instance ∩ teacher, in catalogue order.
    expect(await availability.getAvailableSectors(teacher)).toEqual(["mbo", "hbo"]);

    // Clearing the teacher assignment falls back to the instance set.
    await users.setUserAssignedSectors(teacher.id, null);
    expect(await availability.getAvailableSectors(teacher)).toEqual(["mbo", "hbo", "wo"]);

    // Clearing the instance setting returns to the full catalogue.
    await settings.setEnabledSectors(null);
    expect(await availability.getAvailableSectors(teacher)).toEqual(["vo", "mbo", "hbo", "wo"]);
  });

  it("ignores a per-teacher assignment for an admin (instance set only)", async () => {
    const admin = { id: "admin-x", role: "admin" as const };
    await settings.setEnabledSectors(["hbo"]);
    await users.setUserAssignedSectors("admin-x", ["mbo"]); // never read for an admin
    expect(await availability.getAvailableSectors(admin)).toEqual(["hbo"]);
    await settings.setEnabledSectors(null);
  });

  it("narrows getAvailableCountries end-to-end too", async () => {
    const row = await users.createUser({
      name: "C",
      email: "c@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const teacher = { id: row.id, role: "teacher" as const };
    await settings.setEnabledCountries(["NL"]);
    await users.setUserAssignedCountries(teacher.id, ["NL"]);
    expect(await availability.getAvailableCountries(teacher)).toEqual(["NL"]);
    await settings.setEnabledCountries(null);
    await users.setUserAssignedCountries(teacher.id, null);
  });
});
