import { describe, it, expect } from "vitest";
import { resolveLevel } from "~/lib/context/derive";

describe("resolveLevel — prefer national level, fall back to EQF", () => {
  it("derives EQF from a stored NLQF national level", () => {
    expect(resolveLevel({ nationalLevel: "6" })?.eqf).toBe(6);
    expect(resolveLevel({ nationalLevel: "2" })?.eqf).toBe(2);
  });

  it("carries the entry-level flag for the Instroomniveau", () => {
    expect(resolveLevel({ nationalLevel: "instroom" })).toEqual({ eqf: 1, entryLevel: true });
  });

  it("maps the 4+ rung to EQF 4", () => {
    expect(resolveLevel({ nationalLevel: "4+" })?.eqf).toBe(4);
  });

  // The cohort synthetic profile is EQF-native ({ eqf: cohort.contextEqf }); it
  // must keep resolving through the fallback so api.stream stays unchanged.
  it("COHORT INVARIANT: resolves a bare { eqf } profile straight through", () => {
    expect(resolveLevel({ eqf: 5 })).toEqual({ eqf: 5, entryLevel: false });
  });

  it("prefers nationalLevel over a legacy eqf when both are present", () => {
    expect(resolveLevel({ nationalLevel: "7", eqf: 3 })?.eqf).toBe(7);
  });

  it("returns undefined when no level is set", () => {
    expect(resolveLevel({})).toBeUndefined();
  });
});
