import { describe, expect, it } from "vitest";
import {
  applyImport,
  buildImportMessage,
  type ImportSelection,
  parseImport,
  parseImportSelection,
} from "~/lib/courses/import";
import { CourseDataSchema, emptyCourseData } from "~/lib/courses/schema";
import { alignedCourse, LO1, TEST1 } from "./fixtures";

// A synthetic study guide (no institution material): a hyphenated word split
// over two lines and a page break, as PDF text comes out.
const DOC = `Studiehandleiding Databases (fictief), 5 EC

Leeruitkomsten
1. Je ontwerpt een genormaliseerd data-
model voor een gegeven casus.
2. Je schrijft SQL-queries met joins en subqueries.
3. Je begrijpt transacties.

Toetsing
Schriftelijk tentamen, week 8, weging 60%
Beroepsproduct datamodel, week 10, weging 40%`;

const answer = {
  outcomes: [
    {
      text: "Je ontwerpt een genormaliseerd datamodel voor een gegeven casus.",
      bloomProposal: "create",
    },
    { text: "Je schrijft SQL-queries met joins en subqueries.", bloomProposal: "apply" },
    { text: "Je begrijpt transacties.", bloomProposal: null },
  ],
  assessments: [
    { title: "Schriftelijk tentamen", kind: "summative", weight: 60, week: 8, outcomeRefs: [2, 3] },
    {
      title: "Beroepsproduct datamodel",
      kind: "summative",
      weight: 40,
      week: 10,
      outcomeRefs: [1],
    },
  ],
  notes: null,
};

describe("buildImportMessage", () => {
  it("sends the document as data, with the course name when given", () => {
    const m = buildImportMessage(DOC, "Databases");
    expect(m).toContain(`<document>\n${DOC}\n</document>`);
    expect(m).toContain("<course>Databases</course>");
    expect(buildImportMessage(DOC, " ")).not.toContain("<course>");
  });
});

