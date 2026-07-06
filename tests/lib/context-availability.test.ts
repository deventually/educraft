import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// Isolated in-memory SQLite before any server module (and thus env.server) loads.
process.env.DATABASE_URL = "file::memory:";

// Capture the lockout warning (empty intersection → fall back to full catalogue).
const { logMock } = vi.hoisted(() => ({ logMock: vi.fn() }));
vi.mock("~/server/log.server", () => ({ log: logMock }));

// Drive the compose seam by mocking only the P8 read getters; the rest of each
// repo (and every other availability function) stays real via importActual. The
// setters + real storage land in P9 — the seam itself is what P8 ships and tests.
const { enabledCountriesMock, enabledSectorsMock, assignedCountriesMock, assignedSectorsMock } =
  vi.hoisted(() => ({
    enabledCountriesMock: vi.fn(),
    enabledSectorsMock: vi.fn(),
    assignedCountriesMock: vi.fn(),
    assignedSectorsMock: vi.fn(),
  }));
vi.mock("~/server/repositories/settings.server", async (orig) => ({
  ...(await orig<typeof import("~/server/repositories/settings.server")>()),
  getEnabledCountries: enabledCountriesMock,
  getEnabledSectors: enabledSectorsMock,
}));
vi.mock("~/server/repositories/users.server", async (orig) => ({
  ...(await orig<typeof import("~/server/repositories/users.server")>()),
  getUserAssignedCountries: assignedCountriesMock,
  getUserAssignedSectors: assignedSectorsMock,
}));

type Availability = typeof import("~/server/availability.server");
type Sectors = typeof import("~/lib/context/sectors");
type Countries = typeof import("~/lib/context/countries");

let availability: Availability;
let SECTORS: Sectors["SECTORS"];
let COUNTRIES: Countries["COUNTRIES"];

const teacher = { id: "teacher-1", role: "teacher" as const };
const admin = { id: "admin-1", role: "admin" as const };

beforeAll(async () => {
  availability = await import("~/server/availability.server");
  ({ SECTORS } = await import("~/lib/context/sectors"));
  ({ COUNTRIES } = await import("~/lib/context/countries"));
});

beforeEach(() => {
  // Reset call history + implementation each test (the admin case asserts a getter
  // was never called), then default to "nothing configured" → everything available.
  for (const m of [
    enabledCountriesMock,
    enabledSectorsMock,
    assignedCountriesMock,
    assignedSectorsMock,
  ]) {
    m.mockReset();
    m.mockResolvedValue(null);
  }
  logMock.mockClear();
});

describe("getAvailableSectors / getAvailableCountries — defaults", () => {
  it("returns the whole catalogue when nothing is configured", async () => {
    expect(await availability.getAvailableSectors(teacher)).toEqual([...SECTORS]);
    expect(await availability.getAvailableCountries(teacher)).toEqual([...COUNTRIES]);
  });
});

describe("instance-enabled gate", () => {
  it("narrows to the admin's enabled sectors", async () => {
    enabledSectorsMock.mockResolvedValue(["hbo", "wo"]);
    expect(await availability.getAvailableSectors(teacher)).toEqual(["hbo", "wo"]);
  });
});

describe("per-teacher assignment gate", () => {
  it("narrows an assigned teacher and leaves an unassigned teacher unrestricted", async () => {
    assignedSectorsMock.mockImplementation(async (id: string) =>
      id === "teacher-1" ? new Set(["mbo"]) : null,
    );
    expect(await availability.getAvailableSectors(teacher)).toEqual(["mbo"]);
    // A different teacher with no assignment still sees everything.
    expect(await availability.getAvailableSectors({ id: "teacher-open", role: "teacher" })).toEqual(
      [...SECTORS],
    );
  });

  it("supports multiple sectors and countries per teacher (union set)", async () => {
    assignedSectorsMock.mockResolvedValue(new Set(["vo", "hbo"]));
    assignedCountriesMock.mockResolvedValue(new Set(["NL"]));
    const sectors = await availability.getAvailableSectors(teacher);
    expect(sectors).toContain("vo");
    expect(sectors).toContain("hbo");
    expect(sectors).not.toContain("mbo");
    expect(await availability.getAvailableCountries(teacher)).toEqual(["NL"]);
  });

  it("does NOT apply per-teacher assignment to an admin", async () => {
    assignedSectorsMock.mockResolvedValue(new Set(["mbo"]));
    enabledSectorsMock.mockResolvedValue(["hbo"]);
    // Admin sees the instance-enabled set, ignoring any per-teacher assignment.
    expect(await availability.getAvailableSectors(admin)).toEqual(["hbo"]);
    expect(assignedSectorsMock).not.toHaveBeenCalled();
  });
});

describe("lockout fallback", () => {
  it("falls back to the full catalogue (and warns) on an empty intersection", async () => {
    enabledSectorsMock.mockResolvedValue(["does-not-exist"]);
    expect(await availability.getAvailableSectors(teacher)).toEqual([...SECTORS]);
    expect(logMock).toHaveBeenCalled();
  });
});
