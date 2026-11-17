import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Jev's one switch (BESLUIT-2026-11-17-1): one instance setting, off by default; switching it on
// is the institution's consent to sending to Jev, so it records who and when. `jevAccess` is the
// one gate every Jev call goes through: the switch, the config and Jev's own key.
process.env.DATABASE_URL = "file::memory:";

let jev: typeof import("~/server/jev.server");
let settings: typeof import("~/server/repositories/settings.server");

beforeAll(async () => {
  jev = await import("~/server/jev.server");
  settings = await import("~/server/repositories/settings.server");
});

beforeEach(() => {
  process.env.JEV_API_KEY = "test-key";
});

afterEach(async () => {
  delete process.env.JEV_API_KEY;
  await settings.setJevConsent(false, "admin-1");
});

describe("Jev's switch", () => {
  // First in the file: the database is fresh, nobody has touched the switch yet.
  it("has never been set on a fresh instance: off, no one, no time", async () => {
    expect(await settings.getJevConsent()).toEqual({ on: false });
    expect(await jev.jevAccess()).toBeNull();
  });

  it("records who switched it on and when", async () => {
    const before = Date.now();
    await settings.setJevConsent(true, "admin-1");
    const consent = await settings.getJevConsent();
    expect(consent).toMatchObject({ on: true, by: "admin-1" });
    expect(Date.parse(consent.at ?? "")).toBeGreaterThanOrEqual(before);
  });

  it("records who switched it off again, and when", async () => {
    await settings.setJevConsent(true, "admin-1");
    await settings.setJevConsent(false, "admin-2");
    expect(await settings.getJevConsent()).toMatchObject({ on: false, by: "admin-2" });
  });
});

describe("jevAccess: the one gate for a call to Jev", () => {
  it("is null while the switch is off, even with a key", async () => {
    expect(await jev.jevAccess()).toBeNull();
  });

  it("gives the address, the pinned model, the provider and Jev's own key when on", async () => {
    await settings.setJevConsent(true, "admin-1");
    expect(await jev.jevAccess()).toEqual({
      url: "https://openrouter.ai/api/alpha/decisions",
      model: "typesafe/jev-1.14",
      provider: "openrouter",
      apiKey: "test-key",
    });
  });

  it("is null when on but Jev's key is missing", async () => {
    await settings.setJevConsent(true, "admin-1");
    delete process.env.JEV_API_KEY;
    expect(await jev.jevAccess()).toBeNull();
  });
});
