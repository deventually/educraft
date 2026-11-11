import { describe, expect, it } from "vitest";
import {
  anchorKind,
  anchorOptions,
  anchorPart,
  anchorQuestion,
  anchorToolQuery,
  anchorValue,
  daysUntil,
  parseAnchorValue,
  snapshotCriteria,
} from "~/lib/portfolio/anchors";
import { applyExtraction } from "~/lib/portfolio/extract";
import { applyIntent } from "~/lib/portfolio/intents";
import * as edit from "~/lib/portfolio/edit";
import { DossierDataSchema, emptyDossier, LIMITS } from "~/lib/portfolio/schema";
import { START_STEPS, startHref, startStep } from "~/lib/portfolio/start";
import type { CourseData } from "~/lib/courses/types";
import { LU, sampleDossier } from "./fixtures";

const course: Pick<CourseData, "activities" | "assessments"> = {
  activities: [
    { id: "les-1", title: "Les 1: normaliseren", kind: "lesson", outcomeIds: [], week: 1 },
    { id: "opdr-1", title: "Opdracht ERD", kind: "assignment", outcomeIds: [] },
  ],
  assessments: [{ id: "toets-1", title: "Eindtoets", kind: "summative", coverage: [] }],
};

function fd(fields: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const value of Array.isArray(v) ? v : [v]) f.append(k, value);
  }
  return f;
}
const ctx = { now: 1_000, locale: "nl" as const };

describe("the anchor in a dossier", () => {
  it("keeps an anchor per outcome and a deadline; old dossiers without them stay valid", () => {
    expect(DossierDataSchema.safeParse(sampleDossier()).success).toBe(true);
    const d = {
      ...sampleDossier(),
      anchors: {
        [LU]: { course: { courseId: "c1", itemId: "les-1" }, description: "Les over normaliseren" },
      },
      deadline: "2026-12-01",
    };
    expect(DossierDataSchema.safeParse(d).success).toBe(true);
  });

  it("refuses an anchor for an unknown outcome, an empty anchor and a bad date", () => {
    const base = sampleDossier();
    expect(
      DossierDataSchema.safeParse({ ...base, anchors: { nope: { description: "x" } } }).success,
    ).toBe(false);
    expect(DossierDataSchema.safeParse({ ...base, anchors: { [LU]: {} } }).success).toBe(false);
    expect(DossierDataSchema.safeParse({ ...base, deadline: "1 december" }).success).toBe(false);
    const long = "x".repeat(LIMITS.anchorDescription + 1);
    expect(
      DossierDataSchema.safeParse({ ...base, anchors: { [LU]: { description: long } } }).success,
    ).toBe(false);
  });

  it("drops the anchor with its outcome, and when the framework is extracted again", () => {
    const d = { ...sampleDossier(), anchors: { [LU]: { description: "Mijn les" } } };
    expect(edit.removeOutcome(d, LU).anchors).toEqual({});
    const fresh = { ...emptyDossier(["bdb"]), framework: d.framework, anchors: d.anchors };
    const r = applyExtraction(fresh, { ...d.framework, outcomes: [] });
    expect(r.ok && r.data.anchors).toBeUndefined();
  });
});

