import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Ratchets: numbers that may only go down. When you lower one, lower its baseline here in the
 * same PR, so it can never climb back. Raising a baseline is a decision, not a fix.
 */
const root = resolve(__dirname, "..");

const CODE = /\.(ts|tsx|js|mjs|cjs)$/;

function walk(dir: string): string[] {
  return readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(p);
    return CODE.test(e.name) ? [p] : [];
  });
}

const read = (p: string) => readFileSync(resolve(root, p), "utf8");

// --- Suppressions --------------------------------------------------------------------------------

/** Type and lint escapes: each one switches a check off. */
const SUPPRESSION = /\bas any\b|@ts-ignore|@ts-expect-error|@ts-nocheck|biome-ignore/g;
const countSuppressions = (src: string) => src.match(SUPPRESSION)?.length ?? 0;

/** Baseline on 2026-11-09 (app/ and scripts/). May only go down. */
const SUPPRESSIONS_BASELINE = 31;

// --- Long files ----------------------------------------------------------------------------------

const MAX_LINES = 400;
const lineCount = (src: string) => src.split("\n").length - (src.endsWith("\n") ? 1 : 0);

/**
 * Files in app/ over 400 lines on 2026-11-09. The list may only shrink: a new long file fails,
 * and a file that drops to 400 lines or fewer must leave the list.
 */
const LONG_FILES_BASELINE = [
  "app/components/AppShell.tsx",
  "app/components/DynamicForm.tsx",
  "app/components/documents/DocumentViewer.tsx",
  "app/components/utilities/RubricEditor.tsx",
  "app/components/utilities/RubricFill.tsx",
  "app/lib/ai/models.ts",
  "app/lib/registry/goals.ts",
  "app/routes/portfolio.$id.outcome.$outcomeId.tsx",
  "app/routes/portfolio.$id.tsx",
  "app/routes/start.tsx",
  "app/server/availability.server.ts",
  "app/server/repositories/users.server.ts",
];

// --- TODO / FIXME --------------------------------------------------------------------------------

/** A TODO or FIXME that opens a comment (`// TODO`, `/* FIXME`, ` * TODO`). */
const MARKER = /(?:\/\/|\/\*|^\s*\*)\s*(?:TODO|FIXME)\b/;
/** It must name the issue that tracks it, e.g. `// TODO(#123): …` or `// FIXME #123 …`. */
const ISSUE = /#\d+/;
const untrackedMarkers = (src: string) =>
  src
    .split("\n")
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => MARKER.test(line) && !ISSUE.test(line));

describe("ratchet detectors", () => {
  it("counts every kind of suppression", () => {
    const src = [
      "const a = b as any;",
      "// @ts-ignore",
      "// @ts-expect-error: reason",
      "// @ts-nocheck",
      "// biome-ignore lint/x: reason",
      "const c = d as anything;",
    ].join("\n");
    expect(countSuppressions(src)).toBe(5);
  });

  it("counts lines with or without a trailing newline", () => {
    expect(lineCount("a\nb\n")).toBe(2);
    expect(lineCount("a\nb")).toBe(2);
  });

  it("flags a TODO or FIXME comment without an issue number", () => {
    const src = [
      "// TODO: later",
      "/* FIXME broken */",
      " * TODO tidy",
      "// TODO(#12): tracked",
      "// FIXME #7 tracked",
      'const s = "TODO";',
      " * may type TODO in a chapter",
    ].join("\n");
    expect(untrackedMarkers(src).map((m) => m.n)).toEqual([1, 2, 3]);
  });
});

describe("ratchet: suppressions may only go down", () => {
  const files = [...walk("app"), ...walk("scripts")];
  const perFile = files.map((f) => ({ f, n: countSuppressions(read(f)) })).filter(({ n }) => n > 0);
  const total = perFile.reduce((s, { n }) => s + n, 0);

  it(`has at most ${SUPPRESSIONS_BASELINE} (as any, @ts-ignore, @ts-expect-error, biome-ignore)`, () => {
    expect(
      total,
      `fix the new one instead; per file: ${JSON.stringify(perFile)}`,
    ).toBeLessThanOrEqual(SUPPRESSIONS_BASELINE);
  });

  it("has its baseline lowered when the count drops", () => {
    expect(total, "lower SUPPRESSIONS_BASELINE in tests/ratchet.test.ts").toBe(
      SUPPRESSIONS_BASELINE,
    );
  });
});

describe(`ratchet: files in app/ over ${MAX_LINES} lines may only go down`, () => {
  const long = walk("app")
    .filter((f) => lineCount(read(f)) > MAX_LINES)
    .map((f) => relative(root, resolve(root, f)).split("\\").join("/"))
    .sort();

  it("adds no new long file", () => {
    const added = long.filter((f) => !LONG_FILES_BASELINE.includes(f));
    expect(added, `split these below ${MAX_LINES} lines`).toEqual([]);
  });

  it("drops a file from the baseline once it is short", () => {
    const shortened = LONG_FILES_BASELINE.filter((f) => !long.includes(f));
    expect(shortened, "remove these from LONG_FILES_BASELINE in tests/ratchet.test.ts").toEqual([]);
  });
});

describe("ratchet: every TODO and FIXME names its issue", () => {
  const found = ["app", "scripts", "tests", "evals"]
    .flatMap(walk)
    .filter((f) => f !== join("tests", "ratchet.test.ts")) // its own examples
    .flatMap((f) => untrackedMarkers(read(f)).map(({ n, line }) => `${f}:${n}: ${line.trim()}`));

  it("has none without an issue number", () => {
    expect(found, "add the issue, e.g. // TODO(#123): …, or resolve it").toEqual([]);
  });
});
