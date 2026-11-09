import { describe, expect, it } from "vitest";
import * as edit from "~/lib/portfolio/edit";
import {
  nextStep,
  outcomeProgress,
  requirementFindings,
  wordCount,
} from "~/lib/portfolio/progress";
import { C1, C2, LU, sampleDossier } from "./fixtures";

describe("wordCount", () => {
  it("counts words and ignores markdown symbols", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("## Kop\n\n- een **twee** drie")).toBe(4);
    expect(wordCount("leer-uitkomst 3 en www.x.nl")).toBe(4);
  });
});

describe("outcomeProgress", () => {
  it("counts shown criteria and the required evidence that has no matching item", () => {
    const [p] = outcomeProgress(sampleDossier());
    expect(p!.outcomeId).toBe(LU);
    expect(p!.criteria).toBe(2);
    expect(p!.shown).toBe(1);
    // "Feedback van de werkplekbegeleider" is covered by the feedback item; the recording is not.
    expect(p!.missingEvidence).toEqual(["Opname van de les"]);
    expect(p!.words).toBe(6);
  });
});

describe("requirementFindings", () => {
  it("is empty for a tidy dossier", () => {
    const d = edit.setStatus(sampleDossier(), C2, "shown");
    const linked = edit.updateEvidence(d, d.evidence[0]!.id, { criterionIds: [C1, C2] });
    expect(requirementFindings(linked)).toEqual([]);
  });

  it("flags a criterion without evidence", () => {
    expect(requirementFindings(sampleDossier())).toEqual([
      { code: "criterion-without-evidence", outcomeId: LU, criterionId: C2 },
    ]);
  });

  it("flags going over the word limit", () => {
    const d = edit.writeChapter(sampleDossier(), LU, "woord ".repeat(101));
    expect(requirementFindings(d)).toContainEqual({
      code: "over-word-limit",
      words: 101,
      limit: 100,
    });
  });

  it("flags a framework that is not confirmed only once there are criteria", () => {
    const d = sampleDossier();
    expect(d.framework.confirmedAt).toBeUndefined();
    expect(nextStep(d)).toEqual({ step: "confirm-framework" });
  });
});

describe("nextStep", () => {
  it("walks framework → evidence → chapter → review", () => {
    const empty = edit.removeOutcome(sampleDossier(), LU);
    expect(nextStep(empty)).toEqual({ step: "build-framework" });

    const confirmed = edit.confirmFramework(sampleDossier(), 1);
    expect(nextStep(confirmed)).toEqual({ step: "add-evidence", outcomeId: LU, criterionId: C2 });

    const linked = edit.updateEvidence(confirmed, confirmed.evidence[0]!.id, {
      criterionIds: [C1, C2],
    });
    const noChapter = { ...linked, chapters: [] };
    expect(nextStep(noChapter)).toEqual({ step: "write-chapter", outcomeId: LU });

    expect(nextStep(linked)).toEqual({ step: "mark-shown", outcomeId: LU, criterionId: C2 });

    const done = edit.setStatus(linked, C2, "shown");
    expect(nextStep(done)).toEqual({ step: "done" });
  });
});
