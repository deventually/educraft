import { describe, expect, it } from "vitest";
import {
  applyImport,
  type ImportSelection,
  parseImport,
  parseImportSelection,
} from "~/lib/courses/import";
import { CourseDataSchema, emptyCourseData } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";

// A fictional toetsmatrijs and nakijkmodel, as text comes out of Word: no institution material.
const DOC = `Toetsmatrijs Databases (DB1), studiejaar 2026-2027
Toetseigenaar: Docent A. Toetsvorm: Andere wijze. Beoordeling: voldoende/onvoldoende.
LU1 Je ontwerpt een datamodel.
S-An 1.1 De student registreert requirements.
Cesuur: 75%
Voorwaarden: Alle opdrachten ingeleverd.
Herkansing in week 10.
Nakijkmodel
Onderdeel Datamodel (knock-out), weging 60%
Onvoldoende: Het model ontbreekt.
Voldoende: Het model werkt.`;

const answer = {
  module: { code: "DB1", studyYear: "2026-2027" },
  outcomes: [
    {
      text: "Je ontwerpt een datamodel.",
      bloomProposal: "create",
      criteria: [
        { code: "S-An 1.1", text: "De student registreert requirements." },
        { code: null, text: "De student verzint iets." },
      ],
    },
  ],
  assessments: [
    {
      title: "Eindopdracht",
      kind: "summative",
      weight: 100,
      week: 9,
      outcomeRefs: [1],
      form: "Andere wijze",
      owner: "Docent A",
      grading: "pass-fail",
      passMark: 75,
      conditions: ["Alle opdrachten ingeleverd."],
      resit: "Herkansing in week 10.",
      conduct: null,
      parts: [
        {
          title: "Datamodel",
          outcomeRefs: [1, 7],
          weight: 60,
          knockOut: true,
          pass: "Het model werkt.",
          fail: "Het model ontbreekt.",
        },
      ],
    },
  ],
  notes: null,
};

const proposal = (raw: unknown = answer, course = emptyCourseData()) => {
  const r = parseImport(JSON.stringify(raw), DOC, course);
  if (!r.ok) throw new Error("expected a proposal");
  return r;
};

describe("parseImport: what a toetsmatrijs and a nakijkmodel add", () => {
  it("reads the module code and study year", () => {
    expect(proposal().proposal.module).toEqual({ code: "DB1", studyYear: "2026-2027" });
  });

  it("reads success criteria and marks one that is not in the document", () => {
    const r = proposal();
    expect(r.proposal.outcomes[0]?.criteria).toEqual([
      { code: "S-An 1.1", text: "De student registreert requirements.", verbatim: true },
      { text: "De student verzint iets.", verbatim: false },
    ]);
    expect(r.flagged).toBe(1);
  });

  it("reads the test details and its parts, linked to the outcomes in the proposal", () => {
    const a = proposal().proposal.assessments[0]!;
    expect(a.details).toEqual({
      form: "Andere wijze",
      owner: "Docent A",
      grading: "pass-fail",
      passMark: 75,
      conditions: ["Alle opdrachten ingeleverd."],
      resit: "Herkansing in week 10.",
    });
    expect(a.parts).toEqual([
      {
        title: "Datamodel",
        outcomeKeys: ["o1"],
        weight: 60,
        knockOut: true,
        pass: "Het model werkt.",
        fail: "Het model ontbreekt.",
        verbatim: true,
      },
    ]);
  });

  it("drops what is off instead of guessing: an unknown grading, a pass mark over 100", () => {
    const bad = structuredClone(answer);
    Object.assign(bad.assessments[0]!, { grading: "letters", passMark: 120 });
    const d = proposal(bad).proposal.assessments[0]!.details;
    expect(d.grading).toBeUndefined();
    expect(d.passMark).toBeUndefined();
  });

  it("still reads an answer without any of the new keys (a study guide)", () => {
    const old = {
      outcomes: [{ text: "Je ontwerpt een datamodel.", bloomProposal: null }],
      assessments: [{ title: "Eindopdracht", kind: null, weight: null, week: null }],
      notes: null,
    };
    const r = proposal(old).proposal;
    expect(r.module).toBeUndefined();
    expect(r.outcomes[0]?.criteria).toEqual([]);
    expect(r.assessments[0]?.details).toEqual({});
    expect(r.assessments[0]?.parts).toEqual([]);
  });
});

/** The review form as the browser posts it, from a proposal. */
function form(extra: (fd: FormData) => void = () => {}): FormData {
  const p = proposal().proposal;
  const fd = new FormData();
  fd.set("module.pick", "on");
  fd.set("module.code", "DB1");
  fd.set("module.studyYear", "2026-2027");
  for (const o of p.outcomes) {
    fd.append("outcomeKey", o.key);
    fd.set(`${o.key}.pick`, "on");
    fd.set(`${o.key}.text`, o.text);
    fd.set(`${o.key}.extra`, JSON.stringify({ criteria: o.criteria }));
  }
  for (const a of p.assessments) {
    fd.append("assessmentKey", a.key);
    fd.set(`${a.key}.pick`, "on");
    fd.set(`${a.key}.title`, a.title);
    fd.set(`${a.key}.kind`, "summative");
    for (const k of a.outcomeKeys) fd.append(`${a.key}.outcomes`, k);
    fd.set(`${a.key}.extra`, JSON.stringify({ details: a.details, parts: a.parts }));
  }
  extra(fd);
  return fd;
}

