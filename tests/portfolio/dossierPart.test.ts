import { describe, expect, it } from "vitest";
import { dossierPart } from "~/lib/portfolio/dossierPart";
import { DossierDataSchema } from "~/lib/portfolio/schema";
import type { DossierData } from "~/lib/portfolio/types";
import { C1, C2, CH, EV, LU, sampleDossier } from "./fixtures";

const LU2 = "00000000-0000-4000-8000-000000000002";
const C3 = "00000000-0000-4000-8000-0000000000c3";

/** Two outcomes, each with its own chapter, evidence and a cited reference. */
function twoOutcomes(): DossierData {
  const d = sampleDossier();
  d.framework.outcomes.push({
    id: LU2,
    code: "LU2",
    title: "Toetsen",
    criteria: [{ id: C3, text: "De toets is valide." }],
    requiredEvidence: [],
  });
  d.status[C3] = "shown";
  d.evidence.push(
    {
      id: "ev-2",
      title: "Toetsmatrijs",
      kind: "test-material",
      text: "Matrijs.",
      criterionIds: [C3],
    },
    { id: "ev-both", title: "Feedback", kind: "feedback", text: "Goed.", criterionIds: [C2, C3] },
    { id: "ev-loose", title: "Los", kind: "other", text: "Niet gekoppeld.", criterionIds: [] },
  );
  d.chapters = [
    { id: CH, outcomeId: LU, text: "Ik volgde Rosenshine (2012).", aiDrafted: false },
    { id: "ch-2", outcomeId: LU2, text: "Zie (Biggs & Tang, 2011).", aiDrafted: false },
  ];
  d.references = [
    { id: "r1", apa: "Rosenshine, B. (2012). Principles of instruction." },
    { id: "r2", apa: "Biggs, J., & Tang, C. (2011). Teaching for quality learning." },
    { id: "r3", apa: "Onleesbare bron zonder jaartal" },
  ];
  return d;
}

describe("dossierPart", () => {
  it("keeps one outcome with its chapter, status and the evidence linked to it", () => {
    const part = dossierPart(twoOutcomes(), LU2);
    expect(part).not.toBeNull();
    if (!part) return;
    expect(part.framework.outcomes.map((o) => o.code)).toEqual(["LU2"]);
    expect(part.chapters.map((c) => c.outcomeId)).toEqual([LU2]);
    expect(part.status).toEqual({ [C3]: "shown" });
    // Shared evidence comes along, linked only to this outcome's criteria; loose evidence does not.
    expect(part.evidence.map((e) => [e.id, e.criterionIds])).toEqual([
      ["ev-2", [C3]],
      ["ev-both", [C3]],
    ]);
    expect(DossierDataSchema.safeParse(part).success).toBe(true);
  });

  it("keeps only the references the chapter cites, and any it cannot read", () => {
    const one = dossierPart(twoOutcomes(), LU);
    expect(one?.references.map((r) => r.id)).toEqual(["r1", "r3"]);
    const two = dossierPart(twoOutcomes(), LU2);
    expect(two?.references.map((r) => r.id)).toEqual(["r2", "r3"]);
  });

  it("keeps the framework's requirements and the rest of the dossier settings", () => {
    const part = dossierPart(twoOutcomes(), LU);
    expect(part?.framework.institution).toBe("Hogeschool X");
    expect(part?.framework.requirements).toEqual({ maxWords: 100 });
    expect(part?.evidence.map((e) => e.id)).toEqual([EV, "ev-both"]);
    expect(part?.evidence.find((e) => e.id === EV)?.criterionIds).toEqual([C1]);
  });

  it("keeps only the AI use for this outcome, for its disclosure", () => {
    const d = twoOutcomes();
    d.aiLog = [
      { at: 1, action: "review", outcomeId: LU, model: "m" },
      { at: 2, action: "draft", outcomeId: LU2, model: "m" },
      { at: 3, action: "rehearsal", model: "m" },
    ];
    expect(dossierPart(d, LU2)?.aiLog.map((l) => l.at)).toEqual([2, 3]);
  });

  it("is null for an outcome the dossier does not have", () => {
    expect(dossierPart(twoOutcomes(), "nope")).toBeNull();
  });
});
