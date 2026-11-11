import { describe, expect, it } from "vitest";
import { applyCourseIntent } from "~/lib/courses/intents";
import { emptyCourseData } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";
import { ACT1, alignedCourse, itemizedCourse, LO1, LO2, QUIZ, TEST1 } from "./fixtures";

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

describe("applyCourseIntent (the form boundary of the course editor)", () => {
  it("adds, updates and removes a learning outcome", () => {
    let d = ok(emptyCourseData(), { intent: "add-outcome", text: " Je test. ", bloom: "apply" });
    expect(d.outcomes[0]).toMatchObject({ text: "Je test.", bloom: "apply" });
    const id = d.outcomes[0]!.id;
    d = ok(d, { intent: "update-outcome", id, text: "Je test software.", bloom: "" });
    expect(d.outcomes[0]).toEqual({ id, text: "Je test software." });
    d = ok(d, { intent: "remove-outcome", id });
    expect(d.outcomes).toEqual([]);
  });

  it("remove-outcome also removes references to it", () => {
    const d = ok(alignedCourse(), { intent: "remove-outcome", id: LO2 });
    expect(d.activities.find((a) => a.id === ACT1)?.outcomeIds).toEqual([]);
    expect(d.assessments.find((a) => a.id === QUIZ)?.coverage).toEqual([]);
  });

  it("adds and updates an activity with week, hours and outcomes", () => {
    let d = ok(alignedCourse(), {
      intent: "add-activity",
      title: "Werkcollege",
      kind: "assignment",
      week: "3",
      hours: "2,5",
      outcomeIds: [LO1, LO2],
    });
    const added = d.activities[2];
    expect(added).toMatchObject({ title: "Werkcollege", kind: "assignment", week: 3, hours: 2.5 });
    expect(added!.outcomeIds).toEqual([LO1, LO2]);
    d = ok(d, { intent: "update-activity", id: added!.id, title: "Werkcollege 1", kind: "lesson" });
    expect(d.activities[2]).toEqual({
      id: added!.id,
      title: "Werkcollege 1",
      kind: "lesson",
      outcomeIds: [],
    });
    d = ok(d, { intent: "remove-activity", id: added!.id });
    expect(d.activities).toHaveLength(2);
  });

  it("adds and updates an assessment with coverage and a Bloom level per outcome", () => {
    let d = ok(alignedCourse(), {
      intent: "add-assessment",
      title: "Tentamen",
      kind: "summative",
      week: "8",
      weight: "40",
      hours: "3",
      coverage: [LO1],
      [`bloom:${LO1}`]: "analyze",
      [`bloom:${LO2}`]: "remember",
    });
    const added = d.assessments[2];
    expect(added).toMatchObject({ title: "Tentamen", kind: "summative", week: 8, weight: 40 });
    // A Bloom level only counts for a checked outcome.
    expect(added!.coverage).toEqual([{ outcomeId: LO1, bloom: "analyze" }]);
    d = ok(d, {
      intent: "update-assessment",
      id: TEST1,
      title: "Eindopdracht",
      kind: "summative",
      coverage: [LO1, LO2],
      [`bloom:${LO1}`]: "",
    });
    expect(d.assessments[1]!.coverage).toEqual([{ outcomeId: LO1 }, { outcomeId: LO2 }]);
    expect(d.assessments[1]!.weight).toBeUndefined();
  });

  it("sets and clears whether an assessment is supervised (an empty choice means not set)", () => {
    let d = ok(alignedCourse(), {
      intent: "add-assessment",
      title: "Verslag",
      kind: "summative",
      supervised: "no",
    });
    expect(d.assessments[2]!.supervised).toBe(false);
    d = ok(d, {
      intent: "update-assessment",
      id: TEST1,
      title: "Eindopdracht",
      kind: "summative",
      supervised: "yes",
    });
    expect(d.assessments[1]!.supervised).toBe(true);
    d = ok(d, { intent: "update-assessment", id: TEST1, title: "Eindopdracht", kind: "summative" });
    expect("supervised" in d.assessments[1]!).toBe(false);
    const r = applyCourseIntent(
      alignedCourse(),
      form({ intent: "add-assessment", title: "X", kind: "summative", supervised: "maybe" }),
    );
    expect(r).toEqual({ ok: false, error: "invalid" });
  });

  it("sets and clears the course's EC", () => {
    let d = ok(alignedCourse(), { intent: "set-ec", ec: "7,5" });
    expect(d.ec).toBe(7.5);
    d = ok(d, { intent: "set-ec", ec: "" });
    expect(d.ec).toBeUndefined();
  });

  it("sets and clears the course's start date (P22.1)", () => {
    let d = ok(alignedCourse(), { intent: "set-start-date", startDate: "2026-09-02" });
    expect(d.startDate).toBe("2026-09-02");
    d = ok(d, { intent: "set-start-date", startDate: "" });
    expect(d.startDate).toBeUndefined();
    expect("startDate" in d).toBe(false);
    const r = applyCourseIntent(
      alignedCourse(),
      form({ intent: "set-start-date", startDate: "2026-02-30" }),
    );
    expect(r).toEqual({ ok: false, error: "invalid" });
  });

  // The course's rhythm, filled in once: the wizard and Les voorbereiden read it. All optional.
  it("sets and clears the course's schedule", () => {
    let d = ok(alignedCourse(), {
      intent: "set-schedule",
      weeks: "10",
      sessionsPerWeek: "3",
      sessionMinutes: "240",
      groupSize: "28",
      deliveryMode: "hybrid",
    });
    expect(d.schedule).toEqual({
      weeks: 10,
      sessionsPerWeek: 3,
      sessionMinutes: 240,
      groupSize: 28,
      deliveryMode: "hybrid",
    });
    d = ok(d, { intent: "set-schedule", weeks: "", sessionMinutes: "90", deliveryMode: "" });
    expect(d.schedule).toEqual({ sessionMinutes: 90 });
    d = ok(d, { intent: "set-schedule" });
    expect("schedule" in d).toBe(false);
  });

  // Disciplines are optional: a module of several subjects, each with its own hours per week.
  it("adds, updates and removes a discipline; removing it frees its lessons", () => {
    let d = ok(alignedCourse(), {
      intent: "add-discipline",
      name: "Webtech",
      teacher: "Sanne",
      hoursPerWeek: "6",
    });
    const disc = d.disciplines![0]!;
    expect(disc).toMatchObject({ name: "Webtech", teacher: "Sanne", hoursPerWeek: 6 });
    d = ok(d, { intent: "update-discipline", id: disc.id, name: "Webtechnologie", teacher: "" });
    expect(d.disciplines![0]).toEqual({ id: disc.id, name: "Webtechnologie" });
    d = ok(d, {
      intent: "update-activity",
      id: ACT1,
      title: "Les 1",
      kind: "lesson",
      disciplineId: disc.id,
    });
    expect(d.activities.find((a) => a.id === ACT1)?.disciplineId).toBe(disc.id);
    d = ok(d, { intent: "remove-discipline", id: disc.id });
    expect("disciplines" in d).toBe(false);
    expect(d.activities.find((a) => a.id === ACT1)).not.toHaveProperty("disciplineId");
  });

  it("refuses a lesson with an unknown discipline, and a discipline without a name", () => {
    const bad = (fields: Record<string, string>) =>
      applyCourseIntent(alignedCourse(), form(fields));
    expect(
      bad({ intent: "add-activity", title: "a", kind: "lesson", disciplineId: "ghost" }),
    ).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(bad({ intent: "add-discipline", name: "" })).toEqual({ ok: false, error: "invalid" });
    expect(bad({ intent: "remove-discipline", id: "ghost" })).toEqual({
      ok: false,
      error: "not-found",
    });
  });

  it("refuses a schedule out of range or with an unknown delivery mode", () => {
    const bad = (fields: Record<string, string>) =>
      applyCourseIntent(alignedCourse(), form({ intent: "set-schedule", ...fields }));
    expect(bad({ weeks: "61" })).toEqual({ ok: false, error: "invalid" });
    expect(bad({ sessionsPerWeek: "2.5" })).toEqual({ ok: false, error: "invalid" });
    expect(bad({ sessionMinutes: "5" })).toEqual({ ok: false, error: "invalid" });
    expect(bad({ groupSize: "0" })).toEqual({ ok: false, error: "invalid" });
    expect(bad({ deliveryMode: "carrier-pigeon" })).toEqual({ ok: false, error: "invalid" });
  });

  it("refuses invalid input", () => {
    const bad = (fields: Record<string, string | string[]>) =>
      applyCourseIntent(alignedCourse(), form(fields));
    expect(bad({ intent: "nonsense" })).toEqual({ ok: false, error: "invalid" });
    expect(bad({ intent: "add-outcome", text: "" })).toEqual({ ok: false, error: "invalid" });
    expect(bad({ intent: "add-outcome", text: "x".repeat(1001) })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(bad({ intent: "add-outcome", text: "a", bloom: "memorize" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(bad({ intent: "add-activity", title: "a", kind: "lesson", week: "61" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(
      bad({ intent: "add-activity", title: "a", kind: "lesson", outcomeIds: ["ghost"] }),
    ).toEqual({ ok: false, error: "invalid" });
    expect(bad({ intent: "set-ec", ec: "abc" })).toEqual({ ok: false, error: "invalid" });
  });

  it("reports an unknown item as not-found", () => {
    expect(applyCourseIntent(alignedCourse(), form({ intent: "remove-outcome", id: "x" }))).toEqual(
      { ok: false, error: "not-found" },
    );
    expect(
      applyCourseIntent(
        alignedCourse(),
        form({ intent: "update-activity", id: "x", title: "a", kind: "lesson" }),
      ),
    ).toEqual({ ok: false, error: "not-found" });
  });

  it("adds, updates and removes a question of the matrix (P26.1)", () => {
    let d = ok(alignedCourse(), {
      intent: "add-item",
      assessmentId: TEST1,
      label: " 1a ",
      outcomeId: LO1,
      bloom: "create",
      format: "open",
      points: "2,5",
    });
    const item = d.assessments[1]!.items![0];
    expect(item).toMatchObject({
      label: "1a",
      outcomeId: LO1,
      bloom: "create",
      format: "open",
      points: 2.5,
    });
    d = ok(d, {
      intent: "update-item",
      assessmentId: TEST1,
      id: item!.id,
      label: "2",
      outcomeId: LO2,
      bloom: "",
      format: "",
      points: "",
    });
    expect(d.assessments[1]!.items).toEqual([{ id: item!.id, label: "2", outcomeId: LO2 }]);
    d = ok(d, { intent: "remove-item", assessmentId: TEST1, id: item!.id });
    expect(d.assessments[1]!.items).toEqual([]);
  });

  it("add-item numbers the question when the label is left empty", () => {
    const d = ok(itemizedCourse(), {
      intent: "add-item",
      assessmentId: TEST1,
      label: "",
      outcomeId: LO2,
    });
    expect(d.assessments[1]!.items!.at(-1)).toMatchObject({ label: "5", outcomeId: LO2 });
  });

  it("refuses an invalid question and reports unknown ones as not-found", () => {
    const bad = (f: Record<string, string>) => applyCourseIntent(itemizedCourse(), form(f));
    const add = { intent: "add-item", assessmentId: TEST1, label: "1", outcomeId: LO1 };
    expect(bad({ ...add, outcomeId: "ghost" })).toEqual({ ok: false, error: "invalid" });
    expect(bad({ ...add, points: "1001" })).toEqual({ ok: false, error: "invalid" });
    expect(bad({ ...add, format: "essay" })).toEqual({ ok: false, error: "invalid" });
    expect(bad({ ...add, label: "x".repeat(21) })).toEqual({ ok: false, error: "invalid" });
    expect(bad({ ...add, assessmentId: "nope" })).toEqual({ ok: false, error: "not-found" });
    expect(bad({ intent: "remove-item", assessmentId: TEST1, id: "nope" })).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(
      bad({ intent: "update-item", assessmentId: TEST1, id: "q-1", label: "", outcomeId: LO1 }),
    ).toEqual({ ok: false, error: "invalid" });
  });

  it("update-assessment keeps the hand-set coverage of an assessment with questions", () => {
    const d = ok(itemizedCourse(), {
      intent: "update-assessment",
      id: TEST1,
      title: "Eindtoets",
      kind: "summative",
    });
    expect(d.assessments[1]!.coverage).toEqual(itemizedCourse().assessments[1]!.coverage);
    expect(d.assessments[1]!.items).toHaveLength(4);
  });
});