describe("parseImport", () => {
  it("turns valid JSON into a proposal, all verbatim, weights fine", () => {
    const r = parseImport(JSON.stringify(answer), DOC, emptyCourseData());
    if (!r.ok) throw new Error(r.error);
    expect(r.flagged).toBe(0);
    expect(r.proposal.weightsOff).toBe(false);
    expect(r.proposal.outcomes.map((o) => [o.key, o.bloom, o.verbatim, o.existing])).toEqual([
      ["o1", "create", true, false],
      ["o2", "apply", true, false],
      ["o3", undefined, true, false],
    ]);
    expect(r.proposal.assessments[0]).toMatchObject({
      key: "a1",
      title: "Schriftelijk tentamen",
      kind: "summative",
      weight: 60,
      week: 8,
      outcomeKeys: ["o2", "o3"],
    });
  });

  it("accepts a fenced answer and drops what is out of range", () => {
    const odd = structuredClone(answer) as Record<string, unknown> & typeof answer;
    (odd.outcomes[0] as Record<string, unknown>).bloomProposal = "master";
    (odd.assessments[0] as Record<string, unknown>).kind = "exam";
    (odd.assessments[0] as Record<string, unknown>).week = 99;
    (odd.assessments[0] as Record<string, unknown>).weight = 160;
    (odd.assessments[0] as Record<string, unknown>).outcomeRefs = [2, 9];
    const r = parseImport(
      `Hier:\n\`\`\`json\n${JSON.stringify(odd)}\n\`\`\``,
      DOC,
      emptyCourseData(),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.proposal.outcomes[0].bloom).toBeUndefined();
    const a = r.proposal.assessments[0];
    expect([a.kind, a.week, a.weight, a.outcomeKeys]).toEqual([
      undefined,
      undefined,
      undefined,
      ["o2"],
    ]);
  });

  it("marks an outcome that is not verbatim in the document as 'check this'", () => {
    const invented = structuredClone(answer);
    invented.outcomes.push({ text: "Je beheert een databaseserver.", bloomProposal: "apply" });
    invented.outcomes[1].text = "Je schrijft goede SQL-queries.";
    const r = parseImport(JSON.stringify(invented), DOC, emptyCourseData());
    if (!r.ok) throw new Error(r.error);
    expect(r.flagged).toBe(2);
    expect(r.proposal.outcomes.map((o) => o.verbatim)).toEqual([true, false, true, false]);
  });

  it("reports weights that do not add up to 100, and does not correct them", () => {
    const off = structuredClone(answer);
    off.assessments[1].weight = 50;
    const r = parseImport(JSON.stringify(off), DOC, emptyCourseData());
    if (!r.ok) throw new Error(r.error);
    expect(r.proposal.weightsOff).toBe(true);
    expect(r.proposal.assessments.map((a) => a.weight)).toEqual([60, 50]);
  });

  it("marks outcomes and assessments the course already has", () => {
    const course = emptyCourseData();
    course.outcomes.push({ id: "x", text: "je begrijpt transacties", bloom: "understand" });
    course.assessments.push({
      id: "t",
      title: "Schriftelijk Tentamen",
      kind: "summative",
      coverage: [],
    });
    const r = parseImport(JSON.stringify(answer), DOC, course);
    if (!r.ok) throw new Error(r.error);
    expect(r.proposal.outcomes.map((o) => o.existing)).toEqual([false, false, true]);
    expect(r.proposal.assessments.map((a) => a.existing)).toEqual([true, false]);
  });

  it("clips to the course limits", () => {
    const big = {
      outcomes: Array.from({ length: 40 }, (_, i) => ({
        text: `Uitkomst ${i}`.padEnd(1_200, "x"),
      })),
      assessments: [],
    };
    const r = parseImport(JSON.stringify(big), DOC, emptyCourseData());
    if (!r.ok) throw new Error(r.error);
    expect(r.clipped).toBe(true);
    expect(r.proposal.outcomes).toHaveLength(30);
    expect(r.proposal.outcomes[0].text).toHaveLength(1_000);
  });

  it("refuses broken JSON, a wrong shape and an empty proposal", () => {
    expect(parseImport("geen json", DOC, emptyCourseData())).toEqual({
      ok: false,
      error: "unparseable",
    });
    expect(parseImport('{"outcomes": "LU1"}', DOC, emptyCourseData())).toEqual({
      ok: false,
      error: "unparseable",
    });
    expect(
      parseImport(
        JSON.stringify({ outcomes: [], assessments: [], notes: "Geen OER" }),
        DOC,
        emptyCourseData(),
      ),
    ).toEqual({ ok: false, error: "empty" });
  });
});

describe("applyImport", () => {
  const selection = (over: Partial<ImportSelection> = {}): ImportSelection => ({
    outcomes: [
      { key: "o1", pick: true, text: "Je ontwerpt een datamodel.", bloom: "apply" },
      { key: "o2", pick: true, text: "Je schrijft SQL-queries.", bloom: "apply" },
      { key: "o3", pick: false, text: "Je beheert een server." },
    ],
    assessments: [
      {
        key: "a1",
        pick: true,
        title: "Tentamen",
        kind: "summative",
        weight: 60,
        week: 8,
        outcomeKeys: ["o1", "o2", "o3"],
      },
      { key: "a2", pick: false, title: "Oefentoets", kind: "formative", outcomeKeys: [] },
    ],
    ...over,
  });

  it("leaves the start date alone (P22.1)", () => {
    const r = applyImport({ ...alignedCourse(), startDate: "2026-09-02" }, selection());
    if (!r.ok) throw new Error(r.error);
    expect(r.data.startDate).toBe("2026-09-02");
  });

  it("adds only the picked items; coverage points at new or existing outcomes", () => {
    const r = applyImport(alignedCourse(), selection());
    if (!r.ok) throw new Error(r.error);
    expect(CourseDataSchema.safeParse(r.data).success).toBe(true);
    expect(r.added).toEqual({ outcomes: 1, assessments: 1 });
    const texts = r.data.outcomes.map((o) => o.text);
    expect(texts).toEqual([
      "Je ontwerpt een datamodel.",
      "Je legt normaliseren uit.",
      "Je schrijft SQL-queries.",
    ]);
    const tentamen = r.data.assessments.find((a) => a.title === "Tentamen");
    const sql = r.data.outcomes[2];
    expect(tentamen).toMatchObject({ kind: "summative", weight: 60, week: 8 });
    expect(tentamen?.coverage.map((c) => c.outcomeId)).toEqual([LO1, sql.id]);
  });

  it("never duplicates or overwrites an existing outcome or assessment", () => {
    const course = alignedCourse();
    const r = applyImport(
      course,
      selection({
        outcomes: [
          { key: "o1", pick: true, text: "je ontwerpt een  datamodel", bloom: "remember" },
        ],
        assessments: [
          { key: "a1", pick: true, title: "eindopdracht", kind: "formative", outcomeKeys: ["o1"] },
        ],
      }),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.added).toEqual({ outcomes: 0, assessments: 0 });
    expect(r.data).toEqual(course);
    expect(r.data.outcomes[0].bloom).toBe("create");
    expect(r.data.assessments.find((a) => a.id === TEST1)?.kind).toBe("summative");
  });

  it("refuses an import that would pass the course limits", () => {
    const many = Array.from({ length: 31 }, (_, i) => ({
      key: `o${i + 1}`,
      pick: true,
      text: `Leeruitkomst ${i}`,
    }));
    expect(applyImport(emptyCourseData(), { outcomes: many, assessments: [] })).toEqual({
      ok: false,
      error: "limit",
    });
  });
});