describe("intents of the start wizard", () => {
  it("sets the tracks and the institution, never without a track", () => {
    const r = applyIntent(
      emptyDossier(["bdb"]),
      fd({ intent: "track", tracks: ["bdb", "bke"], institution: " Hogeschool Y " }),
      ctx,
    );
    expect(r.ok && r.data.tracks).toEqual(["bdb", "bke"]);
    expect(r.ok && r.data.framework.institution).toBe("Hogeschool Y");
    expect(applyIntent(emptyDossier(["bdb"]), fd({ intent: "track" }), ctx)).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("sets and clears the deadline", () => {
    const set = applyIntent(
      sampleDossier(),
      fd({ intent: "deadline", deadline: "2026-12-01" }),
      ctx,
    );
    expect(set.ok && set.data.deadline).toBe("2026-12-01");
    const cleared = applyIntent(
      set.ok ? set.data : sampleDossier(),
      fd({ intent: "deadline", deadline: "" }),
      ctx,
    );
    expect(cleared.ok && "deadline" in cleared.data).toBe(false);
    expect(
      applyIntent(sampleDossier(), fd({ intent: "deadline", deadline: "morgen" }), ctx).ok,
    ).toBe(false);
  });
});

describe("anchor choices", () => {
  it("offers the whole course as a module, its lessons and assignments, and its tests", () => {
    expect(anchorOptions({ id: "c1", data: course })).toEqual([
      { value: "c1", kind: "module", title: "" },
      { value: "c1:les-1", kind: "lesson", title: "Les 1: normaliseren" },
      { value: "c1:opdr-1", kind: "lesson", title: "Opdracht ERD" },
      { value: "c1:toets-1", kind: "test", title: "Eindtoets" },
    ]);
  });

  it("round-trips a form value and knows what it points at", () => {
    expect(parseAnchorValue(anchorValue({ courseId: "c1", itemId: "les-1" }))).toEqual({
      courseId: "c1",
      itemId: "les-1",
    });
    expect(parseAnchorValue("c1")).toEqual({ courseId: "c1" });
    expect(parseAnchorValue("")).toBeNull();
    expect(parseAnchorValue("a:b:c")).toBeNull();
    expect(anchorKind(course, undefined)).toBe("module");
    expect(anchorKind(course, "les-1")).toBe("lesson");
    expect(anchorKind(course, "toets-1")).toBe("test");
    expect(anchorKind(course, "weg")).toBeNull();
  });

  it("takes the course as evidence for a module or a test, not for a lesson", () => {
    expect(anchorPart(course, { courseId: "c1" })).toBe("outcomes-and-matrix");
    expect(anchorPart(course, { courseId: "c1", itemId: "toets-1" })).toEqual({
      assessmentId: "toets-1",
    });
    expect(anchorPart(course, { courseId: "c1", itemId: "les-1" })).toBeNull();
  });

  it("links a snapshot only to criteria about alignment or a blueprint", () => {
    const outcome = sampleDossier().framework.outcomes[0]!;
    expect(snapshotCriteria(outcome)).toEqual([]);
    const aligned = {
      ...outcome,
      criteria: [
        ...outcome.criteria,
        { id: "c9", text: "De toetsmatrijs dekt de leeruitkomsten." },
      ],
    };
    expect(snapshotCriteria(aligned)).toEqual(["c9"]);
  });

  it("opens a tool on the anchor's course and item, and on nothing without a course", () => {
    expect(anchorToolQuery({ course: { courseId: "c1", itemId: "les-1" } })).toEqual({
      course: "c1",
      item: "les-1",
    });
    expect(anchorToolQuery({ course: { courseId: "c1" } })).toEqual({ course: "c1" });
    expect(anchorToolQuery({ description: "Mijn les" })).toEqual({});
    expect(anchorToolQuery(undefined)).toEqual({});
  });
});

describe("the question per outcome", () => {
  it("asks for a lesson, guidance, a module, a test or the teacher, on the title only", () => {
    const q = (title: string) => anchorQuestion({ title });
    expect(q("Doceren")).toBe("lesson");
    expect(q("Begeleiden")).toBe("guidance");
    expect(q("Ontwerpen")).toBe("module");
    expect(q("Toetsontwikkeling")).toBe("test");
    expect(q("Een toets ontwerpen")).toBe("test");
    expect(q("Professioneel docentschap")).toBe("self");
    expect(q("Iets anders")).toBe("other");
  });
});

describe("the wizard's steps and the deadline", () => {
  it("has four steps, each with its own address", () => {
    expect(START_STEPS).toEqual(["track", "framework", "anchors", "planning"]);
    expect(startStep("anchors")).toBe("anchors");
    expect(startStep("nope")).toBe("track");
    expect(startHref("d 1", "planning")).toBe("/portfolio/d%201/start?step=planning");
  });

  it("counts whole days to the deadline", () => {
    const now = Date.parse("2026-11-11T21:00:00Z");
    expect(daysUntil("2026-11-20", now)).toBe(9);
    expect(daysUntil("2026-11-11", now)).toBe(0);
    expect(daysUntil("2026-11-01", now)).toBe(-10);
  });
});
