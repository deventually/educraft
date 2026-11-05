import { describe, expect, it } from "vitest";
import { DOSSIER_STEPS, dossierStep } from "~/lib/portfolio/step";
import { C1, C2, sampleDossier } from "./fixtures";

/** The sample dossier with a confirmed framework. */
function confirmed() {
  const d = sampleDossier();
  d.framework.confirmedAt = 1;
  return d;
}

describe("dossierStep", () => {
  it("lists the five steps of the route in order", () => {
    expect(DOSSIER_STEPS).toEqual(["framework", "collect", "fill", "write", "finish"]);
  });

  it("starts at the framework until it has criteria and is confirmed", () => {
    const empty = sampleDossier();
    empty.framework.outcomes = [];
    expect(dossierStep(empty)).toBe("framework");
    expect(dossierStep(sampleDossier())).toBe("framework");
  });

  it("collects earlier work while the dossier has no evidence yet", () => {
    const d = confirmed();
    d.evidence = [];
    expect(dossierStep(d)).toBe("collect");
  });

  it("fills the gaps while a criterion still has no evidence", () => {
    expect(dossierStep(confirmed())).toBe("fill");
  });

  it("writes the chapters once every criterion has evidence", () => {
    const d = confirmed();
    d.evidence[0].criterionIds = [C1, C2];
    d.chapters = [];
    expect(dossierStep(d)).toBe("write");
  });

  it("finishes once the chapters are written", () => {
    const d = confirmed();
    d.evidence[0].criterionIds = [C1, C2];
    expect(dossierStep(d)).toBe("finish");
    d.status[C2] = "shown";
    expect(dossierStep(d)).toBe("finish");
  });
});
