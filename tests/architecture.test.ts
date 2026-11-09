import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";

/**
 * Architecture rules from AGENTS.md, enforced on the source text of `app/`:
 * - browser code (`app/components` and everything it imports) never reaches a `*.server` module;
 * - only `app/server/db.server.ts` talks to better-sqlite3;
 * - only `app/lib/ai/` imports an AI SDK (`ai`, `@ai-sdk/*`, `@anthropic-ai/*`).
 * Type-only imports are erased at build time, so they don't count.
 */
const root = resolve(__dirname, "..");
const app = resolve(root, "app");
const rel = (abs: string) => relative(root, abs).replaceAll("\\", "/");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const abs = resolve(dir, name);
    if (statSync(abs).isDirectory()) return walk(abs);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts") ? [abs] : [];
  });

/** Runtime import specifiers of one file: static, re-export, side-effect and dynamic imports. */
type AstNode = { type?: string; [key: string]: unknown };
const isNode = (v: unknown): v is AstNode => typeof v === "object" && v !== null;
const literal = (v: unknown) =>
  isNode(v) && v.type === "Literal" && typeof v.value === "string" ? v.value : null;

function runtimeImports(source: string, fileName = "x.tsx"): string[] {
  // TypeScript 7 has no JS API; oxc parses TS/TSX into an ESTree with importKind/exportKind.
  const { program } = parseSync(fileName, source);
  const out: string[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!isNode(node)) return;
    const spec = literal(node.source);
    if (node.type === "ImportDeclaration" && spec !== null) {
      const specifiers = node.specifiers as AstNode[];
      const typeOnly =
        node.importKind === "type" ||
        (specifiers.length > 0 &&
          specifiers.every((s) => s.type === "ImportSpecifier" && s.importKind === "type"));
      if (!typeOnly) out.push(spec);
    } else if (
      (node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") &&
      spec !== null
    ) {
      if (node.exportKind !== "type") out.push(spec);
    } else if (node.type === "ImportExpression" && spec !== null) {
      out.push(spec);
    }
    for (const value of Object.values(node)) visit(value);
  };
  visit(program);
  return out;
}

/** Resolve a local specifier (`~/…` or relative) to a file in `app/`, or null for a package. */
function resolveLocal(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("~/")) base = resolve(app, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

const files = walk(app);
const imports = new Map(files.map((f) => [f, runtimeImports(readFileSync(f, "utf8"), f)] as const));
const isServerModule = (abs: string) => /\.server\.tsx?$/.test(abs) || abs.includes("/.server/");

describe("the import scanner", () => {
  it("sees static, re-export, side-effect and dynamic imports", () => {
    const src = [
      'import a from "react";',
      'import { b } from "react-dom";',
      'export { c } from "zod";',
      'import "ai";',
      'const e = await import("vitest");',
    ].join("\n");
    expect(runtimeImports(src)).toEqual(["react", "react-dom", "zod", "ai", "vitest"]);
  });

  it("ignores type-only imports and re-exports", () => {
    const src = [
      'import type { A } from "react";',
      'import { type B } from "react-dom";',
      'export type { C } from "zod";',
    ].join("\n");
    expect(runtimeImports(src)).toEqual([]);
  });

  it("resolves ~/ paths into app/", () => {
    expect(resolveLocal("~/server/db.server", resolve(app, "root.tsx"))).toBe(
      resolve(app, "server/db.server.ts"),
    );
  });
});

describe("browser code never reaches a *.server module", () => {
  /** Every file a component pulls into the browser bundle, with the chain that got it there. */
  const reachable = new Map<string, string[]>();
  const queue = files
    .filter((f) => f.startsWith(`${resolve(app, "components")}/`))
    .map((f): [string, string[]] => [f, [rel(f)]]);
  for (const [file, chain] of queue) {
    if (reachable.has(file)) continue;
    reachable.set(file, chain);
    for (const spec of imports.get(file) ?? []) {
      const target = resolveLocal(spec, file);
      if (target && !reachable.has(target)) queue.push([target, [...chain, rel(target)]]);
    }
  }

  it("finds the component tree", () => {
    expect(reachable.size).toBeGreaterThan(50);
  });

  it("no component imports a *.server module, directly or through a chain", () => {
    const leaks = [...reachable]
      .filter(([f]) => isServerModule(f))
      .map(([, chain]) => chain.join(" → "));
    expect(leaks).toEqual([]);
  });
});

describe("only db.server.ts talks to better-sqlite3", () => {
  it("no other file in app/ imports better-sqlite3", () => {
    const users = files.filter((f) => imports.get(f)?.includes("better-sqlite3")).map(rel);
    expect(users).toEqual(["app/server/db.server.ts"]);
  });
});

describe("AI SDKs stay behind app/lib/ai/", () => {
  const isSdk = (spec: string) =>
    spec === "ai" ||
    spec.startsWith("ai/") ||
    spec.startsWith("@ai-sdk/") ||
    spec.startsWith("@anthropic-ai/");

  it("the provider layer itself does use an SDK", () => {
    const inside = files.filter(
      (f) => f.startsWith(`${resolve(app, "lib/ai")}/`) && imports.get(f)?.some(isSdk),
    );
    expect(inside.length).toBeGreaterThan(0);
  });

  it("nothing outside app/lib/ai/ imports ai, @ai-sdk/* or @anthropic-ai/*", () => {
    const outside = files
      .filter((f) => !f.startsWith(`${resolve(app, "lib/ai")}/`))
      .flatMap((f) => (imports.get(f) ?? []).filter(isSdk).map((s) => `${rel(f)}: ${s}`));
    expect(outside).toEqual([]);
  });
});

describe("a tool's mode is a strategy, not a branch", () => {
  // Principle 4 (deep modules): what differs between a chat, chained stages and a single
  // generation lives in `app/lib/registry/modes.ts`. Validating the raw data may still look.
  const allowed = new Set(["app/lib/registry/modes.ts", "app/lib/registry/validate.ts"]);
  const BRANCH = /\bmode\s*[!=]==?\s*["'](?:chat|one-shot)["']|\bstages\.length\s*>\s*1\b/;

  it("the detector sees a branch on the mode or on the stage count", () => {
    expect(BRANCH.test('const isChat = tool.mode === "chat";')).toBe(true);
    expect(BRANCH.test("tool.mode !== 'one-shot'")).toBe(true);
    expect(BRANCH.test("const multiStage = tool.stages.length > 1;")).toBe(true);
    expect(BRANCH.test('mode === "password"')).toBe(false);
  });

  it("no route or component outside modes.ts branches on tool.mode", () => {
    const offenders = files
      .filter((f) => !allowed.has(rel(f)))
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .flatMap((line, i) => (BRANCH.test(line) ? [`${rel(f)}:${i + 1}`] : [])),
      );
    expect(offenders).toEqual([]);
  });
});
