import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WCAG 2.2 AA contrast for the muted neutrals (P1, "contrast van slate-400").
 * The "Grove" palette in app/app.css keeps Tailwind's token names but not its values, so a
 * class that passes in stock Tailwind may fail here. These tests check the real values.
 */
const root = resolve(__dirname, "..");
const css = readFileSync(resolve(root, "app/app.css"), "utf8");

const token = (name: string): string => {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --color-${name} not found in app.css`);
  return m[1];
};

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// The light surfaces muted text sits on: cards, the page body, subtle fills.
const surfaces = {
  white: "#ffffff",
  "slate-50": token("slate-50"),
  "slate-100": token("slate-100"),
};

describe("muted text tokens meet 4.5:1 on light surfaces", () => {
  it.each(["slate-500", "slate-600"])("%s", (name) => {
    for (const [surface, bg] of Object.entries(surfaces)) {
      expect(contrast(token(name), bg), `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("slate-400 stays decorative", () => {
  // slate-400 is ~2.2:1 on paper: too light for text (4.5:1) and for controls (3:1). It may
  // remain only on elements hidden from assistive tech (aria-hidden icons and glyphs).
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
    });

  it("appears only on aria-hidden elements in app/", () => {
    const offenders = files(resolve(root, "app")).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, i) => ({ line, at: `${relative(root, file)}:${i + 1}` }))
        .filter(({ line }) => line.includes("slate-400") && !line.includes("aria-hidden"))
        .map(({ at }) => at),
    );
    expect(offenders).toEqual([]);
  });
});
