import { describe, expect, it } from "vitest";
import { applyCourseIntent } from "~/lib/courses/intents";
import { CourseDataSchema } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";
import { alignedCourse, LO1, LO2, TEST1 } from "./fixtures";

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields))
    for (const value of Array.isArray(v) ? v : [v]) fd.append(k, value);
  return fd;
}

function ok(d: CourseData, fields: Record<string, string | string[]>): CourseData {
  const r = applyCourseIntent(d, form(fields));
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
  return r.data;
}

const refused = (d: CourseData, fields: Record<string, string | string[]>) =>
  applyCourseIntent(d, form(fields));

const test1 = (d: CourseData) => d.assessments.find((a) => a.id === TEST1)!;

describe("success criteria on a learning outcome", () => {
  it("reads one criterion per line, with an optional short code before a colon", () => {
    const d = ok(alignedCourse(), {
      intent: "update-outcome",
      id: LO1,
      text: "Je ontwerpt een datamodel.",
      criteria:
        "S-An 1.1: De student registreert requirements.\n\n Het model is genormaliseerd. \n",
    });
    expect(d.outcomes[0]!.criteria).toEqual([
      { code: "S-An 1.1", text: "De student registreert requirements." },
      { text: "Het model is genormaliseerd." },
    ]);
  });

  it("clears them with an empty field, and the schema keeps them", () => {
    let d = ok(alignedCourse(), {
      intent: "update-outcome",
      id: LO1,
      text: "Je ontwerpt een datamodel.",
      criteria: "Het model klopt.",
    });
    expect(CourseDataSchema.safeParse(d).success).toBe(true);
    d = ok(d, { intent: "update-outcome", id: LO1, text: "Je ontwerpt.", criteria: "" });
    expect(d.outcomes[0]!.criteria).toBeUndefined();
  });
});

describe("module details of the course", () => {
  it("sets and clears the module code and the study year", () => {
    let d = ok(alignedCourse(), { intent: "set-module", code: " HELWO ", studyYear: "2026-2027" });
    expect(d).toMatchObject({ code: "HELWO", studyYear: "2026-2027" });
    d = ok(d, { intent: "set-module", code: "", studyYear: "" });
    expect(d.code).toBeUndefined();
    expect(d.studyYear).toBeUndefined();
  });
});

describe("test details for the blueprint and the marking model", () => {
  const details = {
    intent: "update-assessment-details",
    id: TEST1,
    form: "Andere wijze",
    owner: "Docent A",
    grading: "pass-fail",
    passMark: "75",
    conditions: "Alle opdrachten ingeleverd.\nDeelgenomen aan het gesprek.",
    resit: "In week 10, met een vervangende opdracht.",
    conduct: "Op een laptop van de school, zonder AI.",
  };

  it("stores the details, and leaves the rest of the test alone", () => {
    const d = ok(alignedCourse(), details);
    expect(test1(d)).toMatchObject({
      title: "Eindopdracht",
      weight: 100,
      form: "Andere wijze",
      owner: "Docent A",
      grading: "pass-fail",
      passMark: 75,
      conditions: ["Alle opdrachten ingeleverd.", "Deelgenomen aan het gesprek."],
      resit: "In week 10, met een vervangende opdracht.",
      conduct: "Op een laptop van de school, zonder AI.",
    });
    expect(CourseDataSchema.safeParse(d).success).toBe(true);
  });

  it("clears what is left empty", () => {
    let d = ok(alignedCourse(), details);
    d = ok(d, { intent: "update-assessment-details", id: TEST1, grading: "" });
    for (const key of ["form", "owner", "grading", "passMark", "conditions", "resit", "conduct"])
      expect(test1(d)).not.toHaveProperty(key);
  });

  it("refuses a pass mark above 100 and an unknown grading", () => {
    expect(refused(alignedCourse(), { ...details, passMark: "120" }).ok).toBe(false);
    expect(refused(alignedCourse(), { ...details, grading: "letters" }).ok).toBe(false);
  });
});

describe("parts of a test (onderdelen)", () => {
  const part = {
    intent: "add-part",
    assessmentId: TEST1,
    title: "Groep softwareproduct",
    outcomeIds: [LO1, LO2],
    weight: "25",
    knockOut: "on",
    pass: "De applicatie werkt.\nDe code is DRY.",
    fail: "",
  };

  it("adds, updates and removes a part", () => {
    let d = ok(alignedCourse(), part);
    const p = test1(d).parts![0]!;
    expect(p).toMatchObject({
      title: "Groep softwareproduct",
      outcomeIds: [LO1, LO2],
      weight: 25,
      knockOut: true,
      pass: "De applicatie werkt.\nDe code is DRY.",
    });
    expect(p).not.toHaveProperty("fail");
    d = ok(d, { ...part, intent: "update-part", id: p.id, outcomeIds: [LO2], weight: "" });
    expect(test1(d).parts![0]).toEqual({
      id: p.id,
      title: "Groep softwareproduct",
      outcomeIds: [LO2],
      knockOut: true,
      pass: "De applicatie werkt.\nDe code is DRY.",
    });
    d = ok(d, { intent: "remove-part", assessmentId: TEST1, id: p.id });
    expect(test1(d).parts).toEqual([]);
  });

  it("refuses an unknown learning outcome or test", () => {
    expect(refused(alignedCourse(), { ...part, outcomeIds: ["nope"] }).ok).toBe(false);
    expect(refused(alignedCourse(), { ...part, assessmentId: "nope" })).toEqual({
      ok: false,
      error: "not-found",
    });
  });

  it("removing a learning outcome removes it from the parts too", () => {
    let d = ok(alignedCourse(), part);
    d = ok(d, { intent: "remove-outcome", id: LO1 });
    expect(test1(d).parts![0]!.outcomeIds).toEqual([LO2]);
    expect(CourseDataSchema.safeParse(d).success).toBe(true);
  });

  it("the schema refuses a part that points to an unknown outcome", () => {
    const d = alignedCourse();
    test1(d).parts = [{ id: "p1", title: "X", outcomeIds: ["nope"] }];
    expect(CourseDataSchema.safeParse(d).success).toBe(false);
  });
});