describe("parseImportSelection", () => {
  function form(entries: [string, string][]): FormData {
    const fd = new FormData();
    for (const [k, v] of entries) fd.append(k, v);
    return fd;
  }

  it("reads the review form", () => {
    const fd = form([
      ["intent", "import-apply"],
      ["outcomeKey", "o1"],
      ["o1.pick", "on"],
      ["o1.text", " Je ontwerpt een datamodel. "],
      ["o1.bloom", "create"],
      ["outcomeKey", "o2"],
      ["o2.text", "Je begrijpt transacties."],
      ["o2.bloom", ""],
      ["assessmentKey", "a1"],
      ["a1.pick", "on"],
      ["a1.title", "Tentamen"],
      ["a1.kind", "summative"],
      ["a1.weight", "60"],
      ["a1.week", ""],
      ["a1.outcomes", "o1"],
      ["a1.outcomes", "o2"],
    ]);
    expect(parseImportSelection(fd)).toEqual({
      outcomes: [
        { key: "o1", pick: true, text: "Je ontwerpt een datamodel.", bloom: "create" },
        { key: "o2", pick: false, text: "Je begrijpt transacties." },
      ],
      assessments: [
        {
          key: "a1",
          pick: true,
          title: "Tentamen",
          kind: "summative",
          weight: 60,
          outcomeKeys: ["o1", "o2"],
        },
      ],
    });
  });

  it("refuses a manipulated payload", () => {
    const bad = (entries: [string, string][]) => parseImportSelection(form(entries));
    expect(
      bad([
        ["outcomeKey", "../x"],
        ["../x.text", "a"],
      ]),
    ).toBeNull();
    expect(
      bad([
        ["outcomeKey", "o1"],
        ["o1.text", "x".repeat(1_001)],
      ]),
    ).toBeNull();
    expect(
      bad([
        ["outcomeKey", "o1"],
        ["o1.text", "a"],
        ["o1.bloom", "master"],
      ]),
    ).toBeNull();
    expect(
      bad([
        ["assessmentKey", "a1"],
        ["a1.title", "T"],
        ["a1.kind", "exam"],
      ]),
    ).toBeNull();
    expect(
      bad([
        ["assessmentKey", "a1"],
        ["a1.title", "T"],
        ["a1.kind", "summative"],
        ["a1.weight", "300"],
      ]),
    ).toBeNull();
    expect(
      bad([
        ["assessmentKey", "a1"],
        ["a1.title", "T"],
        ["a1.kind", "summative"],
        ["a1.outcomes", "o7"],
      ]),
    ).toBeNull();
    expect(bad([])).toBeNull();
  });
});
