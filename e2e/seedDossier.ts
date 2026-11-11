/**
 * A BDB dossier for the admin (who always has the dossier), so the browser tests can open a
 * chapter tab with guided writing (BDB/BKE plan, step 6): a confirmed framework with the form's
 * outline, and questions on the first section, one answered. No AI call is needed for it.
 */
import { emptyDossier } from "../app/lib/portfolio/schema";
import type { DossierData } from "../app/lib/portfolio/types";

export const E2E_DOSSIER = "BDB (e2e)";

export function guidedDossier(): DossierData {
  const lu = "e2e-lu1";
  const [c1, c2] = ["e2e-c1", "e2e-c2"];
  return {
    ...emptyDossier(["bdb"]),
    coachMode: "draft",
    draftNoticeSeenAt: 1,
    framework: {
      institution: "Hogeschool (e2e)",
      requirements: {},
      confirmedAt: 1,
      outcomes: [
        {
          id: lu,
          code: "LU1",
          title: "Doceren",
          criteria: [
            { id: c1, text: "De docent beschrijft de beginsituatie van de groep." },
            { id: c2, text: "De les heeft een heldere opbouw." },
          ],
          requiredEvidence: [],
          outline: [
            {
              id: "e2e-s1",
              title: "Beginsituatie",
              description: "Beschrijf de groep en wat die al kan.",
              criterionIds: [c1],
            },
            { id: "e2e-s2", title: "Opbouw van de les", criterionIds: [c2] },
          ],
        },
      ],
    },
    guided: {
      [lu]: {
        "e2e-s1": {
          questions: ["Welke groep had je, en wat konden ze al?", "Hoe bracht je dat in kaart?"],
          answers: ["Een tweedejaars klas.", ""],
          at: 1,
          model: "e2e",
        },
      },
    },
  };
}
