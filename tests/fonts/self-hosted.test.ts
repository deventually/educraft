import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Fonts are self-hosted (P1): no request leaves for Google when a teacher opens
 * LimeOnIt, and the CSP only allows our own origin for styles and fonts.
 */
const root = process.cwd();
const css = readFileSync(join(root, "app/app.css"), "utf8");
const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
const field = (face: string, name: string) =>
  face.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();

describe("self-hosted fonts", () => {
  it("declares Inter and Newsreader, upright and italic", () => {
    const styles = faces.map((f) => `${field(f!, "font-family")} ${field(f!, "font-style")}`);
    for (const family of ['"Inter"', '"Newsreader"']) {
      expect(styles).toContain(`${family} normal`);
      expect(styles).toContain(`${family} italic`);
    }
  });

  it("serves every face as a woff2 from public/fonts, with swap", () => {
    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) {
      const url = field(face!, "src")?.match(/url\("?([^")]+)"?\)/)?.[1] ?? "";
      expect(url).toMatch(/^\/fonts\/[\w-]+\.woff2$/);
      expect(existsSync(join(root, "public", url))).toBe(true);
      expect(field(face!, "font-display")).toBe("swap");
    }
  });

  it("ships the fonts' licence (SIL OFL 1.1) next to them", () => {
    expect(readFileSync(join(root, "public/fonts/OFL.txt"), "utf8")).toContain(
      "SIL OPEN FONT LICENSE Version 1.1",
    );
  });

  it("loads nothing from an external origin in the document head", async () => {
    process.env.DATABASE_URL ??= "file::memory:";
    const { links } = await import("~/root");
    const hrefs = links().map((l) => ("href" in l ? String(l.href) : ""));
    for (const href of hrefs) {
      expect(href).not.toMatch(/^(https?:)?\/\//);
      if (href.startsWith("/fonts/")) expect(existsSync(join(root, "public", href))).toBe(true);
    }
  });
});
