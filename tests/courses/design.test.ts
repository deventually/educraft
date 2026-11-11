import { describe, expect, it } from "vitest";
import {
  applyDesignBrief,
  buildOutcomesDesignMessage,
  DESIGN_LIMITS,
  outcomeRange,
  parseDesignBrief,
  parseOutcomesDesign,
} from "~/lib/courses/design";
import { applyImport, parseImportSelection } from "~/lib/courses/import";
import { CourseDataSchema, emptyCourseData } from "~/lib/courses/schema";
import { alignedCourse } from "./fixtures";

const DESCRIPTION =
  "In deze module leren studenten een relationele database ontwerpen en bevragen. Ze werken aan een casus van een fietsenmaker.";

const answer = {
  outcomes: [
    {
      text: "Je ontwerpt een genormaliseerd datamodel voor een casus.",
      bloom: "create",
      criteria: ["Het model staat in de derde normaalvorm.", "Elke tabel heeft een sleutel."],
    },
    {
      text: "Je schrijft SQL-queries met joins.",
      bloom: "apply",
      criteria: ["De query geeft het gevraagde resultaat."],
    },
  ],
  notes: "Ik ging uit van hbo, jaar 1.",
};

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("parseDesignBrief", () => {
  it("reads the description, the EC and the weeks", () => {
    expect(
      parseDesignBrief(form({ description: ` ${DESCRIPTION} `, ec: "5", weeks: "8" })),
    ).toEqual({ description: DESCRIPTION, ec: 5, weeks: 8 });
  });

  it("leaves out an empty EC or number of weeks", () => {
    expect(parseDesignBrief(form({ description: DESCRIPTION, ec: "", weeks: "" }))).toEqual({
      description: DESCRIPTION,
    });
  });

  it("refuses an empty or too long description and numbers out of range", () => {
    expect(parseDesignBrief(form({ description: "  " }))).toBeNull();
    expect(
      parseDesignBrief(form({ description: "x".repeat(DESIGN_LIMITS.description + 1) })),
    ).toBeNull();
    expect(parseDesignBrief(form({ description: DESCRIPTION, ec: "-1" }))).toBeNull();
    expect(parseDesignBrief(form({ description: DESCRIPTION, weeks: "2.5" }))).toBeNull();
    expect(parseDesignBrief(form({ description: DESCRIPTION, weeks: "999" }))).toBeNull();
  });
});

describe("outcomeRange: how many outcomes, from the size of the course", () => {
  it("is 3 to 4 up to 5 EC, or without EC up to 8 weeks", () => {
    expect(outcomeRange({ description: "x", ec: 5 })).toEqual({ min: 3, max: 4 });
    expect(outcomeRange({ description: "x", ec: 3, weeks: 20 })).toEqual({ min: 3, max: 4 });
    expect(outcomeRange({ description: "x", weeks: 6 })).toEqual({ min: 3, max: 4 });
    expect(outcomeRange({ description: "x", weeks: 8 })).toEqual({ min: 3, max: 4 });
  });

  it("is 4 to 6 for a larger course, and 3 to 5 when nothing is known", () => {
    expect(outcomeRange({ description: "x", ec: 6 })).toEqual({ min: 4, max: 6 });
    expect(outcomeRange({ description: "x", ec: 15, weeks: 4 })).toEqual({ min: 4, max: 6 });
    expect(outcomeRange({ description: "x", weeks: 9 })).toEqual({ min: 4, max: 6 });
    expect(outcomeRange({ description: "x" })).toEqual({ min: 3, max: 5 });
  });
});

describe("buildOutcomesDesignMessage", () => {
  it("sends the description as data, with the name, study load, weeks, disciplines and context", () => {
    const m = buildOutcomesDesignMessage({
      name: "Databases",
      brief: { description: DESCRIPTION, ec: 5, weeks: 8 },
      disciplines: ["Wiskunde", "Engels"],
      context: "Sector: hbo",
    });
    expect(m).toContain("<course>Databases</course>");
    expect(m).toContain("<studyLoad>5 EC</studyLoad>");
    expect(m).toContain("<weeks>8</weeks>");
    expect(m).toContain("<outcomeCount>3-4</outcomeCount>");
    expect(m).toContain("<disciplines>\n- Wiskunde\n- Engels\n</disciplines>");
    expect(m).toContain("<context>\nSector: hbo\n</context>");
    expect(m).toContain(`<description>\n${DESCRIPTION}\n</description>`);
  });

  it("leaves out what is not known", () => {
    const m = buildOutcomesDesignMessage({
      name: "Databases",
      brief: { description: DESCRIPTION },
      disciplines: [],
      context: "",
    });
    for (const tag of ["<studyLoad>", "<weeks>", "<disciplines>", "<context>"])
      expect(m).not.toContain(tag);
    expect(m).toContain("<outcomeCount>3-5</outcomeCount>");
    expect(m).toContain("<description>");
  });
});

