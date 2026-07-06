import { describe, it, expect } from "vitest";
import {
  parseContextForm,
  MAX_CUSTOM_FIELDS,
  MAX_CUSTOM_VALUE,
  MAX_PEDAGOGY,
  PACK_PREFIX,
} from "~/lib/context/parseForm";

function fd(entries: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("parseContextForm", () => {
  it("requires a name", () => {
    const { input, error } = parseContextForm(fd([["intent", "create"]]));
    expect(error).toBe("name-required");
    expect(input).toBeUndefined();
  });

  it("parses generic fields and validates ranges", () => {
    const { input } = parseContextForm(
      fd([
        ["name", "  SE jaar 2  "],
        ["programme", "HBO-ICT"],
        ["domain", "ICT"],
        ["studyYear", "2"],
        ["eqf", "6"],
      ]),
    );
    expect(input?.name).toBe("SE jaar 2");
    expect(input?.programme).toBe("HBO-ICT");
    expect(input?.domain).toBe("ICT");
    expect(input?.studyYear).toBe(2);
    expect(input?.eqf).toBe(6);
  });

  it("drops out-of-range / unknown enum values", () => {
    const { input } = parseContextForm(
      fd([
        ["name", "x"],
        ["domain", "NotADomain"],
        ["studyYear", "9"],
        ["eqf", "9"], // EQF only runs 1–8
      ]),
    );
    expect(input?.domain).toBeUndefined();
    expect(input?.studyYear).toBeUndefined();
    expect(input?.eqf).toBeUndefined();
  });

  it("accepts the full EQF ladder 1–8 (the whole education ladder, not just hbo)", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { input } = parseContextForm(
        fd([
          ["name", "x"],
          ["eqf", String(n)],
        ]),
      );
      expect(input?.eqf, `EQF ${n}`).toBe(n);
    }
  });

  it("rejects EQF 0 and non-integers", () => {
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["eqf", "0"],
        ]),
      ).input?.eqf,
    ).toBeUndefined();
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["eqf", "6.5"],
        ]),
      ).input?.eqf,
    ).toBeUndefined();
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["eqf", "abc"],
        ]),
      ).input?.eqf,
    ).toBeUndefined();
  });

  it("keeps only registry-valid pack values for the selected domain", () => {
    const { input } = parseContextForm(
      fd([
        ["name", "x"],
        ["domain", "ICT"],
        [`${PACK_PREFIX}architectuurlagen`, "Software"],
        [`${PACK_PREFIX}architectuurlagen`, "Infrastructuur"],
        [`${PACK_PREFIX}architectuurlagen`, "Bogus"], // not a real option → dropped
        [`${PACK_PREFIX}beheersingsniveau`, "2"],
        [`${PACK_PREFIX}unknownField`, "ignored"], // not in the ICT pack → ignored
      ]),
    );
    expect(input?.packValues?.architectuurlagen).toEqual(["Software", "Infrastructuur"]);
    expect(input?.packValues?.beheersingsniveau).toBe(2);
    expect(input?.packValues?.unknownField).toBeUndefined();
  });

  it("rejects an out-of-range level and an invalid single-select", () => {
    const { input } = parseContextForm(
      fd([
        ["name", "x"],
        ["domain", "Onderwijs"],
        [`${PACK_PREFIX}beheersingsniveau`, "9"], // not even an Onderwijs field
        [`${PACK_PREFIX}typeLerarenopleiding`, "NietBestaand"],
      ]),
    );
    expect(input?.packValues).toBeUndefined();
  });

  it("accepts a valid single-select pack value", () => {
    const { input } = parseContextForm(
      fd([
        ["name", "x"],
        ["domain", "Onderwijs"],
        [`${PACK_PREFIX}typeLerarenopleiding`, "Pabo"],
      ]),
    );
    expect(input?.packValues?.typeLerarenopleiding).toBe("Pabo");
  });

  it("ignores pack values when the domain has no pack", () => {
    const { input } = parseContextForm(
      fd([
        ["name", "x"],
        ["domain", "Overig"],
        [`${PACK_PREFIX}whatever`, "v"],
      ]),
    );
    expect(input?.packValues).toBeUndefined();
  });

  it("zips custom fields and drops incomplete rows", () => {
    const f = new FormData();
    f.append("name", "x");
    for (const [l, v] of [
      ["Specialisatie", "Cybersecurity"],
      ["", "weeskind"], // no label → dropped
      ["Zonder waarde", ""], // no value → dropped
    ]) {
      f.append("customLabel", l);
      f.append("customValue", v);
    }
    const { input } = parseContextForm(f);
    expect(input?.customFields).toEqual([{ label: "Specialisatie", value: "Cybersecurity" }]);
  });

  it("caps custom field count and value length", () => {
    const f = new FormData();
    f.append("name", "x");
    for (let i = 0; i < MAX_CUSTOM_FIELDS + 10; i++) {
      f.append("customLabel", `L${i}`);
      f.append("customValue", "v".repeat(MAX_CUSTOM_VALUE + 50));
    }
    const { input } = parseContextForm(f);
    expect(input?.customFields?.length).toBe(MAX_CUSTOM_FIELDS);
    expect(input?.customFields?.[0]?.value.length).toBe(MAX_CUSTOM_VALUE);
  });

  it("reads the make-default flag", () => {
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["isDefault", "on"],
        ]),
      ).isDefault,
    ).toBe(true);
    expect(parseContextForm(fd([["name", "x"]])).isDefault).toBe(false);
  });
});

