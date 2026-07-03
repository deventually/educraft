import { describe, it, expect, beforeAll } from "vitest";

// Point the DB at an isolated in-memory SQLite before any server module loads,
// so the repository under test never touches the on-disk dev database.
process.env.DATABASE_URL = "file::memory:";

type Repo = typeof import("~/server/repositories/generations.server");
let repo: Repo;

const USER_A = "gen-user-a";
const USER_B = "gen-user-b";

beforeAll(async () => {
  repo = await import("~/server/repositories/generations.server");
});

describe("upsertChatGeneration", () => {
  it("keeps a whole chat session in a single row, updated turn by turn", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const base = {
      id,
      userId: USER_A,
      toolSlug: "mentorai",
      stageId: "mentor",
      model: "claude-sonnet-4-6",
      input: { discipline: "CS" },
      contextProfileId: null,
      outputLanguage: "en",
    };

    await repo.upsertChatGeneration({ ...base, transcript: "**You:**\n\nHi" });
    await repo.upsertChatGeneration({
      ...base,
      transcript: "**You:**\n\nHi\n\n**Assistant:**\n\nHello",
    });

    const mine = (await repo.listGenerations(USER_A, 50)).filter((g) => g.id === id);
    expect(mine).toHaveLength(1);
    expect(mine[0].outputMarkdown).toContain("**Assistant:**");
    expect(mine[0].toolSlug).toBe("mentorai");
  });

  it("preserves the original createdAt across turns (stable ordering)", async () => {
    const id = "22222222-2222-2222-2222-222222222222";
    const base = {
      id,
      userId: USER_A,
      toolSlug: "mentorai",
      model: "claude-sonnet-4-6",
      input: {},
      outputLanguage: "nl",
    };

    const first = await repo.upsertChatGeneration({ ...base, transcript: "a" });
    const second = await repo.upsertChatGeneration({ ...base, transcript: "a\n\nb" });
    expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
  });

  it("creates separate rows for separate sessions", async () => {
    await repo.upsertChatGeneration({
      id: "33333333-3333-3333-3333-333333333333",
      userId: USER_A,
      toolSlug: "mentorai",
      model: "m",
      input: {},
      outputLanguage: "en",
      transcript: "x",
    });
    await repo.upsertChatGeneration({
      id: "44444444-4444-4444-4444-444444444444",
      userId: USER_A,
      toolSlug: "mentorai",
      model: "m",
      input: {},
      outputLanguage: "en",
      transcript: "y",
    });
    const ids = (await repo.listGenerations(USER_A, 50)).map((g) => g.id);
    expect(ids).toContain("33333333-3333-3333-3333-333333333333");
    expect(ids).toContain("44444444-4444-4444-4444-444444444444");
  });
});

describe("per-user scoping", () => {
  it("lists only the requesting user's generations", async () => {
    await repo.saveGeneration({
      userId: USER_B,
      toolSlug: "guided-reflection",
      model: "m",
      input: {},
      outputLanguage: "nl",
      outputMarkdown: "B's work",
    });

    const aIds = (await repo.listGenerations(USER_A, 50)).map((g) => g.id);
    const bList = await repo.listGenerations(USER_B, 50);
    expect(bList.every((g) => g.outputMarkdown === "B's work")).toBe(true);
    // None of B's rows appear in A's list.
    expect(bList.some((g) => aIds.includes(g.id))).toBe(false);
  });

  it("only deletes a generation the requesting user owns", async () => {
    const row = await repo.saveGeneration({
      userId: USER_A,
      toolSlug: "guided-reflection",
      model: "m",
      input: {},
      outputLanguage: "nl",
      outputMarkdown: "A's private row",
    });

    // B cannot delete A's row.
    await repo.deleteGeneration(USER_B, row.id);
    expect((await repo.listGenerations(USER_A, 50)).some((g) => g.id === row.id)).toBe(true);

    // A can delete their own.
    await repo.deleteGeneration(USER_A, row.id);
    expect((await repo.listGenerations(USER_A, 50)).some((g) => g.id === row.id)).toBe(false);
  });
});
