import { describe, expect, it } from "vitest";
import { suggestEvidence } from "~/lib/portfolio/suggest";
import type { DossierData } from "~/lib/portfolio/types";
import { C1, C2, sampleDossier } from "./fixtures";

const G1 = "00000000-0000-4000-8000-0000000000f1";
const G2 = "00000000-0000-4000-8000-0000000000f2";
const G3 = "00000000-0000-4000-8000-0000000000f3";

/** C1 is about lesson structure, C2 about assessment. */
function dossier(): DossierData {
  const d = sampleDossier();
  d.framework.outcomes[0]!.criteria[0]!.text = "Je maakt een lesontwerp met heldere leerdoelen.";
  d.framework.outcomes[0]!.criteria[1]!.text = "Je stelt een toets samen met een passende rubric.";
  d.evidence = [];
  return d;
}

const gen = (id: string, toolSlug: string, at: number) => ({
  id,
  toolSlug,
  createdAt: new Date(at),
});

describe("suggestEvidence", () => {
  it("suggests earlier work whose tool fits the criterion, newest first", () => {
    const s = suggestEvidence(dossier(), [
      gen(G1, "lesson-plan", 1000),
      gen(G2, "guided-reflection", 2000),
      gen(G3, "test-items", 3000),
    ]);
    expect(s[C1]!.map((x) => x.generationId)).toEqual([G2, G1]);
    expect(s[C2]!.map((x) => x.generationId)).toEqual([G3]);
  });

  it("leaves out criteria without a fitting generation", () => {
    const s = suggestEvidence(dossier(), [gen(G1, "socratic-partner", 1000)]);
    expect(s).toEqual({});
  });

  it("never suggests work that is already evidence for that criterion", () => {
    const d = dossier();
    d.evidence = [
      {
        id: G3,
        title: "Les",
        kind: "other",
        text: "x",
        criterionIds: [C1],
        sourceGenerationId: G1,
      },
    ];
    const s = suggestEvidence(d, [gen(G1, "lesson-plan", 1000)]);
    expect(s[C1]).toBeUndefined();
  });

  it("caps each criterion at five suggestions", () => {
    const gens = Array.from({ length: 8 }, (_, i) =>
      gen(`00000000-0000-4000-8000-00000000010${i}`, "lesson-plan", i),
    );
    expect(suggestEvidence(dossier(), gens)[C1]).toHaveLength(5);
  });

  it("carries the courses a generation is linked to", () => {
    const s = suggestEvidence(dossier(), [gen(G1, "lesson-plan", 1000)], {
      [G1]: [{ courseName: "Statistiek 1" }],
    });
    expect(s[C1]![0]).toMatchObject({ toolSlug: "lesson-plan", courses: ["Statistiek 1"] });
  });
});