describe("parseContextForm — Phase 8 teaching-context axes", () => {
  it("stores validated country / sector / track / nationalLevel", () => {
    const { input } = parseContextForm(
      fd([
        ["name", "x"],
        ["country", "NL"],
        ["sector", "hbo"],
        ["track", "bachelor"],
        ["nationalLevel", "6"],
      ]),
    );
    expect(input?.country).toBe("NL");
    expect(input?.sector).toBe("hbo");
    expect(input?.track).toBe("bachelor");
    expect(input?.nationalLevel).toBe("6");
  });

  it("accepts the Instroom + 4+ national levels, dropping junk", () => {
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["sector", "vo"],
          ["nationalLevel", "instroom"],
        ]),
      ).input?.nationalLevel,
    ).toBe("instroom");
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["sector", "vo"],
          ["nationalLevel", "4+"],
        ]),
      ).input?.nationalLevel,
    ).toBe("4+");
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["nationalLevel", "9"],
        ]),
      ).input?.nationalLevel,
    ).toBeUndefined();
  });

  it("drops a track that doesn't belong to the sector", () => {
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["sector", "vo"],
          ["track", "bachelor"],
        ]),
      ).input?.track,
    ).toBeUndefined();
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["sector", "vo"],
          ["track", "havo"],
        ]),
      ).input?.track,
    ).toBe("havo");
  });

  it("gates the domain by the sector's catalogue", () => {
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["sector", "vo"],
          ["domain", "zw"],
        ]),
      ).input?.domain,
    ).toBe("zw");
    // 'zw' is a vo slug, not an hbo domain → dropped for hbo.
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["sector", "hbo"],
          ["domain", "zw"],
        ]),
      ).input?.domain,
    ).toBeUndefined();
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["sector", "hbo"],
          ["domain", "ICT"],
        ]),
      ).input?.domain,
    ).toBe("ICT");
  });

  it("stores an mbo learner-noun override and drops it for other sectors", () => {
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["sector", "mbo"],
          ["learnerNounOverride", "deelnemers"],
        ]),
      ).input?.learnerNounOverride,
    ).toBe("deelnemers");
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["sector", "hbo"],
          ["learnerNounOverride", "deelnemers"],
        ]),
      ).input?.learnerNounOverride,
    ).toBeUndefined();
  });

  it("stores pedagogy, capped in length", () => {
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["pedagogy", "Montessori"],
        ]),
      ).input?.pedagogy,
    ).toBe("Montessori");
    const long = parseContextForm(
      fd([
        ["name", "x"],
        ["pedagogy", "z".repeat(MAX_PEDAGOGY + 50)],
      ]),
    ).input?.pedagogy;
    expect(long?.length).toBe(MAX_PEDAGOGY);
  });

  it("no longer requires eqf — the level comes from nationalLevel", () => {
    const { input } = parseContextForm(
      fd([
        ["name", "x"],
        ["sector", "hbo"],
        ["nationalLevel", "7"],
      ]),
    );
    expect(input?.eqf).toBeUndefined();
    expect(input?.nationalLevel).toBe("7");
  });

  it("refuses a country/sector outside the caller's available set", () => {
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["sector", "wo"],
        ]),
        { availableSectors: ["hbo"] },
      ).error,
    ).toBe("sector-not-available");
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["country", "NL"],
        ]),
        { availableCountries: ["XX"] },
      ).error,
    ).toBe("country-not-available");
    expect(
      parseContextForm(
        fd([
          ["name", "x"],
          ["sector", "hbo"],
        ]),
        { availableSectors: ["hbo", "wo"] },
      ).error,
    ).toBeUndefined();
  });
});
