import { describe, expect, it } from "vitest";
import {
  CHECKIN_INTERVAL_DAYS,
  CHECKIN_MIN_GENERATIONS,
  QUALITY_SCORES,
  TIME_SAVED_OPTIONS,
  checkinDue,
  summarizeByTool,
} from "~/lib/pilot";

const DAY = 86_400_000;
const now = new Date("2026-11-06T12:00:00Z");

describe("pilot answer options", () => {
  it("time saved is 0, 15, 30 or 60+ minutes (60 stands for 60+)", () => {
    expect([...TIME_SAVED_OPTIONS]).toEqual([0, 15, 30, 60]);
  });

  it("quality is a score from 1 to 5", () => {
    expect([...QUALITY_SCORES]).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("checkinDue", () => {
  it("is not due before the teacher has really used the app", () => {
    expect(checkinDue({ generationCount: CHECKIN_MIN_GENERATIONS - 1, lastAt: null, now })).toBe(
      false,
    );
  });

  it("is due once they have, and never answered or dismissed it", () => {
    expect(checkinDue({ generationCount: CHECKIN_MIN_GENERATIONS, lastAt: null, now })).toBe(true);
  });

  it("stays away for the interval after an answer or a dismissal", () => {
    const recent = new Date(now.getTime() - (CHECKIN_INTERVAL_DAYS - 1) * DAY);
    const old = new Date(now.getTime() - CHECKIN_INTERVAL_DAYS * DAY);
    expect(checkinDue({ generationCount: 10, lastAt: recent, now })).toBe(false);
    expect(checkinDue({ generationCount: 10, lastAt: old, now })).toBe(true);
  });
});

describe("summarizeByTool", () => {
  it("adds up uses, thumbs, time saved, quality and comments per tool", () => {
    const rows = summarizeByTool(
      [
        { toolSlug: "mentorai", count: 5 },
        { toolSlug: "bloom-by-design", count: 2 },
      ],
      [
        { toolSlug: "mentorai", rating: 1, minutesSaved: 30, quality: 4, comment: "Top" },
        { toolSlug: "mentorai", rating: 1, minutesSaved: 60, quality: 5, comment: null },
        { toolSlug: "mentorai", rating: -1, minutesSaved: 0, quality: null, comment: "Te lang" },
        { toolSlug: "bloom-by-design", rating: -1, minutesSaved: null, quality: 2, comment: " " },
      ],
    );
    expect(rows).toEqual([
      {
        toolSlug: "mentorai",
        uses: 5,
        up: 2,
        down: 1,
        minutesSaved: 90,
        timeAnswers: 3,
        qualityAvg: 4.5,
        qualityAnswers: 2,
        comments: 2,
      },
      {
        toolSlug: "bloom-by-design",
        uses: 2,
        up: 0,
        down: 1,
        minutesSaved: 0,
        timeAnswers: 0,
        qualityAvg: 2,
        qualityAnswers: 1,
        comments: 0,
      },
    ]);
  });

  it("keeps a tool with feedback but no counted uses, and sorts by uses", () => {
    const rows = summarizeByTool(
      [{ toolSlug: "a", count: 1 }],
      [{ toolSlug: "b", rating: 1, minutesSaved: null, quality: null, comment: null }],
    );
    expect(rows.map((r) => [r.toolSlug, r.uses])).toEqual([
      ["a", 1],
      ["b", 0],
    ]);
    expect(rows[1].qualityAvg).toBeNull();
  });
});
