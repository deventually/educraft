import { describe, it, expect } from "vitest";
import { buildCoachMessage, criterionKeys, parseCoachReview } from "~/lib/portfolio/coach";
import { addEvidence, addReference } from "~/lib/portfolio/edit";
import { C1, C2, LU, sampleDossier } from "./fixtures";

const CHAPTER = "Mijn les begon met een vraag.";

function reviewJson(criteria: unknown[], overall = "Goed begin.") {
  return JSON.stringify({ criteria, overall });
}

const okCriteria = [
  {
    key: "K1",
    verdict: "shown",
    quote: "Mijn les begon met een vraag.",
    strengthen: [],
    evidenceNeeded: [],
  },
  {
    key: "K2",
    verdict: "missing",
    gap: "Je beschrijft de beginsituatie niet.",
    strengthen: ["Beschrijf wat de studenten al wisten."],
    evidenceNeeded: ["Opname van de les"],
  },
];

describe("buildCoachMessage", () => {
  it("gives the model the outcome's criteria under short keys, with stronger levels", () => {
    const msg = buildCoachMessage(sampleDossier(), LU, "nl");
    expect(msg).toContain(
      "K1: De les heeft een heldere structuur met inleiding, kern en afsluiting.",
    );
    expect(msg).toContain("K2: De les sluit aan bij de beginsituatie.");
    expect(msg).toContain("Ook per student.");
    expect(msg).toContain("Opname van de les");
    expect(msg).not.toContain(C1);
  });

  it("includes the chapter, linked evidence, references and the word limit", () => {
    let d = addReference(sampleDossier(), "Last, B. (2017). Blended learning in de praktijk.");
    d = addEvidence(d, {
      title: "Los stuk",
      kind: "other",
      text: "Niet gekoppeld.",
      criterionIds: [],
    });
    const msg = buildCoachMessage(d, LU, "nl");
    expect(msg).toContain(CHAPTER);
    expect(msg).toContain("Feedback werkplekbegeleider");
    expect(msg).toContain("Goede opbouw.");
    expect(msg).not.toContain("Niet gekoppeld.");
    expect(msg).toContain("Last, B. (2017)");
    expect(msg).toContain("100");
  });

  it("marks the teacher's material as data, not instructions", () => {
    const msg = buildCoachMessage(sampleDossier(), LU, "en");
    expect(msg).toMatch(/<chapter>[\s\S]*<\/chapter>/);
    expect(msg).toMatch(/<criteria>[\s\S]*<\/criteria>/);
  });

  it("maps keys to criterion ids in order", () => {
    expect(criterionKeys(sampleDossier(), LU)).toEqual({ K1: C1, K2: C2 });
  });
});

describe("parseCoachReview", () => {
  const d = sampleDossier();

  it("maps a valid review back to criterion ids", () => {
    const r = parseCoachReview(reviewJson(okCriteria), d, LU);
    if (!r.ok) throw new Error(r.error);
    expect(r.review.criteria.map((c) => c.criterionId)).toEqual([C1, C2]);
    expect(r.review.criteria[0]).toMatchObject({ verdict: "shown", quote: CHAPTER });
    expect(r.review.criteria[1]!.evidenceNeeded).toEqual(["Opname van de les"]);
    expect(r.review.overall).toBe("Goed begin.");
  });

  it("accepts JSON inside a code fence with text around it", () => {
    const r = parseCoachReview(
      `Hier is het:\n\`\`\`json\n${reviewJson(okCriteria)}\n\`\`\``,
      d,
      LU,
    );
    expect(r.ok).toBe(true);
  });

  it("refuses output that is not JSON", () => {
    expect(parseCoachReview("Het hoofdstuk is prima.", d, LU)).toEqual({
      ok: false,
      error: "unparseable",
    });
  });

  it("refuses an unknown, missing or duplicated criterion", () => {
    const unknown = [...okCriteria, { ...okCriteria[0], key: "K9" }];
    const missing = [okCriteria[0]];
    const dup = [okCriteria[0], okCriteria[0]];
    for (const c of [unknown, missing, dup]) {
      expect(parseCoachReview(reviewJson(c), d, LU)).toEqual({ ok: false, error: "incomplete" });
    }
  });

  it("drops a quote that is not in the chapter and lowers 'shown' to 'partial'", () => {
    const made = [
      { ...okCriteria[0], quote: "Ik activeerde voorkennis met een quiz." },
      okCriteria[1],
    ];
    const r = parseCoachReview(reviewJson(made), d, LU);
    if (!r.ok) throw new Error(r.error);
    expect(r.review.criteria[0]).toMatchObject({ verdict: "partial", quoteUnverified: true });
    expect(r.review.criteria[0]!.quote).toBeUndefined();
  });

  it("treats whitespace and quote-style differences as the same quote", () => {
    let dd = sampleDossier();
    dd.chapters[0]!.text = "Ik zei: “Wat weten jullie al?”\n\nDaarna  begon de kern.";
    const r = parseCoachReview(
      reviewJson([
        { ...okCriteria[0], quote: 'Ik zei: "Wat weten jullie al?" Daarna begon de kern.' },
        okCriteria[1],
      ]),
      dd,
      LU,
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.review.criteria[0]).toMatchObject({ verdict: "shown" });
    expect(r.review.criteria[0]!.quoteUnverified).toBeUndefined();
    dd = sampleDossier();
  });

  it("filters advice that cites a source the teacher does not have", () => {
    const withRef = addReference(
      sampleDossier(),
      "Last, B. (2017). Blended learning in de praktijk.",
    );
    const advice = [
      { ...okCriteria[0] },
      {
        ...okCriteria[1],
        strengthen: [
          "Onderbouw je keuze met Last (2017).",
          "Verwijs naar Hattie (2009) over feedback.",
          "Beschrijf wat de studenten al wisten.",
        ],
      },
    ];
    const r = parseCoachReview(reviewJson(advice), withRef, LU);
    if (!r.ok) throw new Error(r.error);
    expect(r.review.criteria[1]!.strengthen).toEqual([
      "Onderbouw je keuze met Last (2017).",
      "Beschrijf wat de studenten al wisten.",
    ]);
  });

  it("caps lists at three items and the overall text at 600 characters", () => {
    const long = [
      okCriteria[0],
      { ...okCriteria[1], strengthen: ["a", "b", "c", "d"], evidenceNeeded: ["a", "b", "c", "d"] },
    ];
    const r = parseCoachReview(reviewJson(long, "x".repeat(900)), d, LU);
    if (!r.ok) throw new Error(r.error);
    expect(r.review.criteria[1]!.strengthen).toHaveLength(3);
    expect(r.review.criteria[1]!.evidenceNeeded).toHaveLength(3);
    expect(r.review.overall.length).toBeLessThanOrEqual(600);
  });

  it("refuses an unknown verdict", () => {
    const bad = [{ ...okCriteria[0], verdict: "excellent" }, okCriteria[1]];
    expect(parseCoachReview(reviewJson(bad), d, LU)).toEqual({ ok: false, error: "unparseable" });
  });
});
