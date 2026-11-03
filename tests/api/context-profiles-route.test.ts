import { describe, it, expect, beforeAll, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireUser: requireUserMock }));

// Drive the availability seam directly so the loader/action enforcement is
// exercisable in P8 (before P9 writes any settings).
const { availableSectorsMock, availableCountriesMock, availableDomainsMock, domainSlugsMock } =
  vi.hoisted(() => ({
    availableSectorsMock: vi.fn(),
    availableCountriesMock: vi.fn(),
    availableDomainsMock: vi.fn(),
    domainSlugsMock: vi.fn(),
  }));
vi.mock("~/server/availability.server", async (orig) => ({
  ...(await orig<typeof import("~/server/availability.server")>()),
  getAvailableSectors: availableSectorsMock,
  getAvailableCountries: availableCountriesMock,
  getAvailableDomains: availableDomainsMock,
  getAvailableDomainSlugs: domainSlugsMock,
}));

// Keep the route off the DB for profile persistence.
const { createProfileMock } = vi.hoisted(() => ({ createProfileMock: vi.fn() }));
vi.mock("~/server/repositories/profiles.server", () => ({
  listProfiles: vi.fn(async () => []),
  getDefaultProfile: vi.fn(async () => null),
  createProfile: createProfileMock,
  updateProfile: vi.fn(async () => {}),
  deleteProfile: vi.fn(async () => {}),
}));

type Route = typeof import("~/routes/context-profiles");
let route: Route;

beforeAll(async () => {
  route = await import("~/routes/context-profiles");
  requireUserMock.mockResolvedValue({
    id: "teacher-1",
    name: "Teacher",
    email: null,
    role: "teacher",
    createdAt: new Date(0),
  });
  // A narrowed instance: only hbo is available to this teacher.
  availableSectorsMock.mockResolvedValue(["hbo"]);
  availableCountriesMock.mockResolvedValue(["NL"]);
  // Default: every hbo domain available (overridden per test).
  availableDomainsMock.mockResolvedValue(["ICT"]);
  // Default effective domain allow-list = unrestricted (overridden per test).
  domainSlugsMock.mockResolvedValue(null);
});

function req(fields: Record<string, string>): Request {
  const body = new URLSearchParams(fields);
  return new Request("http://localhost/context-profiles", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

const loaderArgs = () => ({ request: new Request("http://localhost/context-profiles") }) as never;
const actionArgs = (request: Request) => ({ request }) as never;

describe("context-profiles loader — availability", () => {
  it("passes the available country + sector sets to the editor", async () => {
    const data = (await route.loader(loaderArgs())) as {
      availableSectors: string[];
      availableCountries: string[];
    };
    expect(data.availableSectors).toEqual(["hbo"]);
    expect(data.availableCountries).toEqual(["NL"]);
  });

  it("passes the effective domain allow-list to the editor (P12 override)", async () => {
    // The loader trusts availability's effective set (activated → own; unactivated
    // → instance), not the raw per-teacher assignment.
    domainSlugsMock.mockResolvedValueOnce(["ICT"]);
    const data = (await route.loader(loaderArgs())) as { availableDomains: string[] | null };
    expect(data.availableDomains).toEqual(["ICT"]);
    domainSlugsMock.mockResolvedValueOnce(null);
    const cleared = (await route.loader(loaderArgs())) as { availableDomains: string[] | null };
    expect(cleared.availableDomains).toBeNull();
  });
});

describe("context-profiles action — server-side availability enforcement", () => {
  it("refuses a create for a sector the teacher may not use", async () => {
    createProfileMock.mockClear();
    const res = (await route.action(
      actionArgs(req({ intent: "create", name: "Hack", country: "NL", sector: "wo" })),
    )) as { ok: boolean; error?: string };
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(createProfileMock).not.toHaveBeenCalled();
  });

  it("allows a create for an available sector", async () => {
    createProfileMock.mockClear();
    const res = (await route.action(
      actionArgs(req({ intent: "create", name: "Fine", country: "NL", sector: "hbo" })),
    )) as { ok: boolean };
    expect(res.ok).toBe(true);
    expect(createProfileMock).toHaveBeenCalled();
  });

  it("refuses a create whose domain the teacher may not use (P10.3)", async () => {
    createProfileMock.mockClear();
    availableDomainsMock.mockResolvedValueOnce([]); // no domains available
    const res = (await route.action(
      actionArgs(req({ intent: "create", name: "D", country: "NL", sector: "hbo", domain: "ICT" })),
    )) as { ok: boolean; error?: string };
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(createProfileMock).not.toHaveBeenCalled();
  });

  it("allows a create whose domain is available (P10.3)", async () => {
    createProfileMock.mockClear();
    availableDomainsMock.mockResolvedValueOnce(["ICT"]);
    const res = (await route.action(
      actionArgs(req({ intent: "create", name: "D", country: "NL", sector: "hbo", domain: "ICT" })),
    )) as { ok: boolean };
    expect(res.ok).toBe(true);
    expect(createProfileMock).toHaveBeenCalled();
  });
});
