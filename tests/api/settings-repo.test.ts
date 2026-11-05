import { describe, it, expect, beforeAll } from "vitest";

// Isolated in-memory SQLite before any server module (and thus env.server) loads.
process.env.DATABASE_URL = "file::memory:";

type Repo = typeof import("~/server/repositories/settings.server");
let repo: Repo;

beforeAll(async () => {
  repo = await import("~/server/repositories/settings.server");
});

describe("settings repository — tool and feature stands (P28.3)", () => {
  it("stores a tool stand and reads it back", async () => {
    await repo.setToolStand("mentorai", "request");
    expect((await repo.getToolStands()).get("mentorai")).toBe("request");
    await repo.setToolStand("mentorai", "off");
    expect((await repo.getToolStands()).get("mentorai")).toBe("off");
  });

  it("null means back to the registry default (absent from the map)", async () => {
    await repo.setToolStand("bloom-by-design", null);
    expect((await repo.getToolStands()).has("bloom-by-design")).toBe(false);
    expect((await repo.getToolStands()).has("socratic-partner")).toBe(false);
  });

  it("stores a feature stand; an untouched feature is absent", async () => {
    await repo.setFeatureStand("courses", "off");
    const stands = await repo.getFeatureStands();
    expect(stands.courses).toBe("off");
    expect(stands.utilities).toBeUndefined();
  });
});

describe("settings repository — role agent stands", () => {
  it("stores a hat's stand; an untouched hat is absent (= on)", async () => {
    expect(await repo.getAgentStands()).toEqual({});
    await repo.setAgentStand("designer", "off");
    expect(await repo.getAgentStands()).toEqual({ designer: "off" });
    await repo.setAgentStand("designer", "on");
    expect(await repo.getAgentStands()).toEqual({ designer: "on" });
  });

  it("ignores a stored stand for a hat that no longer exists", async () => {
    await repo.setAgentStand("retired-hat", "off");
    expect(Object.keys(await repo.getAgentStands())).not.toContain("retired-hat");
  });
});

describe("settings repository — enabled models", () => {
  it("returns null when unset (default = whole catalog)", async () => {
    expect(await repo.getEnabledModels()).toBeNull();
  });

  it("round-trips an explicit model allow-list", async () => {
    await repo.setEnabledModels(["claude-haiku-4-5", "claude-sonnet-4-6"]);
    expect(await repo.getEnabledModels()).toEqual(["claude-haiku-4-5", "claude-sonnet-4-6"]);
  });

  it("clears back to default when set to null", async () => {
    await repo.setEnabledModels(["claude-haiku-4-5"]);
    await repo.setEnabledModels(null);
    expect(await repo.getEnabledModels()).toBeNull();
  });
});

describe("settings repository — enabled sectors (P9 setters)", () => {
  it("returns null when unset (default = whole catalogue)", async () => {
    expect(await repo.getEnabledSectors()).toBeNull();
  });

  it("round-trips an explicit sector allow-list", async () => {
    await repo.setEnabledSectors(["hbo", "wo"]);
    expect(await repo.getEnabledSectors()).toEqual(["hbo", "wo"]);
  });

  it("clears the list back to default when set to null", async () => {
    await repo.setEnabledSectors(["mbo"]);
    await repo.setEnabledSectors(null);
    expect(await repo.getEnabledSectors()).toBeNull();
  });

  it("upsert overwrites a previously stored list", async () => {
    await repo.setEnabledSectors(["vo"]);
    await repo.setEnabledSectors(["mbo", "hbo"]);
    expect(await repo.getEnabledSectors()).toEqual(["mbo", "hbo"]);
    await repo.setEnabledSectors(null); // reset
  });
});

describe("settings repository — enabled domains (P12 instance axis)", () => {
  it("returns null when unset (default = whole catalogue)", async () => {
    expect(await repo.getEnabledDomains()).toBeNull();
  });

  it("round-trips an explicit domain allow-list and clears with null", async () => {
    await repo.setEnabledDomains(["nt", "ICT"]);
    expect(await repo.getEnabledDomains()).toEqual(["nt", "ICT"]);
    await repo.setEnabledDomains(null);
    expect(await repo.getEnabledDomains()).toBeNull();
  });
});
