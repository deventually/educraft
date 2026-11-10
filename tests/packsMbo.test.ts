import { describe, it, expect } from "vitest";
import { resolveFramework } from "~/lib/context/frameworks";
import { getDomainsForTrack } from "~/lib/context/domains";
import { loc } from "~/lib/i18n/localized";

const pack = (slug: string) => resolveFramework("NL", "mbo", slug)!;
const values = (slug: string, key: string) =>
  pack(slug)
    .fields.find((f) => f.key === key)!
    .options!.map((o) => o.value);
const KWALIFICATIES = getDomainsForTrack("NL", "mbo", "mbo-4")
  .map((d) => d.value)
  .filter((v) => v.startsWith("mbo-kw-"));

describe("mbo packs per kwalificatie (SBB kwalificatiedossiers, BESLUIT-2026-11-10-4)", () => {
  it("gives every kwalificatie in the picker a pack with crebo, dossier and date in its source", () => {
    expect(KWALIFICATIES.length).toBeGreaterThan(0);
    for (const slug of KWALIFICATIES) {
      const p = pack(slug);
      expect(p, slug).toBeDefined();
      const src = loc(p.source, "nl");
      expect(src, slug).toContain(slug.replace("mbo-kw-", ""));
      expect(src, slug).toMatch(/kwalificatiedossier .+ \(crebo \d{5}\)/i);
      expect(src, slug).toMatch(/geldig vanaf \d{1,2}-\d{1,2}-20\d\d/i);
      expect(p.sourceUrl, slug).toMatch(/^https:\/\//);
    }
  });

  it("has kerntaken and werkprocessen with their codes, and no level field (the mbo level is the level)", () => {
    for (const slug of KWALIFICATIES) {
      const p = pack(slug);
      expect(
        p.fields.map((f) => [f.key, f.type]),
        slug,
      ).toEqual([
        ["kerntaken", "multiselect"],
        ["werkprocessen", "multiselect"],
      ]);
      for (const v of values(slug, "kerntaken")) expect(v, slug).toMatch(/^[BP]\d-K\d: \S/);
      for (const v of values(slug, "werkprocessen")) expect(v, slug).toMatch(/^[BP]\d-K\d-W\d: \S/);
    }
  });

  it("labels every option bilingually and keeps values unique", () => {
    for (const slug of KWALIFICATIES) {
      for (const f of pack(slug).fields) {
        expect(loc(f.label, "en"), slug).not.toBe(loc(f.label, "nl"));
        const vals = f.options!.map((o) => o.value);
        expect(new Set(vals).size, `${slug} ${f.key}`).toBe(vals.length);
        for (const o of f.options!) {
          expect(loc(o.label, "nl"), o.value).toBe(o.value);
          expect(loc(o.label, "en").length, o.value).toBeGreaterThan(0);
        }
      }
    }
  });

  it("encodes Verzorgende IG (27144): the shared basisdeel of Verzorging en verpleging", () => {
    expect(values("mbo-kw-27144", "kerntaken")).toEqual([
      "B1-K1: Biedt zorg, ondersteuning en begeleiding",
      "B1-K2: Stemt de zorg en ondersteuning af",
      "B1-K3: Draagt bij aan kwaliteit van zorg",
    ]);
    expect(values("mbo-kw-27144", "werkprocessen")).toHaveLength(11);
    expect(values("mbo-kw-27144", "werkprocessen")).toContain(
      "B1-K1-W5: Handelt in onvoorziene en/of acute situaties",
    );
  });

  it("encodes Mbo-Verpleegkundige (27145): the basisdeel plus profieldeel P2", () => {
    expect(values("mbo-kw-27145", "kerntaken")).toContain(
      "P2-K1: Organiseert en coördineert de zorgverlening",
    );
    expect(values("mbo-kw-27145", "werkprocessen")).toHaveLength(14);
    expect(values("mbo-kw-27145", "werkprocessen")).toContain(
      "P2-K1-W1: Stelt een verpleegkundige diagnose",
    );
  });

  it("encodes Helpende Zorg en Welzijn (25960): basisdeel Dienstverlening plus profieldeel P2", () => {
    expect(values("mbo-kw-25960", "kerntaken")).toEqual([
      "B1-K1: Voert dienstverlenende werkzaamheden uit",
      "P2-K1: Ondersteunt bij dagelijkse activiteiten in zorg en welzijn",
    ]);
    expect(values("mbo-kw-25960", "werkprocessen")).toHaveLength(9);
  });

  it("encodes Software developer (25998): two kerntaken, eight werkprocessen", () => {
    expect(values("mbo-kw-25998", "kerntaken")).toEqual([
      "B1-K1: Realiseert software",
      "B1-K2: Voert ICT-projecten uit",
    ]);
    expect(values("mbo-kw-25998", "werkprocessen")).toHaveLength(8);
  });
});
