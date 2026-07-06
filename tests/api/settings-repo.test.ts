import { describe, it, expect, beforeAll } from "vitest";

// Isolated in-memory SQLite before any server module (and thus env.server) loads.
process.env.DATABASE_URL = "file::memory:";

type Repo = typeof import("~/server/repositories/settings.server");
let repo: Repo;

beforeAll(async () => {
  repo = await import("~/server/repositories/settings.server");
});

describe("settings repository — tool settings", () => {
  it("upserts a tool setting and reads it back", async () => {
    await repo.setToolSetting("mentorai", { enabled: false });
    const row = await repo.getToolSetting("mentorai");
    expect(row?.enabled).toBe(false);
    expect(row?.audienceOverride).toBeNull();
  });

  it("merges a patch in place (only provided keys change)", async () => {
    await repo.setToolSetting("bloom-by-design", { enabled: true });
    await repo.setToolSetting("bloom-by-design", { audienceOverride: "both" });
    const row = await repo.getToolSetting("bloom-by-design");
    // The earlier `enabled` survives the audience-only patch.
    expect(row?.enabled).toBe(true);
    expect(row?.audienceOverride).toBe("both");
  });

  it("returns null for an untouched tool (absent row = registry default)", async () => {
    expect(await repo.getToolSetting("socratic-partner")).toBeNull();
  });

  it("lists every touched tool setting", async () => {
    const all = await repo.getToolSettings();
    const slugs = all.map((r) => r.toolSlug);
    expect(slugs).toContain("mentorai");
    expect(slugs).toContain("bloom-by-design");
    expect(slugs).not.toContain("socratic-partner");
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

describe("settings repository — enabled countries/sectors (P8 read getters)", () => {
  it("returns null when unset (default = whole catalogue, non-breaking until P9)", async () => {
    expect(await repo.getEnabledCountries()).toBeNull();
    expect(await repo.getEnabledSectors()).toBeNull();
  });
});
