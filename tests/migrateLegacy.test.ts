import { describe, it, expect } from "vitest";
import { migrateLegacyProfile } from "~/lib/context/migrate";

describe("migrateLegacyProfile — Phase 8 read-time backfill", () => {
  it("backfills country=NL and sector=hbo when absent (the legacy shape was hbo)", () => {
    const out = migrateLegacyProfile({ name: "Old", eqf: 6 });
    expect(out.country).toBe("NL");
    expect(out.sector).toBe("hbo");
  });

  it("backfills nationalLevel from a legacy eqf, keeping eqf", () => {
    const out = migrateLegacyProfile({ eqf: 6 });
    expect(out.nationalLevel).toBe("6");
    expect(out.eqf).toBe(6); // eqf is retained (cohort/fallback path)
  });

  it("does NOT invent a level when there is no eqf (never fabricate 'instroom')", () => {
    const out = migrateLegacyProfile({ programme: "X" });
    expect(out.nationalLevel).toBeUndefined();
  });

  it("does not overwrite an already-set country / sector / nationalLevel", () => {
    const out = migrateLegacyProfile({ country: "NL", sector: "vo", nationalLevel: "4", eqf: 6 });
    expect(out.sector).toBe("vo");
    expect(out.nationalLevel).toBe("4");
  });

  it("backfills phase=bovenbouw for a legacy vo profile that carries a profiel (Phase 11)", () => {
    // A stored vo profiel only exists in the tweede fase, so its stage is bovenbouw.
    // Backfilling it keeps the fase field + profiel gating coherent on read + re-save.
    const out = migrateLegacyProfile({ sector: "vo", track: "havo", domain: "nederlands" });
    expect(out.phase).toBe("bovenbouw");
  });

  it("does not add a phase to a vo profile with no profiel, or overwrite an existing one", () => {
    expect(migrateLegacyProfile({ sector: "vo", track: "havo" }).phase).toBeUndefined();
    expect(migrateLegacyProfile({ sector: "vo", domain: "nt", phase: "onderbouw" }).phase).toBe(
      "onderbouw",
    );
  });

  it("never adds a phase to a non-vo profile (studiejaar sector)", () => {
    expect(migrateLegacyProfile({ sector: "hbo", domain: "ICT" }).phase).toBeUndefined();
  });

  it("is idempotent", () => {
    const once = migrateLegacyProfile({ eqf: 7 });
    const twice = migrateLegacyProfile(once);
    expect(twice).toEqual(once);
  });

  it("still migrates the legacy hbo-i pack fields into packValues", () => {
    const out = migrateLegacyProfile({
      architectureLayers: ["Software"],
      activities: ["Realiseren"],
      hboiLevel: 2,
      eqf: 6,
    });
    expect(out.packValues).toEqual({
      architectuurlagen: ["Software"],
      activiteiten: ["Realiseren"],
      beheersingsniveau: 2,
    });
    // The P8 axes were backfilled in the same pass.
    expect(out.sector).toBe("hbo");
    expect(out.nationalLevel).toBe("6");
    // Legacy keys removed.
    expect(out.architectureLayers).toBeUndefined();
  });
});
