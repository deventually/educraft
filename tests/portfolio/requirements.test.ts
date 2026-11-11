import { describe, expect, it } from "vitest";
import * as edit from "~/lib/portfolio/edit";
import { requirementChecklist, requirementMet } from "~/lib/portfolio/requirements";
import { C1, EV, LU, sampleDossier } from "./fixtures";

const FEEDBACK = "Feedback van de werkplekbegeleider";
const VIDEO = "Opname van de les";

describe("requirementChecklist", () => {
  it("lists every required-evidence line of the outcome, in the form's order", () => {
    const list = requirementChecklist(sampleDossier(), LU);
    expect(list.map((r) => r.line)).toEqual([FEEDBACK, VIDEO]);
  });

  it("guesses an item of a matching kind until the teacher confirms it", () => {
    const [feedback, video] = requirementChecklist(sampleDossier(), LU);
    expect(feedback).toMatchObject({
      linked: [],
      guess: { id: EV, title: "Feedback werkplekbegeleider" },
    });
    expect(requirementMet(feedback!)).toBe(true);
    expect(video).toEqual({ line: VIDEO, linked: [] });
    expect(requirementMet(video!)).toBe(false);
  });

  it("shows the items the teacher linked to a line, and then guesses no more", () => {
    const d = sampleDossier();
    d.evidence[0]!.requirements = [{ outcomeId: LU, line: VIDEO }];
    const [feedback, video] = requirementChecklist(d, LU);
    expect(video).toMatchObject({ linked: [{ id: EV, title: "Feedback werkplekbegeleider" }] });
    expect(video!.guess).toBeUndefined();
    expect(requirementMet(video!)).toBe(true);
    // The same item can still be guessed for another line.
    expect(feedback!.guess?.id).toBe(EV);
  });

  it("never guesses feedback made by a tool: an AI is not your mentor", () => {
    const d = sampleDossier();
    d.evidence[0]!.sourceGenerationId = "00000000-0000-4000-8000-0000000000f1";
    expect(requirementChecklist(d, LU)[0]!.guess).toBeUndefined();
  });

  it("ignores a link to a line the form no longer has, or of another outcome", () => {
    const d = sampleDossier();
    d.evidence[0]!.requirements = [
      { outcomeId: LU, line: "Een oude regel" },
      { outcomeId: "00000000-0000-4000-8000-000000000002", line: VIDEO },
    ];
    expect(requirementChecklist(d, LU)[1]!.linked).toEqual([]);
  });

  it("is empty for an unknown outcome", () => {
    expect(requirementChecklist(sampleDossier(), "nope")).toEqual([]);
  });
});

describe("edit.linkRequirement", () => {
  it("links an item to a line, once, and unlinks it again", () => {
    let d = edit.linkRequirement(sampleDossier(), EV, { outcomeId: LU, line: VIDEO }, true);
    d = edit.linkRequirement(d, EV, { outcomeId: LU, line: VIDEO }, true);
    expect(d.evidence[0]!.requirements).toEqual([{ outcomeId: LU, line: VIDEO }]);
    d = edit.linkRequirement(d, EV, { outcomeId: LU, line: VIDEO }, false);
    expect(d.evidence[0]!.requirements).toEqual([]);
    expect(d.evidence[0]!.criterionIds).toEqual([C1]);
  });

  it("refuses a line the outcome does not ask for, and an unknown item", () => {
    expect(() =>
      edit.linkRequirement(sampleDossier(), EV, { outcomeId: LU, line: "Iets anders" }, true),
    ).toThrow();
    expect(() =>
      edit.linkRequirement(sampleDossier(), "nope", { outcomeId: LU, line: VIDEO }, true),
    ).toThrow(/^Unknown /);
  });
});
