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

describe("instance decides, on real storage (P18.2)", () => {
  it("a teacher follows the instance sectors and domains", async () => {
    const row = await users.createUser({
      name: "Real",
      email: "real@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const teacher = { id: row.id, role: "teacher" as const };
    await settings.setEnabledSectors(["mbo", "hbo", "wo"]);
    await settings.setEnabledDomains(["nt", "em"]);
    expect(await availability.getAvailableSectors(teacher)).toEqual(["mbo", "hbo", "wo"]);
    expect(await availability.getAvailableDomains(teacher, "vo", "havo")).toEqual(["nt", "em"]);
    const admin = { id: "admin-x", role: "admin" as const };
    expect(await availability.getAvailableSectors(admin)).toEqual(["mbo", "hbo", "wo"]);
    await settings.setEnabledSectors(null);
    await settings.setEnabledDomains(null);
  });

  it("a stored custom-access flag and assignment are ignored", async () => {
    const row = await users.createUser({
      name: "Legacy",
      email: "legacy@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const teacher = { id: row.id, role: "teacher" as const };
    const { getDb } = await import("~/server/db.server");
    const { instanceSettings } = await import("~/server/schema.server");
    const now = new Date();
    getDb()
      .insert(instanceSettings)
      .values([
        { key: `contextCustomAccess:${row.id}`, valueJson: '["1"]', updatedAt: now },
        { key: `assignedSectors:${row.id}`, valueJson: '["mbo"]', updatedAt: now },
        { key: `assignedDomains:${row.id}`, valueJson: '["em"]', updatedAt: now },
      ])
      .run();
    await settings.setEnabledSectors(["hbo"]);
    await settings.setEnabledDomains(["nt"]);
    expect(await availability.getAvailableSectors(teacher)).toEqual(["hbo"]);
    expect(await availability.getAvailableDomains(teacher, "vo", "havo")).toEqual(["nt"]);
    await settings.setEnabledSectors(null);
    await settings.setEnabledDomains(null);
  });

  it("falls back to the full catalogue when the instance set excludes every catalogue slug", async () => {
    await settings.setEnabledDomains(["ICT"]); // hbo slug, not in havo
    expect(
      await availability.getAvailableDomains({ id: "t-x", role: "teacher" }, "vo", "havo"),
    ).toEqual(["nt", "ng", "em", "cm"]);
    await settings.setEnabledDomains(null);
  });

  it("is track-scoped: a vmbo slug doesn't leak into a havo catalogue", async () => {
    await settings.setEnabledDomains(["zw", "nt"]);
    const teacher = { id: "t-y", role: "teacher" as const };
    expect(await availability.getAvailableDomains(teacher, "vo", "vmbo-bb")).toEqual(["zw"]);
    expect(await availability.getAvailableDomains(teacher, "vo", "havo")).toEqual(["nt"]);
    await settings.setEnabledDomains(null);
  });

  it("returns [] for a sector with no domain catalogue (mbo/wo)", async () => {
    const teacher = { id: "dom-mbo", role: "teacher" as const };
    expect(await availability.getAvailableDomains(teacher, "mbo", "mbo-4")).toEqual([]);
    expect(await availability.getAvailableDomains(teacher, "wo", "master")).toEqual([]);
  });
});
