import { describe, expect, it } from "vitest";
import {
  MILESTONES,
  nextStep,
  progress,
  purgeDate,
  TRACK_RETENTION,
  TrackDataSchema,
  TrackInputSchema,
} from "~/lib/tracks";

const track = (status = {}, deadlines = {}, closedAt: Date | null = null) => ({
  data: TrackDataSchema.parse({ status, deadlines }),
  closedAt,
});

describe("the track's milestones (P38)", () => {
  it("are the seven steps of the brief, in order, each named in nl and en", () => {
    expect(MILESTONES.map((m) => m.id)).toEqual([
      "start",
      "visits",
      "drafts",
      "final",
      "second-assessor",
      "final-interview",
      "onstage",
    ]);
    for (const m of MILESTONES) {
      expect(m.name.nl.trim()).not.toBe("");
      expect(m.name.en.trim()).not.toBe("");
    }
  });
});

describe("TrackInputSchema", () => {
  it("takes a trimmed code and a kind; course and model are optional", () => {
    expect(TrackInputSchema.parse({ code: "  S-0423 ", kind: "thesis" })).toEqual({
      code: "S-0423",
      kind: "thesis",
      courseId: null,
      assessmentModelId: null,
    });
  });

  it("refuses an empty or overlong code and an unknown kind", () => {
    expect(TrackInputSchema.safeParse({ code: "  ", kind: "thesis" }).success).toBe(false);
    expect(TrackInputSchema.safeParse({ code: "x".repeat(41), kind: "thesis" }).success).toBe(
      false,
    );
    expect(TrackInputSchema.safeParse({ code: "S-1", kind: "minor" }).success).toBe(false);
  });
});

describe("TrackDataSchema", () => {
  it("starts empty and drops unknown milestones, statuses and bad dates", () => {
    expect(TrackDataSchema.parse({})).toEqual({ status: {}, deadlines: {} });
    expect(TrackDataSchema.safeParse({ status: { start: "maybe" }, deadlines: {} }).success).toBe(
      false,
    );
    expect(
      TrackDataSchema.safeParse({ status: {}, deadlines: { final: "31-01-2027" } }).success,
    ).toBe(false);
    expect(TrackDataSchema.safeParse({ status: { party: "done" }, deadlines: {} }).success).toBe(
      false,
    );
  });
});

describe("progress and nextStep (pure)", () => {
  it("a new track: nothing resolved, the next step is the start", () => {
    expect(progress(track())).toEqual({ resolved: 0, total: 7 });
    expect(nextStep(track())).toEqual({ milestone: "start", due: null });
  });

  it("done and skipped both resolve a milestone; the next step carries its deadline", () => {
    const t = track({ start: "done", visits: "skipped" }, { drafts: "2027-01-15" });
    expect(progress(t)).toEqual({ resolved: 2, total: 7 });
    expect(nextStep(t)).toEqual({ milestone: "drafts", due: "2027-01-15" });
  });

  it("the first open milestone is next, even when a later one is done", () => {
    expect(nextStep(track({ start: "done", final: "done" }))?.milestone).toBe("visits");
  });

  it("no next step when every milestone is resolved, or the track is closed", () => {
    const all = Object.fromEntries(MILESTONES.map((m) => [m.id, "done"]));
    expect(nextStep(track(all))).toBeNull();
    expect(progress(track(all))).toEqual({ resolved: 7, total: 7 });
    expect(nextStep(track({}, {}, new Date()))).toBeNull();
  });
});

describe("purgeDate", () => {
  it("is the close date plus the retention days, 90 by default", () => {
    expect(TRACK_RETENTION.defaultDays).toBe(90);
    expect(purgeDate(new Date("2027-01-01T10:00:00Z"), 90).toISOString()).toBe(
      "2027-04-01T10:00:00.000Z",
    );
    expect(purgeDate(new Date("2027-01-01T10:00:00Z"), 0).toISOString()).toBe(
      "2027-01-01T10:00:00.000Z",
    );
  });
});
