import { describe, it, expect, beforeAll } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Profiles = typeof import("~/server/repositories/profiles.server");
type Generations = typeof import("~/server/repositories/generations.server");
let profiles: Profiles;
let generations: Generations;

beforeAll(async () => {
  profiles = await import("~/server/repositories/profiles.server");
  generations = await import("~/server/repositories/generations.server");
});

/**
 * Belt-and-braces query caps (Phase 5.6). Per-user scoping already bounds
 * realistic sizes, but an unbounded `listProfiles`/`listGenerations` is a latent
 * memory hazard, so both clamp to `Math.min(limit ?? 50, 500)`.
 */
describe("repository query caps", () => {
  it("listProfiles caps a huge requested limit at 500", async () => {
    const userId = "cap-profiles-user";
    for (let i = 0; i < 501; i++) {
      await profiles.createProfile(userId, { name: `Profile ${i}` });
    }
    const rows = await profiles.listProfiles(userId, 10_000);
    expect(rows.length).toBe(500);
  });

  it("listProfiles honours a small limit and defaults to 50", async () => {
    const userId = "cap-profiles-small";
    for (let i = 0; i < 60; i++) {
      await profiles.createProfile(userId, { name: `P ${i}` });
    }
    expect((await profiles.listProfiles(userId, 5)).length).toBe(5);
    // No explicit limit → default of 50.
    expect((await profiles.listProfiles(userId)).length).toBe(50);
  });

  it("listGenerations caps a huge requested limit at 500", async () => {
    const userId = "cap-generations-user";
    for (let i = 0; i < 501; i++) {
      await generations.saveGeneration({
        userId,
        toolSlug: "socratic-partner",
        model: "claude-sonnet-4-6",
        input: {},
        outputLanguage: "nl",
        outputMarkdown: `out ${i}`,
      });
    }
    const rows = await generations.listGenerations(userId, 10_000);
    expect(rows.length).toBe(500);
  });

  it("listGenerations honours a small limit and defaults to 50", async () => {
    const userId = "cap-generations-small";
    for (let i = 0; i < 60; i++) {
      await generations.saveGeneration({
        userId,
        toolSlug: "socratic-partner",
        model: "claude-sonnet-4-6",
        input: {},
        outputLanguage: "nl",
        outputMarkdown: `out ${i}`,
      });
    }
    expect((await generations.listGenerations(userId, 5)).length).toBe(5);
    expect((await generations.listGenerations(userId)).length).toBe(50);
  });
});
