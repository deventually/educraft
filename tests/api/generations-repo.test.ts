import { describe, it, expect, beforeAll } from "vitest";

// Point the DB at an isolated in-memory SQLite before any server module loads,
// so the repository under test never touches the on-disk dev database.
process.env.DATABASE_URL = "file::memory:";

type Repo = typeof import("~/server/repositories/generations.server");
let repo: Repo;

beforeAll(async () => {
  repo = await import("~/server/repositories/generations.server");
});

describe("upsertChatGeneration", () => {
  it("keeps a whole chat session in a single row, updated turn by turn", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const base = {
      id,
      toolSlug: "mentorai",
      stageId: "mentor",
      model: "claude-sonnet-4-6",
      input: { discipline: "CS" },
      contextProfileId: null,
      outputLanguage: "en",
    };

    repo.upsertChatGeneration({ ...base, transcript: "**You:**\n\nHi" });
    repo.upsertChatGeneration({ ...base, transcript: "**You:**\n\nHi\n\n**Assistant:**\n\nHello" });

    const mine = repo.listGenerations(50).filter((g) => g.id === id);
    expect(mine).toHaveLength(1);
    expect(mine[0].outputMarkdown).toContain("**Assistant:**");
    expect(mine[0].toolSlug).toBe("mentorai");
  });

  it("preserves the original createdAt across turns (stable ordering)", () => {
    const id = "22222222-2222-2222-2222-222222222222";
    const base = {
      id,
      toolSlug: "mentorai",
      model: "claude-sonnet-4-6",
      input: {},
      outputLanguage: "nl",
    };

    const first = repo.upsertChatGeneration({ ...base, transcript: "a" });
    const second = repo.upsertChatGeneration({ ...base, transcript: "a\n\nb" });
    expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
  });

  it("creates separate rows for separate sessions", () => {
    repo.upsertChatGeneration({
      id: "33333333-3333-3333-3333-333333333333",
      toolSlug: "mentorai",
      model: "m",
      input: {},
      outputLanguage: "en",
      transcript: "x",
    });
    repo.upsertChatGeneration({
      id: "44444444-4444-4444-4444-444444444444",
      toolSlug: "mentorai",
      model: "m",
      input: {},
      outputLanguage: "en",
      transcript: "y",
    });
    const ids = repo.listGenerations(50).map((g) => g.id);
    expect(ids).toContain("33333333-3333-3333-3333-333333333333");
    expect(ids).toContain("44444444-4444-4444-4444-444444444444");
  });
});
