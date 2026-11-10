import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// Isolated in-memory SQLite before any server module (and thus env.server) loads.
process.env.DATABASE_URL = "file::memory:";

// Capture the lockout warning (a selection that filters the whole catalogue away
// → fall back to the full catalogue rather than offer nothing).
const { logMock } = vi.hoisted(() => ({ logMock: vi.fn() }));
vi.mock("~/server/log.server", () => ({ log: logMock }));

// Drive the compose seam by mocking only the instance read getters (P18.2: the
// instance is the only source; there are no per-teacher getters any more).
const { enabledSectorsMock, enabledDomainsMock } = vi.hoisted(() => ({
  enabledSectorsMock: vi.fn(),
  enabledDomainsMock: vi.fn(),
}));
vi.mock("~/server/repositories/settings.server", async (orig) => ({
  ...(await orig<typeof import("~/server/repositories/settings.server")>()),
  getEnabledSectors: enabledSectorsMock,
  getEnabledDomains: enabledDomainsMock,
}));

type Availability = typeof import("~/server/availability.server");
type Sectors = typeof import("~/lib/context/sectors");

let availability: Availability;
let SECTORS: Sectors["SECTORS"];

const teacher = { id: "teacher-1", role: "teacher" as const };
const admin = { id: "admin-1", role: "admin" as const };

beforeAll(async () => {
  availability = await import("~/server/availability.server");
  ({ SECTORS } = await import("~/lib/context/sectors"));
});

beforeEach(() => {
  for (const m of [enabledSectorsMock, enabledDomainsMock]) {
    m.mockReset();
    m.mockResolvedValue(null);
  }
  logMock.mockClear();
});

describe("getAvailableSectors — the instance decides (P18.2)", () => {
  it("a teacher follows the instance sectors and domains", async () => {
    enabledSectorsMock.mockResolvedValue(["hbo", "wo"]);
    enabledDomainsMock.mockResolvedValue(["nt", "ng"]);
    expect(await availability.getAvailableSectors(teacher)).toEqual(["hbo", "wo"]);
    expect(await availability.getAvailableSectors(admin)).toEqual(["hbo", "wo"]);
    expect(await availability.getAvailableDomainSlugs(teacher)).toEqual(["nt", "ng"]);
    expect(await availability.getAvailableDomains(teacher, "vo", "havo")).toEqual(["nt", "ng"]);
    expect(await availability.getAvailableDomains(admin, "vo", "havo")).toEqual(["nt", "ng"]);
  });

  it("a stored custom-access flag and assignment are ignored", async () => {
    const { getDb } = await import("~/server/db.server");
    const { instanceSettings } = await import("~/server/schema.server");
    const now = new Date();
    getDb()
      .insert(instanceSettings)
      .values([
        { key: "contextCustomAccess:teacher-1", valueJson: '["1"]', updatedAt: now },
        { key: "assignedSectors:teacher-1", valueJson: '["vo"]', updatedAt: now },
        { key: "assignedDomains:teacher-1", valueJson: '["em"]', updatedAt: now },
      ])
      .run();
    enabledSectorsMock.mockResolvedValue(["wo"]);
    enabledDomainsMock.mockResolvedValue(["nt"]);
    expect(await availability.getAvailableSectors(teacher)).toEqual(["wo"]);
    expect(await availability.getAvailableDomainSlugs(teacher)).toEqual(["nt"]);
    expect(await availability.getAvailableDomains(teacher, "vo", "havo")).toEqual(["nt"]);
  });

  it("null instance settings = the whole catalogue", async () => {
    expect(await availability.getAvailableSectors(teacher)).toEqual([...SECTORS]);
    expect(await availability.getAvailableDomainSlugs(teacher)).toBeNull();
    expect(await availability.getAvailableDomains(teacher, "vo", "havo")).toEqual([
      "nt",
      "ng",
      "em",
      "cm",
    ]);
  });

  it("returns [] for a track with no catalogue, regardless of instance settings", async () => {
    enabledDomainsMock.mockResolvedValue(["nt"]);
    expect(await availability.getAvailableDomains(teacher, "vo", undefined)).toEqual([]);
  });

  it("keeps the full mbo/wo catalogue when an older selection names none of their domains", async () => {
    enabledDomainsMock.mockResolvedValue(["nt"]);
    expect(await availability.getAvailableDomains(teacher, "mbo", "mbo-4")).toHaveLength(18);
    expect(await availability.getAvailableDomains(teacher, "wo", "master")).toHaveLength(10);
  });
});

describe("lockout fallback", () => {
  it("falls back to the full catalogue (and warns) when a selection filters everything away", async () => {
    enabledSectorsMock.mockResolvedValue(["does-not-exist"]);
    expect(await availability.getAvailableSectors(teacher)).toEqual([...SECTORS]);
    expect(logMock).toHaveBeenCalled();
  });
});
