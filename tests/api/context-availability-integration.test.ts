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

describe("override model ↔ compose seam (real storage, no mocks)", () => {
  it("an activated teacher overrides the instance; deactivating is non-destructive", async () => {
    const row = await users.createUser({
      name: "Real",
      email: "real@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const teacher = { id: row.id, role: "teacher" as const };
    await settings.setEnabledSectors(["mbo", "hbo", "wo"]);
    await users.setUserAssignedSectors(teacher.id, ["mbo", "hbo"]);

    // Not activated yet → inherit the instance (the assignment is ignored).
    expect(await availability.getAvailableSectors(teacher)).toEqual(["mbo", "hbo", "wo"]);

    // Activate → the teacher's own set wins, instance ignored (catalogue order).
    await users.setUserContextCustomAccess(teacher.id, true);
    expect(await availability.getAvailableSectors(teacher)).toEqual(["mbo", "hbo"]);

    // Deactivate → inherit the instance again; the saved assignment is untouched.
    await users.setUserContextCustomAccess(teacher.id, false);
    expect(await availability.getAvailableSectors(teacher)).toEqual(["mbo", "hbo", "wo"]);

    // Re-activate → the preserved assignment comes right back (non-destructive).
    await users.setUserContextCustomAccess(teacher.id, true);
    expect(await availability.getAvailableSectors(teacher)).toEqual(["mbo", "hbo"]);

    // An activated teacher with an empty selection = ALL, ignoring the instance.
    await users.setUserAssignedSectors(teacher.id, null);
    expect(await availability.getAvailableSectors(teacher)).toEqual(["vo", "mbo", "hbo", "wo"]);

    await users.setUserContextCustomAccess(teacher.id, false);
    await settings.setEnabledSectors(null);
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

describe("getAvailableDomains — track-scoped, override model, real storage (P12)", () => {
  it("an activated teacher narrows a track catalogue by their own assignment; admin unrestricted", async () => {
    const row = await users.createUser({
      name: "Dom",
      email: "dom@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const teacher = { id: row.id, role: "teacher" as const };
    // havo catalogue, unrestricted, in catalogue order.
    expect(await availability.getAvailableDomains(teacher, "vo", "havo")).toEqual([
      "nt",
      "ng",
      "em",
      "cm",
    ]);
    await users.setUserAssignedDomains(teacher.id, ["nt", "em"]);
    await users.setUserContextCustomAccess(teacher.id, true); // activate → own set wins
    expect(await availability.getAvailableDomains(teacher, "vo", "havo")).toEqual(["nt", "em"]);

    // An admin ignores any per-teacher assignment (follows the instance = all here).
    await users.setUserAssignedDomains("admin-dom", ["nt"]);
    expect(
      await availability.getAvailableDomains({ id: "admin-dom", role: "admin" }, "vo", "havo"),
    ).toEqual(["nt", "ng", "em", "cm"]);
    await users.setUserAssignedDomains(teacher.id, null);
    await users.setUserContextCustomAccess(teacher.id, false);
  });

  it("is track-scoped: a vmbo slug doesn't leak into a havo catalogue", async () => {
    const row = await users.createUser({
      name: "Dom2",
      email: "dom2@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const teacher = { id: row.id, role: "teacher" as const };
    await users.setUserAssignedDomains(teacher.id, ["zw", "nt"]);
    await users.setUserContextCustomAccess(teacher.id, true);
    expect(await availability.getAvailableDomains(teacher, "vo", "vmbo-bb")).toEqual(["zw"]);
    expect(await availability.getAvailableDomains(teacher, "vo", "havo")).toEqual(["nt"]);
    await users.setUserAssignedDomains(teacher.id, null);
    await users.setUserContextCustomAccess(teacher.id, false);
  });

  it("falls back to the full catalogue when the selection excludes every catalogue slug", async () => {
    const row = await users.createUser({
      name: "Dom3",
      email: "dom3@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const teacher = { id: row.id, role: "teacher" as const };
    await users.setUserAssignedDomains(teacher.id, ["ICT"]); // hbo slug, not in havo
    await users.setUserContextCustomAccess(teacher.id, true);
    expect(await availability.getAvailableDomains(teacher, "vo", "havo")).toEqual([
      "nt",
      "ng",
      "em",
      "cm",
    ]);
    await users.setUserAssignedDomains(teacher.id, null);
    await users.setUserContextCustomAccess(teacher.id, false);
  });

  it("an unactivated teacher follows the INSTANCE domain set (not their assignment)", async () => {
    const row = await users.createUser({
      name: "DomInst",
      email: "dominst@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const teacher = { id: row.id, role: "teacher" as const };
    await users.setUserAssignedDomains(teacher.id, ["em"]); // saved but ignored while off
    await settings.setEnabledDomains(["nt", "ng"]);
    expect(await availability.getAvailableDomains(teacher, "vo", "havo")).toEqual(["nt", "ng"]);
    await settings.setEnabledDomains(null);
    await users.setUserAssignedDomains(teacher.id, null);
  });

  it("returns [] for a sector with no domain catalogue (mbo/wo)", async () => {
    const teacher = { id: "dom-mbo", role: "teacher" as const };
    expect(await availability.getAvailableDomains(teacher, "mbo", "mbo-4")).toEqual([]);
    expect(await availability.getAvailableDomains(teacher, "wo", "master")).toEqual([]);
  });
});
