import type { DossierData } from "~/lib/portfolio/types";

export const LU = "00000000-0000-4000-8000-000000000001";
export const C1 = "00000000-0000-4000-8000-0000000000c1";
export const C2 = "00000000-0000-4000-8000-0000000000c2";
export const EV = "00000000-0000-4000-8000-0000000000e1";
export const CH = "00000000-0000-4000-8000-0000000000a1";

/** A small, valid BDB dossier with one outcome, two criteria, one evidence item and one chapter. */
export function sampleDossier(): DossierData {
  return {
    tracks: ["bdb"],
    framework: {
      institution: "Hogeschool X",
      year: "2025-2026",
      outcomes: [
        {
          id: LU,
          code: "LU1",
          title: "Doceren",
          criteria: [
            {
              id: C1,
              text: "De les heeft een heldere structuur met inleiding, kern en afsluiting.",
            },
            {
              id: C2,
              text: "De les sluit aan bij de beginsituatie.",
              strongLevel: "Ook per student.",
            },
          ],
          requiredEvidence: ["Feedback van de werkplekbegeleider", "Opname van de les"],
        },
      ],
      requirements: { maxWords: 100 },
    },
    status: { [C1]: "shown" },
    evidence: [
      {
        id: EV,
        title: "Feedback werkplekbegeleider",
        kind: "feedback",
        text: "Goede opbouw.",
        criterionIds: [C1],
      },
    ],
    chapters: [{ id: CH, outcomeId: LU, text: "Mijn les begon met een vraag.", aiDrafted: false }],
    references: [],
    coachMode: "coach",
    aiLog: [],
  };
}
