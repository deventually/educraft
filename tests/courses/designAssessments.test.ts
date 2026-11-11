import { describe, expect, it } from "vitest";
import {
  buildAssessmentsDesignMessage,
  canDesignAssessments,
  DESIGN_ASSESSMENTS_LIMITS,
  parseAssessmentsBrief,
  parseAssessmentsDesign,
} from "~/lib/courses/designAssessments";
import { applyImport, parseImportSelection } from "~/lib/courses/import";
import { emptyCourseData } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";
import { alignedCourse } from "./fixtures";

/** A course after step 1: three outcomes, no tests or lessons yet. */
function designed(): CourseData {
  return {
    ...emptyCourseData(),
    ec: 5,
    schedule: { weeks: 8 },
    outcomes: [
      {
        id: "lo-a",
        text: "De student ontwerpt een datamodel.",
        bloom: "create",
        criteria: [{ text: "Elke tabel heeft een sleutel." }],
      },
      { id: "lo-b", text: "De student schrijft SQL-queries.", bloom: "apply" },
      { id: "lo-c", text: "De student legt normaliseren uit.", bloom: "understand" },
    ],
  };
}

const answer = {
  assessments: [
    {
      title: "Oefentoets SQL",
      kind: "formative",
      week: 4,
      weight: 20,
      outcomeRefs: [2],
      form: "Oefentoets op de computer",
    },
    {
      title: "Tentamen",
      kind: "summative",
      week: 8,
      weight: 40,
      outcomeRefs: [2, 3],
      form: "Schriftelijk tentamen",
    },
    {
      title: "Beroepsproduct datamodel",
      kind: "summative",
      week: 8,
      weight: 60,
      outcomeRefs: [1],
      form: "Beroepsproduct met mondelinge toelichting",
    },
  ],
  notes: "Ik ging uit van één tentamenweek.",
};

describe("canDesignAssessments: step 2 comes after the outcomes, on a course without tests", () => {
  it("needs outcomes and no tests yet", () => {
    expect(canDesignAssessments(designed())).toBe(true);
    expect(canDesignAssessments(emptyCourseData())).toBe(false);
    expect(canDesignAssessments(alignedCourse())).toBe(false);
  });
});

describe("parseAssessmentsBrief", () => {
  it("reads the optional assessment forms of the school", () => {
    const fd = new FormData();
    fd.set("forms", "  tentamen, beroepsproduct, criteriumgericht interview ");
    expect(parseAssessmentsBrief(fd)).toEqual({
      forms: "tentamen, beroepsproduct, criteriumgericht interview",
    });
    expect(parseAssessmentsBrief(new FormData())).toEqual({});
    const long = new FormData();
    long.set("forms", "x".repeat(DESIGN_ASSESSMENTS_LIMITS.forms + 1));
    expect(parseAssessmentsBrief(long)).toBeNull();
  });
});

describe("buildAssessmentsDesignMessage", () => {
  it("sends the outcomes as numbered data, with study load, weeks, forms and context", () => {
    const m = buildAssessmentsDesignMessage({
      name: "Databases",
      data: designed(),
      brief: { forms: "tentamen, beroepsproduct" },
      context: "Sector: hbo",
    });
    expect(m).toContain("<course>Databases</course>");
    expect(m).toContain("<studyLoad>5 EC</studyLoad>");
    expect(m).toContain("<weeks>8</weeks>");
    expect(m).toContain(
      "<outcomes>\n1. De student ontwerpt een datamodel. [create]\n   - Elke tabel heeft een sleutel.\n2. De student schrijft SQL-queries. [apply]\n3. De student legt normaliseren uit. [understand]\n</outcomes>",
    );
    expect(m).toContain("<assessmentForms>\ntentamen, beroepsproduct\n</assessmentForms>");
    expect(m).toContain("<context>\nSector: hbo\n</context>");
  });

  it("leaves out what is not known", () => {
    const m = buildAssessmentsDesignMessage({
      name: "Databases",
      data: { ...designed(), ec: undefined, schedule: undefined },
      brief: {},
      context: "",
    });
    for (const tag of ["<studyLoad>", "<weeks>", "<assessmentForms>", "<context>"])
      expect(m).not.toContain(tag);
  });
});

