import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let repo: typeof import("~/server/repositories/keepWords.server");

beforeAll(async () => {
  repo = await import("~/server/repositories/keepWords.server");
});

/**
 * The teacher's never-list (anonymiseerpoort PR 3): words the preview and the gate never
 * replace for this teacher ("Bloom", a lone "Visser"). Only words, never a pattern: an
 * e-mail address or a number is a person's data and stays in the page.
 */
describe("keep words", () => {
  it("adds, lists and removes a teacher's own words", async () => {
    await repo.addKeepWord("kw-a", "Visser");
    await repo.addKeepWord("kw-a", "Roos");
    expect(await repo.listKeepWords("kw-a")).toEqual(["Roos", "Visser"]);
    await repo.removeKeepWord("kw-a", "visser");
    expect(await repo.listKeepWords("kw-a")).toEqual(["Roos"]);
  });

  it("keeps one entry per word, whatever its case", async () => {
    await repo.addKeepWord("kw-b", "Visser");
    await repo.addKeepWord("kw-b", " visser ");
    expect(await repo.listKeepWords("kw-b")).toEqual(["Visser"]);
  });

  it("never shows one teacher's words to another", async () => {
    await repo.addKeepWord("kw-c", "Hattie");
    expect(await repo.listKeepWords("kw-d")).toEqual([]);
    await repo.removeKeepWord("kw-d", "Hattie");
    expect(await repo.listKeepWords("kw-c")).toEqual(["Hattie"]);
  });

  it("goes with the account", async () => {
    const users = await import("~/server/repositories/users.server");
    await users.createUser({ id: "kw-f", name: "Weg", passwordHash: "x", role: "teacher" });
    await repo.addKeepWord("kw-f", "Kolb");
    await users.deleteUserCascade("kw-f");
    expect(await repo.listKeepWords("kw-f")).toEqual([]);
  });

  it("refuses what looks like personal data or is not a word", async () => {
    for (const word of ["jan@school.nl", "s1234567", "0612345678", "", "x", "a".repeat(101)])
      expect(await repo.addKeepWord("kw-e", word)).toBe(false);
    expect(await repo.listKeepWords("kw-e")).toEqual([]);
  });
});
