import { describe, it, expect, beforeAll } from "vitest";

process.env.DATABASE_URL = "file::memory:";

type Users = typeof import("~/server/repositories/users.server");
type Profiles = typeof import("~/server/repositories/profiles.server");
type Generations = typeof import("~/server/repositories/generations.server");
type Usage = typeof import("~/server/repositories/usage.server");
type Feedback = typeof import("~/server/repositories/feedback.server");

let users: Users;
let profiles: Profiles;
let generations: Generations;
let usage: Usage;
let feedback: Feedback;

beforeAll(async () => {
  users = await import("~/server/repositories/users.server");
  profiles = await import("~/server/repositories/profiles.server");
  generations = await import("~/server/repositories/generations.server");
  usage = await import("~/server/repositories/usage.server");
  feedback = await import("~/server/repositories/feedback.server");
});

async function seedUser(id: string) {
  await users.createUser({ id, name: `User ${id}`, passwordHash: "scrypt:x:y", role: "teacher" });
  const gen = await generations.saveGeneration({
    userId: id,
    toolSlug: "guided-reflection",
    model: "m",
    input: {},
    outputLanguage: "nl",
    outputMarkdown: "out",
  });
  await profiles.createProfile(id, { name: "Profile" });
  await usage.recordUsage(id, { chars: 10 }, "2026-07-01");
  await feedback.upsertFeedback({ userId: id, generationId: gen.id, rating: 1 });
  return gen.id;
}

describe("deleteUserCascade", () => {
  it("removes the user's feedback, usage, generations, profiles and user row", async () => {
    const genId = await seedUser("del-user-a");

    await users.deleteUserCascade("del-user-a");

    expect(await users.getUserById("del-user-a")).toBeNull();
    expect(await generations.listGenerations("del-user-a")).toHaveLength(0);
    expect(await profiles.listProfiles("del-user-a")).toHaveLength(0);
    expect((await usage.getTodayUsage("del-user-a", "2026-07-01")).requests).toBe(0);
    expect((await feedback.listAllFeedback()).some((f) => f.generationId === genId)).toBe(false);
  });

  it("leaves other users' data untouched", async () => {
    await seedUser("del-user-b");
    const keepGenId = await seedUser("del-user-keep");

    await users.deleteUserCascade("del-user-b");

    // The other user survives entirely.
    expect(await users.getUserById("del-user-keep")).not.toBeNull();
    expect(await generations.listGenerations("del-user-keep")).toHaveLength(1);
    expect(await profiles.listProfiles("del-user-keep")).toHaveLength(1);
    expect((await usage.getTodayUsage("del-user-keep", "2026-07-01")).requests).toBe(1);
    expect((await feedback.listAllFeedback()).some((f) => f.generationId === keepGenId)).toBe(true);
  });
});
