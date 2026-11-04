import { describe, it, expect } from "vitest";
import {
  applyExtraction,
  buildExtractMessage,
  EXTRACT_INPUT_LIMIT,
  frameworkInUse,
  parseExtraction,
} from "~/lib/portfolio/extract";
import * as edit from "~/lib/portfolio/edit";
import { DossierDataSchema, emptyDossier, LIMITS } from "~/lib/portfolio/schema";
import { C1, sampleDossier } from "./fixtures";

// A synthetic form (no institution material): line breaks and a hyphenated
// word split over two lines, as PDF text comes out.
const FORM = `Beoordelingsformulier BDB — Hogeschool Voorbeeld, 2026-2027

Leeruitkomst 1 Doceren
1. De docent geeft een les met een heldere opbouw van inleiding,
kern en afsluiting.
   Goed: de opbouw is afgestemd op de doelen van de les.
2. De docent sluit aan bij de begin-
situatie van de groep.
Verplicht bewijs: lesvoorbereiding; feedback van de werkplekbegeleider.

Leeruitkomst 2 Toetsen
1. De docent maakt een toets die past bij de leerdoelen.

Het verslag telt maximaal 6000 woorden.`;

const good = {
  institution: "Hogeschool Voorbeeld",
  year: "2026-2027",
  outcomes: [
    {
      code: "LU1",
      title: "Doceren",
      criteria: [
        {
          text: "De docent geeft een les met een heldere opbouw van inleiding, kern en afsluiting.",
          strongLevel: "de opbouw is afgestemd op de doelen van de les.",
        },
        { text: "De docent sluit aan bij de beginsituatie van de groep." },
      ],
      requiredEvidence: ["lesvoorbereiding", "feedback van de werkplekbegeleider"],
    },
    {
      code: "LU2",
      title: "Toetsen",
      criteria: [{ text: "De docent maakt een toets die past bij de leerdoelen." }],
      requiredEvidence: [],
    },
  ],
  requirements: { maxWords: 6000 },
};

describe("buildExtractMessage", () => {
  it("wraps the form as data and clips a very long form", () => {
    expect(buildExtractMessage(FORM)).toContain(`<form>\n${FORM}\n</form>`);
    const long = buildExtractMessage("x".repeat(EXTRACT_INPUT_LIMIT + 10));
    expect(long.length).toBeLessThan(EXTRACT_INPUT_LIMIT + 200);
  });
});

