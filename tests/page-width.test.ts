import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { flatRoutes } from "./helpers/routes";

/**
 * One page width on desktop. The AppShell's <main> is the only place that sets the width of a
 * page (`max-w-6xl`), so every screen lines up with the header and is equally wide. A page that
 * centres itself in a narrower box (`mx-auto max-w-…`) makes the left edge jump between screens.
 * Narrower blocks *inside* a page (a readable text column, a short form) stay allowed: they are
 * left-aligned and don't move the page frame.
 */
const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, "app", p), "utf8");

/** Every string literal / template chunk that holds both `mx-auto` and a `max-w-*` class. */
function centredNarrowBoxes(source: string): string[] {
  const literals = source.match(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g) ?? [];
  return literals.filter((s) => /\bmx-auto\b/.test(s) && /\bmax-w-/.test(s));
}

describe("page width", () => {
  it("the AppShell sets the one page width", () => {
    const shell = read("components/AppShell.tsx");
    expect(shell).toMatch(/<main[\s\S]*?mx-auto flex w-full max-w-6xl/);
  });

  const pages = [
    ...new Set(
      flatRoutes()
        .filter((r) => r.inShell)
        .map((r) => r.file),
    ),
  ];

  it("finds the shell pages", () => {
    expect(pages.length).toBeGreaterThan(20);
  });

  it.each(pages)("%s does not centre itself in a narrower box", (file) => {
    expect(centredNarrowBoxes(read(file))).toEqual([]);
  });
});