describe("parseImportSelection: the extra details travel with each row", () => {
  it("reads the module, the criteria, the details and the parts", () => {
    const s = parseImportSelection(form())!;
    expect(s.module).toEqual({ code: "DB1", studyYear: "2026-2027" });
    expect(s.outcomes[0]?.criteria).toEqual([
      { code: "S-An 1.1", text: "De student registreert requirements." },
      { text: "De student verzint iets." },
    ]);
    expect(s.assessments[0]?.details?.passMark).toBe(75);
    expect(s.assessments[0]?.parts?.[0]).toMatchObject({ title: "Datamodel", outcomeKeys: ["o1"] });
  });

  it("leaves the module out when it is not ticked", () => {
    expect(parseImportSelection(form((fd) => fd.delete("module.pick")))?.module).toBeUndefined();
  });

  it("refuses extra data that is not valid, or a part pointing at an unknown outcome", () => {
    expect(parseImportSelection(form((fd) => fd.set("o1.extra", "{not json")))).toBeNull();
    expect(
      parseImportSelection(
        form((fd) =>
          fd.set(
            "a1.extra",
            JSON.stringify({ details: {}, parts: [{ title: "X", outcomeKeys: ["o9"] }] }),
          ),
        ),
      ),
    ).toBeNull();
    expect(
      parseImportSelection(
        form((fd) => fd.set("a1.extra", JSON.stringify({ details: { passMark: 200 }, parts: [] }))),
      ),
    ).toBeNull();
  });
});

describe("applyImport: a whole module in one go, and only filling in what is empty", () => {
  const apply = (d: CourseData, fd = form()) => {
    const r = applyImport(d, parseImportSelection(fd) as ImportSelection);
    if (!r.ok) throw new Error(r.error);
    return r.data;
  };

  it("fills an empty course: module, outcome with criteria, test with details and parts", () => {
    const d = apply(emptyCourseData());
    expect(CourseDataSchema.safeParse(d).success).toBe(true);
    expect(d).toMatchObject({ code: "DB1", studyYear: "2026-2027" });
    const o = d.outcomes[0]!;
    expect(o.criteria).toHaveLength(2);
    const a = d.assessments[0]!;
    expect(a).toMatchObject({ owner: "Docent A", grading: "pass-fail", passMark: 75 });
    expect(a.parts?.[0]).toMatchObject({ title: "Datamodel", outcomeIds: [o.id], knockOut: true });
  });

  it("completes what the course already has, without changing what is filled in", () => {
    const first = apply(emptyCourseData());
    const before = structuredClone(first);
    // The course already has a code, criteria and a pass mark of its own.
    first.code = "OWN";
    first.outcomes[0]!.criteria = [{ text: "Eigen criterium." }];
    const a = first.assessments[0]!;
    a.passMark = 55;
    delete a.owner;
    delete a.parts;
    const d = apply(first);
    expect(d.code).toBe("OWN");
    expect(d.studyYear).toBe(before.studyYear);
    expect(d.outcomes).toHaveLength(1);
    expect(d.outcomes[0]?.criteria).toEqual([{ text: "Eigen criterium." }]);
    expect(d.assessments).toHaveLength(1);
    expect(d.assessments[0]).toMatchObject({ passMark: 55, owner: "Docent A" });
    expect(d.assessments[0]?.parts).toHaveLength(1);
  });

  it("does not add parts to a test that already has parts, nor complete an unticked row", () => {
    const first = apply(emptyCourseData());
    delete first.assessments[0]!.owner;
    const d = apply(
      first,
      form((fd) => fd.delete("a1.pick")),
    );
    expect(d.assessments[0]?.owner).toBeUndefined();
    expect(apply(first).assessments[0]?.parts).toHaveLength(1);
  });
});

describe("the module guide and handbook details (course-import@v3)", () => {
  const guide = {
    ...answer,
    module: {
      code: "DB1",
      studyYear: "2026-2027",
      phase: "Propedeuse, semester 1",
      leader: "Docent A",
      examiners: "Docenten Informatica",
      description: "In deze module ontwerp je databases.",
      literature: "Boek over databases.\nArtikel over normaliseren.",
    },
  };

  it("proposes the study phase, module leader, examiners, description and literature", () => {
    expect(proposal(guide).proposal.module).toEqual(guide.module);
    const empty = { ...guide, module: { ...guide.module, leader: "  ", literature: null } };
    expect(proposal(empty).proposal.module).not.toHaveProperty("leader");
    expect(proposal(empty).proposal.module).not.toHaveProperty("literature");
  });

  const withGuide = () =>
    form((fd) => {
      fd.set("module.phase", "Propedeuse, semester 1");
      fd.set("module.leader", "Docent A");
      fd.set("module.examiners", "Docenten Informatica");
      fd.set("module.description", "In deze module ontwerp je databases.");
      fd.set("module.literature", "Boek over databases.");
    });

  it("reads them from the review form", () => {
    expect(parseImportSelection(withGuide())?.module).toEqual({
      code: "DB1",
      studyYear: "2026-2027",
      phase: "Propedeuse, semester 1",
      leader: "Docent A",
      examiners: "Docenten Informatica",
      description: "In deze module ontwerp je databases.",
      literature: "Boek over databases.",
    });
    expect(
      parseImportSelection(form((fd) => fd.set("module.description", "x".repeat(3_001)))),
    ).toBeNull();
  });

  it("fills them in only where the course has nothing yet", () => {
    const course = { ...emptyCourseData(), leader: "Eigen leider" };
    const r = applyImport(course, parseImportSelection(withGuide()) as ImportSelection);
    if (!r.ok) throw new Error(r.error);
    expect(CourseDataSchema.safeParse(r.data).success).toBe(true);
    expect(r.data).toMatchObject({
      leader: "Eigen leider",
      phase: "Propedeuse, semester 1",
      examiners: "Docenten Informatica",
      description: "In deze module ontwerp je databases.",
      literature: "Boek over databases.",
    });
  });
});
