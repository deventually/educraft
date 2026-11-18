import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let repo: typeof import("~/server/repositories/sharedKeepWords.server");
let keep: typeof import("~/server/repositories/keepWords.server");

beforeAll(async () => {
  repo = await import("~/server/repositories/sharedKeepWords.server");
  keep = await import("~/server/repositories/keepWords.server");
  const users = await import("~/server/repositories/users.server");
  for (const [id, name] of [
    ["sk-a", "Mark de Groot"],
    ["sk-b", "Anna Visser"],
    ["sk-c", "Roos Jansen"],
    ["sk-d", "Bas"],
  ] as const)
    await users.createUser({ id, name, passwordHash: "x", role: "teacher" });
  await keep.addKeepWord("sk-a", "Engelmann");
  await keep.addKeepWord("sk-b", "engelmann");
  await keep.addKeepWord("sk-c", "Engelmann");
  await keep.addKeepWord("sk-a", "Lave");
  await keep.addKeepWord("sk-a", "Visser"); // a lone surname: what the never-list is for
  await keep.addKeepWord("sk-b", "Mark de Groot"); // a user's full name
  await keep.addKeepWord("sk-c", "Bloom"); // already in the pack
});

/**
 * The never-words of the institution (anonymiseerpoort PR 5): the admin sees which words
 * teachers put on their never-list, never whose, and keeps one for everyone with one click.
 * A user's full name never shows and never goes on the shared list; a lone part of a name
 * ("Visser") may, since that is what a never-list holds.
 */
describe("shared keep words", () => {
  it("lists the teachers' words with how many teachers chose each, most first", async () => {
    expect(await repo.listKeepWordSuggestions()).toEqual([
      { word: "Engelmann", teachers: 3 },
      { word: "Lave", teachers: 1 },
      { word: "Visser", teachers: 1 },
    ]);
  });

  it("leaves out a user's full name and what the pack already keeps", async () => {
    const words = (await repo.listKeepWordSuggestions()).map((s) => s.word.toLowerCase());
    expect(words).not.toContain("mark de groot");
    expect(words).not.toContain("bloom");
  });

  it("keeps a word for everyone, and then no longer suggests it", async () => {
    expect(await repo.addSharedKeepWord("Engelmann", "sk-admin")).toBe("added");
    expect(await repo.listSharedKeepWords()).toEqual(["Engelmann"]);
    expect((await repo.listKeepWordSuggestions()).map((s) => s.word)).toEqual(["Lave", "Visser"]);
    // Adding twice, in another case, is one entry.
    expect(await repo.addSharedKeepWord(" engelmann ", "sk-admin")).toBe("added");
    expect(await repo.listSharedKeepWords()).toEqual(["Engelmann"]);
  });

  it("takes a word off the shared list, and the teachers' choice shows again", async () => {
    await repo.removeSharedKeepWord("ENGELMANN");
    expect(await repo.listSharedKeepWords()).toEqual([]);
    expect((await repo.listKeepWordSuggestions())[0]).toEqual({ word: "Engelmann", teachers: 3 });
  });

  it("refuses a user's full name and what is not a word", async () => {
    expect(await repo.addSharedKeepWord("Bas", "sk-admin")).toBe("name");
    expect(await repo.addSharedKeepWord("anna visser", "sk-admin")).toBe("name");
    for (const word of ["jan@school.nl", "s1234567", "", "x"])
      expect(await repo.addSharedKeepWord(word, "sk-admin")).toBe("invalid");
    expect(await repo.listSharedKeepWords()).toEqual([]);
  });
});
