import { describe, expect, it } from "vitest";
import * as edit from "~/lib/portfolio/edit";
import { applyIntent } from "~/lib/portfolio/intents";
import {
  DEFAULT_HOURS_PER_DAY,
  dayPlan,
  hoursOf,
  PLAN_MINUTES,
  remainingWork,
  workdaysBetween,
} from "~/lib/portfolio/plan";
import { DossierDataSchema, emptyDossier } from "~/lib/portfolio/schema";
import { C1, C2, LU, sampleDossier } from "./fixtures";

/** C1 has evidence and is shown, C2 has neither; the chapter is started. */
const confirmed = () => edit.confirmFramework(sampleDossier(), 1);

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}
const ctx = { now: 1_000, locale: "nl" as const };

describe("remainingWork", () => {
  it("adds up what is still open per milestone, with fixed rates and no AI", () => {
    const w = remainingWork(confirmed());
    // Evidence 2 of 4 (C2 and the recording), chapter started, coach 1 of 2, shown 1 of 2.
    const lu = PLAN_MINUTES.evidence * 2 + PLAN_MINUTES.review + PLAN_MINUTES.shown;
    expect(w.items).toEqual([
      { id: LU, kind: "outcome", outcomeId: LU, minutes: lu },
      { id: "finish", kind: "finish", minutes: PLAN_MINUTES.finish },
    ]);
    expect(w.minutes).toBe(lu + PLAN_MINUTES.finish);
  });

  it("counts a start and writing per criterion while the chapter is empty", () => {
    const d = { ...confirmed(), chapters: [] };
    const lu = remainingWork(d).items.find((i) => i.kind === "outcome")!;
    expect(lu.minutes).toBe(
      PLAN_MINUTES.evidence * 2 +
        PLAN_MINUTES.chapterStart +
        PLAN_MINUTES.chapter * 2 +
        PLAN_MINUTES.review +
        PLAN_MINUTES.shown,
    );
  });

  it("counts checking an unconfirmed framework, and getting one when there is none", () => {
    expect(remainingWork(sampleDossier()).items[0]).toEqual({
      id: "framework",
      kind: "framework",
      minutes: PLAN_MINUTES.frameworkCheck,
    });
    const empty = remainingWork(emptyDossier(["bdb"]));
    expect(empty.items.map((i) => [i.kind, i.minutes])).toEqual([
      ["framework", PLAN_MINUTES.framework],
      ["finish", PLAN_MINUTES.finish],
    ]);
  });

  it("leaves out an outcome that is done", () => {
    let d = edit.updateEvidence(confirmed(), sampleDossier().evidence[0]!.id, {
      criterionIds: [C1, C2],
    });
    d = edit.addEvidence(d, {
      title: "Opname",
      kind: "observation-notes",
      text: "",
      criterionIds: [C1],
    });
    d = edit.setStatus(d, C2, "shown");
    expect(remainingWork(d).items.map((i) => i.kind)).toEqual(["finish"]);
  });
});

describe("hoursOf", () => {
  it("rounds up to half hours, and says nothing for no work", () => {
    expect(hoursOf(0)).toBe(0);
    expect(hoursOf(5)).toBe(0.5);
    expect(hoursOf(55)).toBe(1);
    expect(hoursOf(95)).toBe(2);
    expect(hoursOf(240)).toBe(4);
  });
});

describe("workdaysBetween", () => {
  it("counts Monday to Friday from the first day up to, not including, the last", () => {
    // 2026-11-12 is a Thursday.
    expect(workdaysBetween("2026-11-12", "2026-11-20")).toBe(6);
    expect(workdaysBetween("2026-11-12", "2026-11-12")).toBe(0);
    expect(workdaysBetween("2026-11-14", "2026-11-16")).toBe(0);
    expect(workdaysBetween("2026-11-20", "2026-11-12")).toBe(0);
  });
});

describe("dayPlan", () => {
  it("fills working days in route order, starting today", () => {
    const p = dayPlan(confirmed(), "2026-11-12", 1);
    expect(p.hoursPerDay).toBe(1);
    expect(p.days.map((d) => d.date)).toEqual([
      "2026-11-12",
      "2026-11-13",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
    ]);
    // The outcome first (55 minutes), then finishing spills over the days.
    expect(p.days[0]!.items).toEqual([
      { id: LU, kind: "outcome", outcomeId: LU, minutes: 55 },
      { id: "finish", kind: "finish", minutes: 5 },
    ]);
    expect(p.days[4]!.items).toEqual([{ id: "finish", kind: "finish", minutes: 55 }]);
    expect(p.minutes).toBe(295);
  });

  it("starts on Monday when today is in the weekend", () => {
    expect(dayPlan(confirmed(), "2026-11-14", 8).days[0]!.date).toBe("2026-11-16");
  });

  it("uses the dossier's own hours per day, or a full working day", () => {
    expect(dayPlan(confirmed(), "2026-11-12").hoursPerDay).toBe(DEFAULT_HOURS_PER_DAY);
    expect(dayPlan({ ...confirmed(), hoursPerDay: 3 }, "2026-11-12").hoursPerDay).toBe(3);
  });

  it("says whether the plan fits before the hand-in date", () => {
    const fits = dayPlan({ ...confirmed(), deadline: "2026-11-20" }, "2026-11-12", 1);
    expect(fits.deadline).toEqual({ date: "2026-11-20", workdays: 6, onTrack: true, shortBy: 0 });
    const tight = dayPlan({ ...confirmed(), deadline: "2026-11-17" }, "2026-11-12", 1);
    expect(tight.deadline).toEqual({ date: "2026-11-17", workdays: 3, onTrack: false, shortBy: 2 });
    expect(dayPlan(confirmed(), "2026-11-12").deadline).toBeUndefined();
  });

  it("lists required evidence from others that is still missing, to ask for today", () => {
    // The mentor's feedback is there; the recording is not.
    expect(dayPlan(confirmed(), "2026-11-12").askNow).toEqual([
      { outcomeId: LU, line: "Opname van de les" },
    ]);
  });

  it("still plans getting the framework when there are no outcomes yet", () => {
    const d = { ...confirmed(), framework: { ...confirmed().framework, outcomes: [] } };
    expect(dayPlan(d, "2026-11-12").days.length).toBeGreaterThan(0);
  });
});

describe("hours per day in the dossier", () => {
  it("is saved with the hand-in date, and may be left empty", () => {
    const set = applyIntent(
      sampleDossier(),
      fd({ intent: "deadline", deadline: "2026-12-01", hoursPerDay: "6" }),
      ctx,
    );
    expect(set.ok && set.data.hoursPerDay).toBe(6);
    expect(set.ok && DossierDataSchema.safeParse(set.data).success).toBe(true);
    const cleared = applyIntent(
      set.ok ? set.data : sampleDossier(),
      fd({ intent: "deadline", deadline: "2026-12-01", hoursPerDay: "" }),
      ctx,
    );
    expect(cleared.ok && "hoursPerDay" in cleared.data).toBe(false);
  });

  it("refuses less than one hour or more than twelve", () => {
    for (const h of ["0", "13", "x"]) {
      expect(
        applyIntent(sampleDossier(), fd({ intent: "deadline", deadline: "", hoursPerDay: h }), ctx)
          .ok,
      ).toBe(false);
    }
    expect(DossierDataSchema.safeParse({ ...sampleDossier(), hoursPerDay: 13 }).success).toBe(
      false,
    );
  });
});