describe("parseAssessmentsDesign", () => {
  it("turns the answer into a design proposal over the course's own outcomes", () => {
    const r = parseAssessmentsDesign(JSON.stringify(answer), designed());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.proposal;
    expect(p.source).toBe("design");
    expect(p.notes).toBe("Ik ging uit van één tentamenweek.");
    // The outcomes are the course's, so the review form only carries them along.
    expect(p.outcomes.map((o) => [o.key, o.text, o.existing])).toEqual([
      ["o1", "De student ontwerpt een datamodel.", true],
      ["o2", "De student schrijft SQL-queries.", true],
      ["o3", "De student legt normaliseren uit.", true],
    ]);
    expect(p.outcomes.every((o) => o.criteria.length === 0)).toBe(true);
    expect(p.assessments).toEqual([
      {
        key: "a1",
        title: "Oefentoets SQL",
        kind: "formative",
        week: 4,
        outcomeKeys: ["o2"],
        existing: false,
        details: { form: "Oefentoets op de computer" },
        parts: [],
      },
      {
        key: "a2",
        title: "Tentamen",
        kind: "summative",
        week: 8,
        weight: 40,
        outcomeKeys: ["o2", "o3"],
        existing: false,
        details: { form: "Schriftelijk tentamen" },
        parts: [],
      },
      {
        key: "a3",
        title: "Beroepsproduct datamodel",
        kind: "summative",
        week: 8,
        weight: 60,
        outcomeKeys: ["o1"],
        existing: false,
        details: { form: "Beroepsproduct met mondelinge toelichting" },
        parts: [],
      },
    ]);
    expect(p.weightsOff).toBe(false);
    expect(p.uncovered).toEqual([]);
  });

  it("drops coverage of outcomes that do not exist, and weeks outside the course", () => {
    const r = parseAssessmentsDesign(
      JSON.stringify({
        assessments: [
          { title: "Tentamen", kind: "summative", week: 9, weight: 100, outcomeRefs: [1, 4, 0] },
        ],
      }),
      designed(),
    );
    expect(r.ok && r.proposal.assessments[0]).toMatchObject({ outcomeKeys: ["o1"] });
    expect(r.ok && r.proposal.assessments[0]?.week).toBeUndefined();
  });

  it("names the outcomes no summative test covers, and weights that miss 100, without fixing them", () => {
    const r = parseAssessmentsDesign(
      JSON.stringify({
        assessments: [
          { title: "Oefentoets", kind: "formative", outcomeRefs: [3] },
          { title: "Tentamen", kind: "summative", weight: 80, outcomeRefs: [1, 2] },
        ],
      }),
      designed(),
    );
    expect(r.ok && r.proposal.uncovered).toEqual(["o3"]);
    expect(r.ok && r.proposal.weightsOff).toBe(true);
    expect(r.ok && r.proposal.assessments[1]?.weight).toBe(80);
  });

  it("drops empty and duplicate titles, an unknown kind, and caps the number of tests", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      title: `Toets ${i + 1}`,
      kind: "summatief",
      outcomeRefs: [1],
    }));
    const r = parseAssessmentsDesign(
      JSON.stringify({ assessments: [{ title: " " }, { title: "Toets 1" }, ...many] }),
      designed(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposal.assessments).toHaveLength(DESIGN_ASSESSMENTS_LIMITS.assessments);
    expect(r.proposal.assessments[0]?.title).toBe("Toets 1");
    expect(r.proposal.assessments[0]?.kind).toBeUndefined();
    expect(r.clipped).toBe(true);
  });

  it("reports an answer without tests, with the model's notes, and an unparseable one", () => {
    expect(
      parseAssessmentsDesign(JSON.stringify({ assessments: [], notes: "Geen." }), designed()),
    ).toEqual({ ok: false, error: "empty", notes: "Geen." });
    expect(parseAssessmentsDesign("kapot", designed())).toEqual({
      ok: false,
      error: "unparseable",
    });
  });

  it("goes through the same review form and apply as an import", () => {
    const fd = new FormData();
    for (const [key, text] of [
      ["o1", "De student ontwerpt een datamodel."],
      ["o2", "De student schrijft SQL-queries."],
    ]) {
      fd.append("outcomeKey", key!);
      fd.set(`${key}.text`, text!);
    }
    fd.append("assessmentKey", "a1");
    fd.set("a1.pick", "on");
    fd.set("a1.title", "Beroepsproduct");
    fd.set("a1.kind", "summative");
    fd.set("a1.weight", "100");
    fd.set("a1.week", "8");
    fd.append("a1.outcomes", "o1");
    fd.append("a1.outcomes", "o2");
    fd.set("a1.extra", JSON.stringify({ details: { form: "Beroepsproduct" }, parts: [] }));
    const selection = parseImportSelection(fd);
    expect(selection).not.toBeNull();
    const applied = applyImport(designed(), selection!);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.data.outcomes).toHaveLength(3);
    expect(applied.data.assessments[0]).toMatchObject({
      title: "Beroepsproduct",
      kind: "summative",
      weight: 100,
      week: 8,
      form: "Beroepsproduct",
      coverage: [{ outcomeId: "lo-a" }, { outcomeId: "lo-b" }],
    });
  });
});
