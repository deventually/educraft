import { describe, expect, it } from "vitest";
import * as edit from "~/lib/portfolio/edit";
import { DossierDataSchema } from "~/lib/portfolio/schema";
import { C1, C2, CH, EV, LU, sampleDossier } from "./fixtures";

const valid = (d: unknown) => DossierDataSchema.safeParse(d).success;

describe("portfolio edits", () => {
  it("never mutates the input", () => {
    const d = sampleDossier();
    const snapshot = JSON.stringify(d);
    edit.addOutcome(d, { code: "LU2", title: "Begeleiden" });
    edit.addCriterion(d, LU, { text: "Nieuw" });
    edit.removeCriterion(d, C1);
    edit.setStatus(d, C2, "in-progress");
    edit.addEvidence(d, { title: "Les", kind: "lesson-plan", text: "t", criterionIds: [C2] });
    edit.updateChapter(d, CH, "nieuwe tekst");
    edit.confirmFramework(d, 123);
    expect(JSON.stringify(d)).toBe(snapshot);
  });

  it("adds an outcome and a criterion with fresh ids", () => {
    const a = edit.addOutcome(sampleDossier(), { code: "LU2", title: "Begeleiden" });
    const lu2 = a.framework.outcomes[1];
    expect(lu2!.code).toBe("LU2");
    expect(lu2!.criteria).toEqual([]);
    const b = edit.addCriterion(a, lu2!.id, { text: "Je begeleidt een groep." });
    expect(b.framework.outcomes[1]!.criteria).toHaveLength(1);
    expect(b.framework.outcomes[1]!.criteria[0]!.id).toMatch(/[0-9a-f-]{36}/);
    expect(valid(b)).toBe(true);
  });

  it("updates a criterion's text and strong level", () => {
    const d = edit.updateCriterion(sampleDossier(), C1, { text: "Anders", strongLevel: "Goed" });
    expect(d.framework.outcomes[0]!.criteria[0]).toMatchObject({
      text: "Anders",
      strongLevel: "Goed",
    });
  });

  it("removing a criterion also drops its status and evidence links", () => {
    const d = edit.removeCriterion(sampleDossier(), C1);
    expect(d.framework.outcomes[0]!.criteria.map((c) => c.id)).toEqual([C2]);
    expect(d.status[C1]).toBeUndefined();
    expect(d.evidence[0]!.criterionIds).toEqual([]);
    expect(valid(d)).toBe(true);
  });

  it("removing an outcome drops its criteria, statuses, links and chapters", () => {
    const d = edit.removeOutcome(sampleDossier(), LU);
    expect(d.framework.outcomes).toEqual([]);
    expect(d.status).toEqual({});
    expect(d.evidence[0]!.criterionIds).toEqual([]);
    expect(d.chapters).toEqual([]);
    expect(valid(d)).toBe(true);
  });

  it("sets and clears a status", () => {
    const d = edit.setStatus(sampleDossier(), C2, "in-progress");
    expect(d.status[C2]).toBe("in-progress");
    expect(edit.setStatus(d, C2, "not-started").status[C2]).toBeUndefined();
  });

  it("refuses a status or link for an unknown criterion", () => {
    expect(() => edit.setStatus(sampleDossier(), "nope", "shown")).toThrow();
    expect(() =>
      edit.addEvidence(sampleDossier(), {
        title: "x",
        kind: "other",
        text: "",
        criterionIds: ["nope"],
      }),
    ).toThrow();
  });

  it("adds, updates, links and removes evidence", () => {
    const a = edit.addEvidence(sampleDossier(), {
      title: "Lesplan",
      kind: "lesson-plan",
      text: "Doelen …",
      criterionIds: [C2],
    });
    const id = a.evidence[1]!.id;
    const b = edit.updateEvidence(a, id, { title: "Lesplan v2", criterionIds: [C1, C2] });
    expect(b.evidence[1]).toMatchObject({ title: "Lesplan v2", criterionIds: [C1, C2] });
    const c = edit.removeEvidence(b, EV);
    expect(c.evidence.map((e) => e.id)).toEqual([id]);
    expect(valid(c)).toBe(true);
  });

  it("creates a chapter per outcome on first write and updates it after", () => {
    const base = edit.removeOutcome(sampleDossier(), LU);
    const withLu = edit.addOutcome(base, { code: "LU1", title: "Doceren" });
    const luId = withLu.framework.outcomes[0]!.id;
    const a = edit.writeChapter(withLu, luId, "Eerste versie");
    expect(a.chapters).toHaveLength(1);
    const b = edit.writeChapter(a, luId, "Tweede versie");
    expect(b.chapters).toHaveLength(1);
    expect(b.chapters[0]!.text).toBe("Tweede versie");
  });

  it("adds and removes references", () => {
    const a = edit.addReference(sampleDossier(), "Biggs, J. (2003). Aligning teaching.");
    expect(a.references).toHaveLength(1);
    expect(edit.removeReference(a, a.references[0]!.id).references).toEqual([]);
  });

  it("confirms the framework and changing it afterwards un-confirms it", () => {
    const a = edit.confirmFramework(sampleDossier(), 1000);
    expect(a.framework.confirmedAt).toBe(1000);
    expect(edit.addCriterion(a, LU, { text: "extra" }).framework.confirmedAt).toBeUndefined();
    expect(edit.updateCriterion(a, C1, { text: "x" }).framework.confirmedAt).toBeUndefined();
    // Evidence and writing do not touch the framework.
    expect(edit.writeChapter(a, LU, "x").framework.confirmedAt).toBe(1000);
  });
});
