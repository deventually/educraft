import { describe, it, expect, beforeAll, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireUser: requireUserMock }));

// Drive the availability seam directly so the loader/action enforcement is
// exercisable in P8 (before P9 writes any settings).
const { availableSectorsMock, availableCountriesMock, availableDomainsMock } = vi.hoisted(() => ({
  availableSectorsMock: vi.fn(),
  availableCountriesMock: vi.fn(),
  availableDomainsMock: vi.fn(),
}));
vi.mock("~/server/availability.server", async (orig) => ({
  ...(await orig<typeof import("~/server/availability.server")>()),
  getAvailableSectors: availableSectorsMock,
  getAvailableCountries: availableCountriesMock,
  getAvailableDomains: availableDomainsMock,
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
type Users = typeof import("~/server/repositories/users.server");
let route: Route;
let users: Users;

beforeAll(async () => {
  route = await import("~/routes/context-profiles");
  users = await import("~/server/repositories/users.server");
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

  it("passes the teacher's assigned domains to the editor (P10.3)", async () => {
    await users.setUserAssignedDomains("teacher-1", ["ICT"]);
    const data = (await route.loader(loaderArgs())) as { assignedDomains: string[] | null };
    expect(data.assignedDomains).toEqual(["ICT"]);
    await users.setUserAssignedDomains("teacher-1", null);
    const cleared = (await route.loader(loaderArgs())) as { assignedDomains: string[] | null };
    expect(cleared.assignedDomains).toBeNull();
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
