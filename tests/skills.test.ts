import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Project skills (`.claude/skills/<name>/SKILL.md`) that every Claude session in this repo can
 * use. Skills get an English name (BESLUIT-2026-11-11-5), in kebab-case, equal to their folder.
 */
const dir = resolve(__dirname, "../.claude/skills");
const skills = readdirSync(dir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

function frontmatter(name: string): Record<string, string> {
  const text = readFileSync(resolve(dir, name, "SKILL.md"), "utf8");
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? "";
  const fields: Record<string, string> = {};
  let key = "";
  for (const line of block.split("\n")) {
    const m = /^([a-z]+):\s*(.*)$/.exec(line);
    if (m?.[1]) {
      key = m[1];
      fields[key] = (m[2] ?? "").replace(/^>-?$/, "");
    } else if (key) fields[key] = `${fields[key]} ${line.trim()}`.trim();
  }
  return fields;
}

describe("project skills", () => {
  it.each(["tdd", "release", "maintenance"])("has the %s skill", (name) => {
    expect(skills).toContain(name);
  });

  describe.each(skills)("%s", (name) => {
    it("has a SKILL.md", () => {
      expect(existsSync(resolve(dir, name, "SKILL.md"))).toBe(true);
    });

    it("has an English kebab-case name equal to its folder", () => {
      expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(frontmatter(name).name).toBe(name);
    });

    it("says when to use it", () => {
      expect(frontmatter(name).description?.length ?? 0).toBeGreaterThan(40);
    });
  });
});