describe("parseExtraction", () => {
  it("turns valid JSON into a framework proposal with fresh ids, nothing flagged", () => {
    const r = parseExtraction(JSON.stringify(good), FORM);
    if (!r.ok) throw new Error(r.error);
    expect(r.flagged).toBe(0);
    expect(r.framework.institution).toBe("Hogeschool Voorbeeld");
    expect(r.framework.requirements).toEqual({ maxWords: 6000 });
    expect(r.framework.confirmedAt).toBeUndefined();
    const [lu1, lu2] = r.framework.outcomes;
    expect(lu1.code).toBe("LU1");
    expect(lu1.criteria.map((c) => c.unverified)).toEqual([undefined, undefined]);
    expect(lu1.criteria[0].strongLevel).toBe("de opbouw is afgestemd op de doelen van de les.");
    expect(lu1.requiredEvidence).toEqual([
      "lesvoorbereiding",
      "feedback van de werkplekbegeleider",
    ]);
    expect(lu2.criteria).toHaveLength(1);
    const ids = [lu1.id, lu2.id, ...lu1.criteria.map((c) => c.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("accepts a fenced answer and nulls for missing fields", () => {
    const raw = `Hier is het kader:\n\`\`\`json\n${JSON.stringify({
      ...good,
      year: null,
      requirements: { maxWords: null, notes: null },
    })}\n\`\`\``;
    const r = parseExtraction(raw, FORM);
    if (!r.ok) throw new Error(r.error);
    expect(r.framework.year).toBeUndefined();
    expect(r.framework.requirements).toEqual({});
  });

  it("flags a criterion that is not verbatim in the form", () => {
    const invented = structuredClone(good);
    invented.outcomes[1].criteria.push({
      text: "De docent reflecteert op de eigen toetspraktijk.",
    });
    const r = parseExtraction(JSON.stringify(invented), FORM);
    if (!r.ok) throw new Error(r.error);
    expect(r.flagged).toBe(1);
    expect(r.framework.outcomes[1].criteria.map((c) => !!c.unverified)).toEqual([false, true]);
  });

  it("flags a paraphrase, not a near miss", () => {
    const para = structuredClone(good);
    para.outcomes[0].criteria[1].text = "De docent sluit goed aan bij de beginsituatie.";
    const r = parseExtraction(JSON.stringify(para), FORM);
    if (!r.ok) throw new Error(r.error);
    expect(r.framework.outcomes[0].criteria[1].unverified).toBe(true);
  });

  it("refuses broken JSON, an empty framework and a wrong shape", () => {
    expect(parseExtraction("geen json", FORM)).toEqual({ ok: false, error: "unparseable" });
    expect(parseExtraction('{"outcomes": [', FORM)).toEqual({ ok: false, error: "unparseable" });
    expect(parseExtraction(JSON.stringify({ outcomes: [] }), FORM)).toEqual({
      ok: false,
      error: "empty",
    });
    expect(parseExtraction(JSON.stringify({ outcomes: "LU1" }), FORM)).toEqual({
      ok: false,
      error: "unparseable",
    });
  });

  it("keeps the proposal within the dossier limits and says so", () => {
    const big = {
      outcomes: Array.from({ length: LIMITS.outcomes + 2 }, (_, i) => ({
        code: `LU${i + 1}-${"x".repeat(40)}`,
        title: "t".repeat(LIMITS.title + 50),
        criteria: Array.from({ length: LIMITS.criteriaPerOutcome + 3 }, () => ({
          text: "c".repeat(LIMITS.criterionText + 10),
        })),
        requiredEvidence: [],
      })),
      requirements: { maxWords: -5, aiDisclosureRequired: true },
    };
    const r = parseExtraction(JSON.stringify(big), FORM);
    if (!r.ok) throw new Error(r.error);
    expect(r.clipped).toBe(true);
    expect(r.framework.outcomes).toHaveLength(LIMITS.outcomes);
    expect(r.framework.outcomes[0].criteria).toHaveLength(LIMITS.criteriaPerOutcome);
    expect(r.framework.requirements).toEqual({ aiDisclosureRequired: true });
    const d = applyExtraction(emptyDossier(["bdb"]), r.framework);
    if (!d.ok) throw new Error(d.error);
    expect(DossierDataSchema.safeParse(d.data).success).toBe(true);
  });
});

describe("applyExtraction", () => {
  const proposal = () => {
    const r = parseExtraction(JSON.stringify(good), FORM);
    if (!r.ok) throw new Error(r.error);
    return r.framework;
  };

  it("fills an empty dossier, unconfirmed, keeping fields the form does not name", () => {
    const base = edit.updateFrameworkMeta(emptyDossier(["bdb"]), {
      institution: "",
      requirements: { aiDisclosureRequired: true },
    });
    const r = applyExtraction(base, proposal());
    if (!r.ok) throw new Error(r.error);
    expect(r.data.framework.outcomes).toHaveLength(2);
    expect(r.data.framework.confirmedAt).toBeUndefined();
    expect(r.data.framework.requirements).toEqual({ aiDisclosureRequired: true, maxWords: 6000 });
    expect(DossierDataSchema.safeParse(r.data).success).toBe(true);
  });

  it("replaces an unused starting point", () => {
    let d = emptyDossier(["bdb"]);
    d = edit.addOutcome(d, { code: "K1", title: "Doceren" });
    d = edit.confirmFramework(d, 5);
    const r = applyExtraction(d, proposal());
    if (!r.ok) throw new Error(r.error);
    expect(r.data.framework.outcomes.map((o) => o.code)).toEqual(["LU1", "LU2"]);
    expect(r.data.framework.confirmedAt).toBeUndefined();
  });

  it("refuses to replace a framework the teacher already works with", () => {
    const d = sampleDossier();
    expect(frameworkInUse(d)).toBe(true);
    expect(applyExtraction(d, proposal())).toEqual({ ok: false, error: "in-use" });

    // Only a status set is enough.
    const onlyStatus = sampleDossier();
    onlyStatus.evidence = [];
    onlyStatus.chapters = [];
    expect(frameworkInUse(onlyStatus)).toBe(true);
    onlyStatus.status = {};
    expect(frameworkInUse(onlyStatus)).toBe(false);
  });
});

describe("the check-this flag", () => {
  it("is cleared when the teacher saves that criterion", () => {
    const d = sampleDossier();
    d.framework.outcomes[0].criteria[0].unverified = true;
    expect(DossierDataSchema.safeParse(d).success).toBe(true);
    const next = edit.updateCriterion(d, C1, { text: "Nagekeken tekst." });
    expect(next.framework.outcomes[0].criteria[0].unverified).toBeUndefined();
  });
});
