import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// Isolated in-memory SQLite before any server module (and thus env.server) loads.
process.env.DATABASE_URL = "file::memory:";

// Capture the lockout warning (a selection that filters the whole catalogue away
// → fall back to the full catalogue rather than offer nothing).
const { logMock } = vi.hoisted(() => ({ logMock: vi.fn() }));
vi.mock("~/server/log.server", () => ({ log: logMock }));

// Drive the compose seam by mocking only the read getters; the rest of each repo
// (and every other availability function) stays real via importActual. P12 adds
// the activation-flag getter to the seam — the override model is: an activated
// teacher uses their own selection (empty = all, instance ignored); everyone else
// (admin + unactivated teacher) follows the instance-enabled set.
const {
  enabledCountriesMock,
  enabledSectorsMock,
  enabledDomainsMock,
  assignedCountriesMock,
  assignedSectorsMock,
  assignedDomainsMock,
  customAccessMock,
} = vi.hoisted(() => ({
  enabledCountriesMock: vi.fn(),
  enabledSectorsMock: vi.fn(),
  enabledDomainsMock: vi.fn(),
  assignedCountriesMock: vi.fn(),
  assignedSectorsMock: vi.fn(),
  assignedDomainsMock: vi.fn(),
  customAccessMock: vi.fn(),
}));
vi.mock("~/server/repositories/settings.server", async (orig) => ({
  ...(await orig<typeof import("~/server/repositories/settings.server")>()),
  getEnabledCountries: enabledCountriesMock,
  getEnabledSectors: enabledSectorsMock,
  getEnabledDomains: enabledDomainsMock,
}));
vi.mock("~/server/repositories/users.server", async (orig) => ({
  ...(await orig<typeof import("~/server/repositories/users.server")>()),
  getUserAssignedCountries: assignedCountriesMock,
  getUserAssignedSectors: assignedSectorsMock,
  getUserAssignedDomains: assignedDomainsMock,
  getUserContextCustomAccess: customAccessMock,
}));

type Availability = typeof import("~/server/availability.server");
type Sectors = typeof import("~/lib/context/sectors");
type Countries = typeof import("~/lib/context/countries");

let availability: Availability;
let SECTORS: Sectors["SECTORS"];
let COUNTRIES: Countries["COUNTRIES"];

const teacher = { id: "teacher-1", role: "teacher" as const };
const admin = { id: "admin-1", role: "admin" as const };

/** Activate a specific teacher id (others stay unactivated). */
function activate(id: string) {
  customAccessMock.mockImplementation(async (uid: string) => uid === id);
}

beforeAll(async () => {
  availability = await import("~/server/availability.server");
  ({ SECTORS } = await import("~/lib/context/sectors"));
  ({ COUNTRIES } = await import("~/lib/context/countries"));
});

beforeEach(() => {
  // Reset call history + implementation each test, then default to "nothing
  // configured": no instance list, no per-teacher assignment, nobody activated →
  // everyone inherits the whole catalogue.
  for (const m of [
    enabledCountriesMock,
    enabledSectorsMock,
    enabledDomainsMock,
    assignedCountriesMock,
    assignedSectorsMock,
    assignedDomainsMock,
  ]) {
    m.mockReset();
    m.mockResolvedValue(null);
  }
  customAccessMock.mockReset();
  customAccessMock.mockResolvedValue(false);
  logMock.mockClear();
});

describe("getAvailableSectors / getAvailableCountries — defaults", () => {
  it("returns the whole catalogue when nothing is configured", async () => {
    expect(await availability.getAvailableSectors(teacher)).toEqual([...SECTORS]);
    expect(await availability.getAvailableCountries(teacher)).toEqual([...COUNTRIES]);
  });
});

describe("instance-enabled gate (admins + unactivated teachers)", () => {
  it("narrows an unactivated teacher to the admin's enabled sectors", async () => {
    enabledSectorsMock.mockResolvedValue(["hbo", "wo"]);
    expect(await availability.getAvailableSectors(teacher)).toEqual(["hbo", "wo"]);
  });

  it("ignores a stale per-teacher assignment while the teacher is not activated", async () => {
    enabledSectorsMock.mockResolvedValue(["hbo", "wo"]);
    assignedSectorsMock.mockResolvedValue(new Set(["mbo"]));
    // Not activated → inherit the instance, the teacher's own set is irrelevant.
    expect(await availability.getAvailableSectors(teacher)).toEqual(["hbo", "wo"]);
  });

  it("does NOT consult the per-teacher getters for an admin", async () => {
    assignedSectorsMock.mockResolvedValue(new Set(["mbo"]));
    enabledSectorsMock.mockResolvedValue(["hbo"]);
    expect(await availability.getAvailableSectors(admin)).toEqual(["hbo"]);
    expect(assignedSectorsMock).not.toHaveBeenCalled();
    expect(customAccessMock).not.toHaveBeenCalled();
  });
});

