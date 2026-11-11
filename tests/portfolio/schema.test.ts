import { describe, expect, it } from "vitest";
import { DossierDataSchema, emptyDossier, LIMITS } from "~/lib/portfolio/schema";
import { C1, C2, LU, sampleDossier } from "./fixtures";

describe("DossierDataSchema", () => {
  it("parses a valid dossier", () => {
    expect(DossierDataSchema.safeParse(sampleDossier()).success).toBe(true);
  });

  it("parses an empty dossier for every track combination", () => {
    for (const tracks of [["bdb"], ["bke"], ["bdb", "bke"]] as const) {
      const d = emptyDossier([...tracks]);
      expect(DossierDataSchema.safeParse(d).success).toBe(true);
      expect(d.coachMode).toBe("coach");
      expect(d.framework.confirmedAt).toBeUndefined();
    }
  });

  it("accepts evidence from a course snapshot; old evidence without one stays valid (P26.4)", () => {
    const d = sampleDossier();
    expect(d.evidence[0]!.sourceCourse).toBeUndefined();
    d.evidence[0]!.sourceCourse = { courseId: "c1", part: "outcomes-and-matrix", at: 1 };
    expect(DossierDataSchema.safeParse(d).success).toBe(true);
    d.evidence[0]!.sourceCourse = { courseId: "c1", part: { assessmentId: "t1" }, at: 1 };
    expect(DossierDataSchema.safeParse(d).success).toBe(true);
    // biome-ignore lint/suspicious/noExplicitAny: an invalid part on purpose
    (d.evidence[0]!.sourceCourse as any).part = "everything";
    expect(DossierDataSchema.safeParse(d).success).toBe(false);
  });

  it("keeps self-check ticks and a test's question count; an old dossier without them stays valid (P29.1)", () => {
    const d = sampleDossier();
    expect(d.readiness).toBeUndefined();
    expect(DossierDataSchema.safeParse(d).success).toBe(true);
    d.readiness = { ticked: { "no-student-names": 1 } };
    d.evidence[0]!.sourceCourse = {
      courseId: "c1",
      part: { assessmentId: "t1" },
      at: 1,
      itemCount: 12,
    };
    expect(DossierDataSchema.safeParse(d).success).toBe(true);
    d.readiness = { ticked: { "criterion-without-evidence": 1 } };
    expect(DossierDataSchema.safeParse(d).success).toBe(false);
  });

  it("rejects an evidence link to an unknown criterion", () => {
    const d = sampleDossier();
    d.evidence[0]!.criterionIds = ["00000000-0000-4000-8000-00000000dead"];
    expect(DossierDataSchema.safeParse(d).success).toBe(false);
  });

  it("rejects a status for an unknown criterion", () => {
    const d = sampleDossier();
    d.status["00000000-0000-4000-8000-00000000dead"] = "shown";
    expect(DossierDataSchema.safeParse(d).success).toBe(false);
  });

  it("rejects a chapter for an unknown outcome", () => {
    const d = sampleDossier();
    d.chapters[0]!.outcomeId = "00000000-0000-4000-8000-00000000dead";
    expect(DossierDataSchema.safeParse(d).success).toBe(false);
  });

  it("rejects duplicate criterion ids across outcomes", () => {
    const d = sampleDossier();
    d.framework.outcomes.push({
      ...d.framework.outcomes[0]!,
      id: "00000000-0000-4000-8000-000000000002",
      criteria: [{ id: C1, text: "dubbel" }],
    });
    expect(DossierDataSchema.safeParse(d).success).toBe(false);
  });

  it("enforces text and count limits", () => {
    const long = sampleDossier();
    long.framework.outcomes[0]!.criteria[0]!.text = "x".repeat(LIMITS.criterionText + 1);
    expect(DossierDataSchema.safeParse(long).success).toBe(false);

    const many = sampleDossier();
    many.evidence = Array.from({ length: LIMITS.evidence + 1 }, (_, i) => ({
      ...many.evidence[0]!,
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    }));
    expect(DossierDataSchema.safeParse(many).success).toBe(false);

    const doc = sampleDossier();
    doc.chapters[0]!.text = "x".repeat(LIMITS.documentText + 1);
    expect(DossierDataSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects an unknown track or status value", () => {
    const d = sampleDossier() as unknown as Record<string, unknown>;
    expect(DossierDataSchema.safeParse({ ...d, tracks: ["ske"] }).success).toBe(false);
    expect(DossierDataSchema.safeParse({ ...d, status: { [C1]: "done" } }).success).toBe(false);
  });

  it("requires at least one track and keeps outcome ids unique", () => {
    expect(DossierDataSchema.safeParse({ ...sampleDossier(), tracks: [] }).success).toBe(false);
    const d = sampleDossier();
    d.framework.outcomes.push({ ...d.framework.outcomes[0]!, criteria: [] });
    expect(d.framework.outcomes[1]!.id).toBe(LU);
    expect(DossierDataSchema.safeParse(d).success).toBe(false);
  });
});

describe("chapter outline and literature (BDB step 5)", () => {
  it("accepts an outline and literature; an old outcome without them stays valid", () => {
    const d = sampleDossier();
    expect(DossierDataSchema.safeParse(d).success).toBe(true);
    d.framework.outcomes[0]!.outline = [
      { id: "s1", title: "Beginsituatie", description: "Wat de groep kan.", criterionIds: [C2] },
      { id: "s2", title: "Reflectie", criterionIds: [], unverified: true },
    ];
    d.framework.outcomes[0]!.literature = ["Ebbens, S. (2016). Effectief leren."];
    expect(DossierDataSchema.safeParse(d).success).toBe(true);
  });

  it("rejects a section that covers a criterion of another outcome, or an unknown one", () => {
    const d = sampleDossier();
    d.framework.outcomes.push({
      id: "lu2",
      code: "LU2",
      title: "Toetsen",
      criteria: [{ id: "c-lu2", text: "Toets." }],
      requiredEvidence: [],
    });
    d.framework.outcomes[0]!.outline = [{ id: "s1", title: "Toets", criterionIds: ["c-lu2"] }];
    expect(DossierDataSchema.safeParse(d).success).toBe(false);
    d.framework.outcomes[0]!.outline = [{ id: "s1", title: "Toets", criterionIds: ["nope"] }];
    expect(DossierDataSchema.safeParse(d).success).toBe(false);
  });

  it("rejects duplicate section ids and outlines over the limit", () => {
    const d = sampleDossier();
    d.framework.outcomes[0]!.outline = [
      { id: "s1", title: "A", criterionIds: [] },
      { id: "s1", title: "B", criterionIds: [] },
    ];
    expect(DossierDataSchema.safeParse(d).success).toBe(false);
    d.framework.outcomes[0]!.outline = Array.from(
      { length: LIMITS.outlineSections + 1 },
      (_, i) => ({
        id: `s${i}`,
        title: "A",
        criterionIds: [],
      }),
    );
    expect(DossierDataSchema.safeParse(d).success).toBe(false);
  });
});
