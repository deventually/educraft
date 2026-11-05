import { describe, expect, it } from "vitest";
import { getToolBySlugOrThrow } from "~/lib/registry";
import { searchTools, toolSearchText } from "~/lib/registry/search";

/** One search for the catalogue (/tools) and the question box on Start (P27.3). */
const items = [
  { slug: "a", search: "toetsvragen en toetsmatrijs maken test items" },
  { slug: "b", search: "rubric maken beoordelingsmodel" },
  { slug: "c", search: "les voorbereiden lesson plan rosenshine" },
  { slug: "d", search: "opdracht differentiëren tomlinson" },
];

describe("toolSearchText", () => {
  it("joins name, tagline, theory and keywords in both languages, lower-cased", () => {
    const text = toolSearchText(getToolBySlugOrThrow("test-items"));
    expect(text).toContain("toetsvragen");
    expect(text).toContain("test questions");
    expect(text).toBe(text.toLowerCase());
  });
});

describe("searchTools", () => {
  it("returns everything for an empty query", () => {
    expect(searchTools(items, "  ")).toEqual(items);
  });

  it("matches one word as before (substring, case-insensitive)", () => {
    expect(searchTools(items, "Rubric").map((i) => i.slug)).toEqual(["b"]);
  });

  it("ranks by how many words of a question match, best first", () => {
    const hits = searchTools(items, "Ik wil toetsvragen maken");
    expect(hits.map((i) => i.slug)).toEqual(["a", "b"]);
  });

  it("ignores filler words, so a question does not match every tool", () => {
    expect(searchTools(items, "ik wil een les voor mijn groep").map((i) => i.slug)).toEqual(["c"]);
  });

  it("caps the result when a limit is given", () => {
    expect(searchTools(items, "maken", 1)).toHaveLength(1);
  });

  it("finds nothing for a word no tool has", () => {
    expect(searchTools(items, "xyzzy")).toEqual([]);
  });
});
