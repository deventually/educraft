import { describe, it, expect } from "vitest";
import { DOMAIN_PACKS, getDomainPack, getPackField, type PackField } from "~/lib/context/packs";
import { HBO_DOMAINS } from "~/lib/context/types";
import type { LocalizedText } from "~/lib/i18n/localized";

function isBilingual(v: LocalizedText): boolean {
  return (
    typeof v === "object" &&
    typeof v.nl === "string" &&
    v.nl.length > 0 &&
    typeof v.en === "string" &&
    v.en.length > 0
  );
}

const PACKED = Object.keys(DOMAIN_PACKS);

describe("domain packs registry", () => {
  it("only keys real HBO domains", () => {
    for (const key of PACKED) {
      expect(HBO_DOMAINS).toContain(key);
    }
  });

  it("covers exactly the eight domains with a verified framework", () => {
    expect(PACKED.sort()).toEqual(
      [
        "Economie & management",
        "ICT",
        "Kunst & creatief",
        "Onderwijs",
        "Recht",
        "Sociale studies",
        "Techniek",
        "Zorg & welzijn",
      ].sort(),
    );
  });

  it("leaves domains without a national taxonomy unpacked (→ custom fields)", () => {
    expect(getDomainPack("Agro, voeding & leefomgeving")).toBeUndefined();
    expect(getDomainPack("Overig")).toBeUndefined();
    expect(getDomainPack(undefined)).toBeUndefined();
    expect(getDomainPack(null)).toBeUndefined();
  });

  it("every pack has a bilingual source + an https sourceUrl", () => {
    for (const [domain, pack] of Object.entries(DOMAIN_PACKS)) {
      expect(isBilingual(pack!.source), `${domain} source`).toBe(true);
      expect(pack!.sourceUrl, `${domain} sourceUrl`).toMatch(/^https:\/\//);
      expect(pack!.fields.length, `${domain} has fields`).toBeGreaterThan(0);
    }
  });

  it("every field is well-formed (unique key, bilingual label, valid options/levels)", () => {
    for (const [domain, pack] of Object.entries(DOMAIN_PACKS)) {
      const keys = new Set<string>();
      for (const field of pack!.fields as PackField[]) {
        expect(field.key, `${domain} field key`).toMatch(/^[a-zA-Z]+$/);
        expect(keys.has(field.key), `${domain} duplicate key ${field.key}`).toBe(false);
        keys.add(field.key);
        expect(isBilingual(field.label), `${domain}.${field.key} label`).toBe(true);
        if (field.help) expect(isBilingual(field.help), `${domain}.${field.key} help`).toBe(true);

        if (field.type === "level") {
          expect(field.levelMax ?? 0, `${domain}.${field.key} levelMax`).toBeGreaterThanOrEqual(1);
        } else {
          expect(field.options?.length, `${domain}.${field.key} options`).toBeGreaterThan(0);
          const values = new Set<string>();
          for (const opt of field.options ?? []) {
            expect(opt.value.length, `${domain}.${field.key} option value`).toBeGreaterThan(0);
            expect(values.has(opt.value), `${domain}.${field.key} dup option`).toBe(false);
            values.add(opt.value);
            expect(isBilingual(opt.label), `${domain}.${field.key} option label`).toBe(true);
          }
        }
      }
    }
  });

  it("encodes the verified hbo-i (ICT) terms", () => {
    const layers = getPackField("ICT", "architectuurlagen");
    expect(layers?.type).toBe("multiselect");
    expect(layers?.options?.map((o) => o.value)).toEqual(
      expect.arrayContaining(["Gebruikersinteractie", "Software", "Hardware-interfacing"]),
    );
    expect(getPackField("ICT", "beheersingsniveau")?.levelMax).toBe(3);
  });

  it("encodes all eight HBO Engineering domeincompetenties incl. Professionaliseren", () => {
    const comp = getPackField("Techniek", "domeincompetenties");
    expect(comp?.options).toHaveLength(8);
    expect(comp?.options?.map((o) => o.value)).toContain("Professionaliseren");
  });

  it("encodes the 7 CanMEDS roles for Zorg & welzijn", () => {
    expect(getPackField("Zorg & welzijn", "canmedsRollen")?.options).toHaveLength(7);
  });

  it("encodes Onderwijs as 3 bekwaamheden + a single-select lerarenopleiding type", () => {
    expect(getPackField("Onderwijs", "bekwaamheid")?.options).toHaveLength(3);
    expect(getPackField("Onderwijs", "typeLerarenopleiding")?.type).toBe("single-select");
  });

  it("encodes the 6 HBO-Rechten leeruitkomsten", () => {
    expect(getPackField("Recht", "leeruitkomsten")?.options).toHaveLength(6);
  });
});
