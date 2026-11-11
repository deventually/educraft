import { describe, expect, it } from "vitest";
import * as edit from "~/lib/portfolio/edit";
import { dossierRoute, outcomeRoute } from "~/lib/portfolio/route";
import type { DossierData } from "~/lib/portfolio/types";
import { C1, C2, LU, sampleDossier } from "./fixtures";

/** The sample dossier with a confirmed framework: C1 has evidence and is shown, C2 has neither. */
const confirmed = () => edit.confirmFramework(sampleDossier(), 1);
const linkBoth = (d: DossierData) =>
  edit.updateEvidence(d, d.evidence[0]!.id, { criterionIds: [C1, C2] });

describe("outcomeRoute", () => {
  it("walks evidence → chapter → review → shown, one milestone at a time", () => {
    const r = outcomeRoute(confirmed(), LU)!;
    expect(r.milestones.map((m) => m.id)).toEqual(["evidence", "chapter", "review", "shown"]);
    expect(r.milestones[0]).toMatchObject({ complete: false, done: 1, total: 2, criterionId: C2 });
    expect(r.milestones[1]).toMatchObject({ complete: true, done: 1, total: 1 });
    expect(r.next?.id).toBe("evidence");
    expect(r.complete).toBe(false);
  });

  it("asks for the chapter once every criterion has evidence", () => {
    const r = outcomeRoute({ ...linkBoth(confirmed()), chapters: [] }, LU)!;
    expect(r.milestones[0]!.complete).toBe(true);
    expect(r.next?.id).toBe("chapter");
  });

  it("counts the coach's verdicts and the teacher's own marks towards the review", () => {
    const d = linkBoth(confirmed());
    expect(outcomeRoute(d, LU)!.next).toMatchObject({ id: "review", done: 1, total: 2 });
    d.reviews = {
      [LU]: {
        at: 1,
        model: "m",
        review: {
          overall: "",
          criteria: [{ criterionId: C2, verdict: "shown", strengthen: [], evidenceNeeded: [] }],
        },
      },
    };
    // The coach says C2 is shown; only the teacher can mark it, so that is what is left.
    expect(outcomeRoute(d, LU)!.next).toMatchObject({ id: "shown", done: 1, total: 2 });
  });

  it("is complete once the teacher marks every criterion shown, without the coach", () => {
    const r = outcomeRoute(edit.setStatus(linkBoth(confirmed()), C2, "shown"), LU)!;
    expect(r.milestones.every((m) => m.complete)).toBe(true);
    expect(r.complete).toBe(true);
    expect(r.next).toBeNull();
  });

  it("is null for an unknown outcome", () => {
    expect(outcomeRoute(confirmed(), "nope")).toBeNull();
  });
});

describe("dossierRoute", () => {
  it("is the framework, then each learning outcome, then finishing", () => {
    const r = dossierRoute(confirmed());
    expect(r.steps.map((s) => s.id)).toEqual(["framework", LU, "finish"]);
    expect(r.steps.map((s) => s.kind)).toEqual(["framework", "outcome", "finish"]);
    expect(r.total).toBe(3);
    expect(r.complete).toBe(1);
  });

  it("starts at the framework until it has criteria and is confirmed", () => {
    expect(dossierRoute(sampleDossier()).next?.id).toBe("framework");
    const empty = edit.removeOutcome(confirmed(), LU);
    expect(dossierRoute(empty).steps.map((s) => s.id)).toEqual(["framework", "finish"]);
    expect(dossierRoute(empty).next?.id).toBe("framework");
  });

  it("points to the first outcome that is not done, with its own next milestone", () => {
    const next = dossierRoute(confirmed()).next!;
    expect(next).toMatchObject({ id: LU, kind: "outcome", outcomeId: LU });
    expect(next.milestone).toMatchObject({ id: "evidence", criterionId: C2 });
    expect(dossierRoute(confirmed()).steps[1]).toMatchObject({ done: 1, total: 4 });
  });

  it("skips an outcome that is done and goes on to the next", () => {
    const d = linkBoth(confirmed());
    const LU2 = "00000000-0000-4000-8000-000000000002";
    d.framework.outcomes.push({
      id: LU2,
      code: "LU2",
      title: "Begeleiden",
      criteria: [{ id: "00000000-0000-4000-8000-0000000000c3", text: "Je begeleidt." }],
      requiredEvidence: [],
    });
    const done = edit.setStatus(d, C2, "shown");
    expect(dossierRoute(done).next).toMatchObject({ id: LU2, kind: "outcome" });
  });

  it("ends with finishing until nothing blocks handing in", () => {
    const d = edit.setStatus(linkBoth(confirmed()), C2, "shown");
    const r = dossierRoute(d);
    expect(r.next).toMatchObject({ id: "finish", kind: "finish" });
    expect(r.next!.total).toBeGreaterThan(0);
  });
});
