import { describe, it, expect } from "vitest";
import { PROMPTS } from "~/lib/prompts";
import { placeholdersIn } from "~/lib/template/interpolate";

const entries = Object.values(PROMPTS);

describe("externalised prompt definitions", () => {
  it("has at least the seven registered prompts", () => {
    expect(entries.length).toBeGreaterThanOrEqual(7);
  });

  it("every prompt has non-empty nl + en runtime variants and a verbatim", () => {
    for (const p of entries) {
      expect(p.runtime.nl.trim().length, `${p.id} nl`).toBeGreaterThan(0);
      expect(p.runtime.en.trim().length, `${p.id} en`).toBeGreaterThan(0);
      expect(p.verbatim.trim().length, `${p.id} verbatim`).toBeGreaterThan(0);
    }
  });

  it("nl and en variants share an identical placeholder set", () => {
    for (const p of entries) {
      const nl = placeholdersIn(p.runtime.nl).sort();
      const en = placeholdersIn(p.runtime.en).sort();
      expect(en, p.id).toEqual(nl);
    }
  });

  it("bakes the output language per file (no {{outputLanguage}} placeholder left)", () => {
    for (const p of entries) {
      expect(placeholdersIn(p.runtime.nl), `${p.id} nl`).not.toContain("outputLanguage");
      expect(placeholdersIn(p.runtime.en), `${p.id} en`).not.toContain("outputLanguage");
    }
  });
});
