import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { envSchema } from "~/server/env.server";
import { OPS_SCRIPTS } from "../../scripts/ops.config";

/**
 * The handover document and the emergency plan are what someone else reads when Bastiaan is
 * not there. They must keep pointing at things that exist, and the repo is public, so they
 * name secrets but never hold one.
 */
const root = resolve(__dirname, "../..");
const DOCS = ["docs/overdracht.md", "docs/noodplan.md"] as const;
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe.each(DOCS)("%s", (file) => {
  it("exists", () => {
    expect(existsSync(resolve(root, file))).toBe(true);
  });

  const text = existsSync(resolve(root, file)) ? read(file) : "";

  it("only names ops scripts the image ships", () => {
    const named = [...text.matchAll(/build\/ops\/([a-z0-9-]+)\.js/g)].map((m) => m[1]);
    const shipped: string[] = OPS_SCRIPTS.map((s) => s.name);
    for (const name of named) expect(shipped).toContain(name);
  });

  it("has relative links that resolve", () => {
    const links = [...text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)]
      .map((m) => m[1] ?? "")
      .filter((href) => !/^[a-z]+:/.test(href));
    for (const href of links) {
      expect(existsSync(resolve(root, dirname(file), href)), href).toBe(true);
    }
  });

  it("names secrets without a value", () => {
    expect(text).not.toMatch(/\b[A-Z][A-Z0-9_]*(?:SECRET|API_KEY)=\S/);
    expect(text).not.toMatch(/sk-[a-z]+-[A-Za-z0-9_-]{8,}/);
  });
});

describe("handover document", () => {
  const text = existsSync(resolve(root, DOCS[0])) ? read(DOCS[0]) : "";

  it.each(envSchema.keyof().options.filter((key) => /SECRET|API_KEY/.test(key)))(
    "lists the secret %s",
    (key) => {
      expect(text).toContain(key);
    },
  );
});

describe("emergency plan", () => {
  const text = existsSync(resolve(root, DOCS[1])) ? read(DOCS[1]) : "";

  it.each([
    "node build/ops/backup.js",
    "node build/ops/restore.js",
    "node build/ops/reset-2fa.js",
    "node build/ops/set-owner.js",
    "SESSION_SECRET",
    "72 uur",
  ])("covers %s", (needle) => {
    expect(text).toContain(needle);
  });
});
