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

  it("removes the user's chat sessions and messages", async () => {
    const sessionId = "del-chat-session-1";
    const { getDb } = await import("~/server/db.server");
    const { chatSessions, messages } = await import("~/server/schema.server");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    db.insert(chatSessions)
      .values({
        id: sessionId,
        toolSlug: "mentorai",
        systemPrompt: "sys",
        model: "m",
        userId: "del-user-chat",
        cohortId: "c-x",
        createdAt: new Date(),
      })
      .run();
    db.insert(messages)
      .values([
        { id: "del-msg-1", sessionId, role: "user", content: "hi", createdAt: new Date() },
        { id: "del-msg-2", sessionId, role: "assistant", content: "hello", createdAt: new Date() },
      ])
      .run();

    await users.deleteUserCascade("del-user-chat");

    expect(db.select().from(chatSessions).where(eq(chatSessions.id, sessionId)).all()).toHaveLength(
      0,
    );
    expect(db.select().from(messages).where(eq(messages.sessionId, sessionId)).all()).toHaveLength(
      0,
    );
  });

  it("keeps a teacher's cohorts (orphan-safe), nulls their dangling profile ref, drops co-teach links", async () => {
    // Legacy cohort tables (dropped in 17.3): rows are seeded directly because the
    // cohort repository is gone, but the cascade still has to clean after them.
    const { getDb } = await import("~/server/db.server");
    const { cohorts, cohortTeachers } = await import("~/server/schema.server");
    const { eq, and } = await import("drizzle-orm");
    const db = getDb();
    await users.createUser({
      id: "del-teacher-own",
      name: "Cohort Owner",
      passwordHash: "scrypt:x:y",
      role: "teacher",
    });
    const profile = await profiles.createProfile("del-teacher-own", { name: "Niveau 6", eqf: 6 });
    const now = new Date();
    const base = { allowedToolSlugs: "[]", configJson: "{}", createdAt: now };
    db.insert(cohorts)
      .values([
        {
          ...base,
          id: "c-owned",
          createdByUserId: "del-teacher-own",
          name: "Owned cohort",
          contextProfileId: profile.id,
        },
        { ...base, id: "c-colleague", createdByUserId: "del-teacher-other", name: "Colleague" },
      ])
      .run();
    db.insert(cohortTeachers)
      .values({ id: "ct-1", cohortId: "c-colleague", userId: "del-teacher-own", createdAt: now })
      .run();

    await users.deleteUserCascade("del-teacher-own");

    // The owned cohort survives so an admin can reassign it — but the dangling
    // reference to the now-deleted profile is cleared.
    const survived = db.select().from(cohorts).where(eq(cohorts.id, "c-owned")).get();
    expect(survived).toBeDefined();
    expect(survived?.contextProfileId).toBeNull();
    // Their co-teach assignment is removed (no orphaned join row).
    expect(
      db
        .select()
        .from(cohortTeachers)
        .where(
          and(
            eq(cohortTeachers.cohortId, "c-colleague"),
            eq(cohortTeachers.userId, "del-teacher-own"),
          ),
        )
        .all(),
    ).toHaveLength(0);
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