describe("parseOutcomesDesign", () => {
  it("turns the answer into a design proposal the teacher confirms", () => {
    const r = parseOutcomesDesign(JSON.stringify(answer), emptyCourseData());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposal.source).toBe("design");
    expect(r.proposal.assessments).toEqual([]);
    expect(r.proposal.weightsOff).toBe(false);
    expect(r.proposal.notes).toBe("Ik ging uit van hbo, jaar 1.");
    expect(r.proposal.outcomes).toEqual([
      {
        key: "o1",
        text: "Je ontwerpt een genormaliseerd datamodel voor een casus.",
        bloom: "create",
        verbatim: false,
        existing: false,
        criteria: [
          { text: "Het model staat in de derde normaalvorm.", verbatim: false },
          { text: "Elke tabel heeft een sleutel.", verbatim: false },
        ],
      },
      {
        key: "o2",
        text: "Je schrijft SQL-queries met joins.",
        bloom: "apply",
        verbatim: false,
        existing: false,
        criteria: [{ text: "De query geeft het gevraagde resultaat.", verbatim: false }],
      },
    ]);
  });

  it("drops empty outcomes and duplicates, and an unknown Bloom level", () => {
    const r = parseOutcomesDesign(
      JSON.stringify({
        outcomes: [
          { text: "  ", bloom: "apply" },
          { text: "Je schrijft SQL-queries met joins.", bloom: "toepassen" },
          { text: "je schrijft SQL-queries met joins", bloom: "apply" },
        ],
      }),
      emptyCourseData(),
    );
    expect(r.ok && r.proposal.outcomes).toEqual([
      {
        key: "o1",
        text: "Je schrijft SQL-queries met joins.",
        verbatim: false,
        existing: false,
        criteria: [],
      },
    ]);
  });

  it("keeps at most eight outcomes and four criteria each, and says it cut", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      text: `Je doet ding ${i + 1}.`,
      criteria: Array.from({ length: 6 }, (_, j) => `Criterium ${j + 1}.`),
    }));
    const r = parseOutcomesDesign(JSON.stringify({ outcomes: many }), emptyCourseData());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposal.outcomes).toHaveLength(DESIGN_LIMITS.outcomes);
    expect(r.proposal.outcomes[0]?.criteria).toHaveLength(DESIGN_LIMITS.criteria);
    expect(r.clipped).toBe(true);
  });

  it("marks an outcome the course already has", () => {
    const r = parseOutcomesDesign(
      JSON.stringify({ outcomes: [{ text: "Je ontwerpt een datamodel" }] }),
      alignedCourse(),
    );
    expect(r.ok && r.proposal.outcomes[0]?.existing).toBe(true);
  });

  it("reports an answer without outcomes, with the model's notes, and an unparseable one", () => {
    expect(
      parseOutcomesDesign(JSON.stringify({ outcomes: [], notes: "Te vaag." }), emptyCourseData()),
    ).toEqual({ ok: false, error: "empty", notes: "Te vaag." });
    expect(parseOutcomesDesign("Sorry, dat lukt niet.", emptyCourseData())).toEqual({
      ok: false,
      error: "unparseable",
    });
  });

  it("goes through the same review form and apply as an import", () => {
    const fd = new FormData();
    fd.append("outcomeKey", "o1");
    fd.set("o1.pick", "on");
    fd.set("o1.text", answer.outcomes[0]!.text);
    fd.set("o1.bloom", "create");
    fd.set("o1.extra", JSON.stringify({ criteria: [{ text: "Elke tabel heeft een sleutel." }] }));
    const selection = parseImportSelection(fd);
    expect(selection).not.toBeNull();
    const applied = applyImport(emptyCourseData(), selection!);
    expect(applied.ok && applied.data.outcomes[0]).toMatchObject({
      text: answer.outcomes[0]!.text,
      bloom: "create",
      criteria: [{ text: "Elke tabel heeft een sleutel." }],
    });
  });
});

describe("applyDesignBrief", () => {
  it("fills in the EC, the weeks and the description when the course has none", () => {
    const d = applyDesignBrief(emptyCourseData(), { description: DESCRIPTION, ec: 5, weeks: 8 });
    expect(d.ec).toBe(5);
    expect(d.schedule).toEqual({ weeks: 8 });
    expect(d.description).toBe(DESCRIPTION);
    expect(CourseDataSchema.safeParse(d).success).toBe(true);
  });

  it("never changes what is filled in", () => {
    const before = {
      ...emptyCourseData(),
      ec: 3,
      description: "Eigen tekst.",
      schedule: { weeks: 10, sessionsPerWeek: 2 },
    };
    const d = applyDesignBrief(before, { description: DESCRIPTION, ec: 5, weeks: 8 });
    expect(d.ec).toBe(3);
    expect(d.description).toBe("Eigen tekst.");
    expect(d.schedule).toEqual({ weeks: 10, sessionsPerWeek: 2 });
  });

  it("adds the weeks to a schedule without weeks", () => {
    const before = { ...emptyCourseData(), schedule: { sessionsPerWeek: 2 } };
    expect(applyDesignBrief(before, { description: DESCRIPTION, weeks: 8 }).schedule).toEqual({
      sessionsPerWeek: 2,
      weeks: 8,
    });
  });
});
