import { describe, it, expect } from "vitest";
import {
  addWeeks,
  courseWeekDates,
  courseWeekOn,
  formatWeekRange,
  isIsoDate,
  isoWeek,
  IsoDateSchema,
  isTimeZone,
  mondayOf,
  normalizeBreakWeeks,
  todayIn,
} from "~/lib/calendar/weeks";

describe("isIsoDate / IsoDateSchema", () => {
  it("accepts a real calendar date in YYYY-MM-DD", () => {
    expect(isIsoDate("2026-11-17")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true); // leap year
  });

  it("refuses impossible dates and other shapes", () => {
    for (const bad of [
      "2026-02-30",
      "2027-02-29",
      "2026-13-01",
      "2026-1-5",
      "17-11-2026",
      "",
      "x",
    ]) {
      expect(isIsoDate(bad), bad).toBe(false);
    }
    expect(IsoDateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(IsoDateSchema.safeParse("2026-11-17").success).toBe(true);
  });
});

describe("mondayOf / addWeeks / isoWeek", () => {
  it("gives the Monday of a Sunday (ISO weeks run Monday to Sunday)", () => {
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
    expect(mondayOf("2026-11-04")).toBe("2026-11-02");
  });

  it("crosses the year boundary", () => {
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
    expect(addWeeks("2026-12-28", 1)).toBe("2027-01-04");
  });

  it("knows ISO week 53 and week 1", () => {
    expect(isoWeek("2026-12-28")).toBe(53);
    expect(isoWeek("2027-01-03")).toBe(53);
    expect(isoWeek("2027-01-04")).toBe(1);
    expect(isoWeek("2026-11-17")).toBe(47);
  });

  it("is not thrown off by the daylight saving change", () => {
    // Clocks go back on Sunday 25 October 2026 in Europe/Amsterdam.
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
    expect(addWeeks("2026-10-19", 1)).toBe("2026-10-26");
    expect(addWeeks("2026-03-23", 1)).toBe("2026-03-30"); // and forward in March
    expect(addWeeks("2026-11-02", -2)).toBe("2026-10-19");
  });
});

describe("normalizeBreakWeeks", () => {
  it("turns any day into its Monday, drops duplicates and sorts", () => {
    expect(normalizeBreakWeeks(["2026-12-30", "2026-10-21", "2026-10-19", "2026-12-21"])).toEqual([
      "2026-10-19",
      "2026-12-21",
      "2026-12-28",
    ]);
  });
});

describe("courseWeekDates", () => {
  it("gives the Monday of each relative week, starting in the week of the start date", () => {
    // A Wednesday start counts from the Monday of that week.
    expect(courseWeekDates("2026-09-02", [], 3)).toEqual([
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
    ]);
  });

  it("skips a break week", () => {
    expect(courseWeekDates("2026-10-05", ["2026-10-19"], 4)).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-26",
      "2026-11-02",
    ]);
  });

  it("skips two break weeks in a row", () => {
    expect(courseWeekDates("2026-12-14", ["2026-12-21", "2026-12-28"], 2)).toEqual([
      "2026-12-14",
      "2027-01-04",
    ]);
  });

  it("moves week 1 past a break in the start week", () => {
    expect(courseWeekDates("2026-10-19", ["2026-10-19"], 2)).toEqual(["2026-10-26", "2026-11-02"]);
  });

  it("returns nothing for a course without weeks", () => {
    expect(courseWeekDates("2026-10-19", [], 0)).toEqual([]);
  });
});

describe("courseWeekOn", () => {
  const start = "2026-10-05";
  const breaks = ["2026-10-19"];

  it("gives the relative week of today", () => {
    expect(courseWeekOn(start, breaks, "2026-10-05", 6)).toEqual({ kind: "week", week: 1 });
    expect(courseWeekOn(start, breaks, "2026-10-18", 6)).toEqual({ kind: "week", week: 2 });
    expect(courseWeekOn(start, breaks, "2026-10-27", 6)).toEqual({ kind: "week", week: 3 });
  });

  it("says break when today is in a break week", () => {
    expect(courseWeekOn(start, breaks, "2026-10-21", 6)).toEqual({ kind: "break" });
  });

  it("says before the start, and after the last week", () => {
    expect(courseWeekOn(start, breaks, "2026-10-04", 6)).toEqual({ kind: "before" });
    // Week 6 is the week of 16 November (one break skipped); the week after is over.
    expect(courseWeekOn(start, breaks, "2026-11-22", 6)).toEqual({ kind: "week", week: 6 });
    expect(courseWeekOn(start, breaks, "2026-11-23", 6)).toEqual({ kind: "after" });
  });
});

describe("todayIn / isTimeZone", () => {
  it("is the calendar day in the institution's time zone", () => {
    // 23:30 UTC on 5 November is already 6 November in Amsterdam.
    expect(todayIn("Europe/Amsterdam", new Date("2026-11-05T23:30:00Z"))).toBe("2026-11-06");
    expect(todayIn("UTC", new Date("2026-11-05T23:30:00Z"))).toBe("2026-11-05");
  });

  it("knows a valid IANA time zone", () => {
    expect(isTimeZone("Europe/Amsterdam")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
  });
});

describe("formatWeekRange", () => {
  it("shows the Monday to Sunday of a week in the user's language", () => {
    expect(formatWeekRange("2026-11-16", "nl")).toMatch(/16.*22.*nov/);
    expect(formatWeekRange("2026-11-16", "en")).toMatch(/Nov.*16.*22/);
  });

  it("can add the year", () => {
    expect(formatWeekRange("2026-12-28", "nl", { year: true })).toMatch(/28.*dec.*3.*jan.*2027/);
  });
});