describe("activated teacher override (instance ignored)", () => {
  it("uses the teacher's own selection, even beyond the instance set", async () => {
    // The original bug: instance=wo only, teacher assigned vo only. Intersect gave
    // ∅ → lockout → full catalogue. Override gives exactly {vo}.
    enabledSectorsMock.mockResolvedValue(["wo"]);
    assignedSectorsMock.mockResolvedValue(new Set(["vo"]));
    activate("teacher-1");
    expect(await availability.getAvailableSectors(teacher)).toEqual(["vo"]);
  });

  it("lets a teacher have MORE than the instance (superset beyond the instance)", async () => {
    // Instance is locked to a single sector; the activated teacher is granted
    // several — intersect could never widen like this, override does.
    enabledSectorsMock.mockResolvedValue(["wo"]);
    assignedSectorsMock.mockResolvedValue(new Set(["vo", "mbo", "hbo"]));
    activate("teacher-1");
    const sectors = await availability.getAvailableSectors(teacher);
    expect(sectors).toEqual(["vo", "mbo", "hbo"]);
    expect(sectors).not.toContain("wo"); // the teacher's set fully replaces the instance's
  });

  it("treats an empty selection on an activated teacher as ALL (never the instance)", async () => {
    enabledSectorsMock.mockResolvedValue(["wo"]); // instance restricted…
    assignedSectorsMock.mockResolvedValue(null); // …but teacher picked nothing
    activate("teacher-1");
    // Activated + empty axis = unrestricted, ignoring the instance entirely.
    expect(await availability.getAvailableSectors(teacher)).toEqual([...SECTORS]);
  });
});

describe("deactivation is non-destructive", () => {
  it("inherits the instance when off, restores the saved selection when on again", async () => {
    enabledSectorsMock.mockResolvedValue(["hbo", "wo"]);
    assignedSectorsMock.mockResolvedValue(new Set(["vo"])); // saved selection, preserved

    activate("teacher-1");
    expect(await availability.getAvailableSectors(teacher)).toEqual(["vo"]);

    // Deactivate — the saved assignment is untouched (mock still returns it), the
    // teacher just inherits the instance again.
    customAccessMock.mockResolvedValue(false);
    expect(await availability.getAvailableSectors(teacher)).toEqual(["hbo", "wo"]);

    // Re-activate — the preserved selection comes right back.
    activate("teacher-1");
    expect(await availability.getAvailableSectors(teacher)).toEqual(["vo"]);
  });
});

describe("lockout fallback", () => {
  it("falls back to the full catalogue (and warns) when a selection filters everything away", async () => {
    // Garbage/legacy instance value that matches no catalogue slug: never offer
    // nothing — fall back to the whole catalogue and warn.
    enabledSectorsMock.mockResolvedValue(["does-not-exist"]);
    expect(await availability.getAvailableSectors(teacher)).toEqual([...SECTORS]);
    expect(logMock).toHaveBeenCalled();
  });
});

describe("getAvailableDomains — instance axis + override (P12)", () => {
  // The real vo/havo catalogue (getDomainsForTrack is not mocked).
  const HAVO = ["nt", "ng", "em", "cm"];

  it("narrows an unactivated teacher by the INSTANCE domain set", async () => {
    enabledDomainsMock.mockResolvedValue(["nt"]);
    expect(await availability.getAvailableDomains(teacher, "vo", "havo")).toEqual(["nt"]);
  });

  it("an activated teacher uses their OWN domain set, ignoring the instance", async () => {
    enabledDomainsMock.mockResolvedValue(["nt"]);
    assignedDomainsMock.mockResolvedValue(new Set(["em"]));
    activate("teacher-1");
    expect(await availability.getAvailableDomains(teacher, "vo", "havo")).toEqual(["em"]);
  });

  it("an activated teacher with no domain selection = the whole catalogue", async () => {
    enabledDomainsMock.mockResolvedValue(["nt"]); // instance restricted…
    assignedDomainsMock.mockResolvedValue(null); // …teacher picked none
    activate("teacher-1");
    expect(await availability.getAvailableDomains(teacher, "vo", "havo")).toEqual(HAVO);
  });

  it("an admin follows the instance domain set (never the per-teacher getter)", async () => {
    enabledDomainsMock.mockResolvedValue(["nt", "ng"]);
    assignedDomainsMock.mockResolvedValue(new Set(["em"]));
    expect(await availability.getAvailableDomains(admin, "vo", "havo")).toEqual(["nt", "ng"]);
    expect(assignedDomainsMock).not.toHaveBeenCalled();
  });

  it("returns [] for a sector with no catalogue, regardless of instance settings", async () => {
    enabledDomainsMock.mockResolvedValue(["nt"]);
    expect(await availability.getAvailableDomains(teacher, "mbo", "mbo-4")).toEqual([]);
    expect(await availability.getAvailableDomains(teacher, "wo", "master")).toEqual([]);
  });
});

describe("getAvailableDomainSlugs — flat effective set for the editor loader (P12)", () => {
  it("is the instance set for an unactivated teacher, the own set when activated, null = all", async () => {
    enabledDomainsMock.mockResolvedValue(["nt"]);
    assignedDomainsMock.mockResolvedValue(new Set(["em"]));

    // Unactivated → the instance set.
    expect(await availability.getAvailableDomainSlugs(teacher)).toEqual(["nt"]);

    // Activated → the teacher's own set (instance ignored).
    activate("teacher-1");
    expect([...(await availability.getAvailableDomainSlugs(teacher))!].sort()).toEqual(["em"]);

    // Activated + no selection → null (unrestricted).
    assignedDomainsMock.mockResolvedValue(null);
    expect(await availability.getAvailableDomainSlugs(teacher)).toBeNull();
  });
});
