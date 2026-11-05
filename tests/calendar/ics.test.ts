import { describe, expect, it } from "vitest";
import { courseToIcs, escapeIcsText, foldIcsLine } from "~/lib/calendar/ics";
import { courseWeekDates } from "~/lib/calendar/weeks";
import type { CourseData } from "~/lib/courses/types";

const data: CourseData = {
  startDate: "2026-10-05",
  outcomes: [{ id: "lo1", text: "x" }],
  activities: [
    { id: "a1", title: "Les 1: normaliseren, deel 1", week: 1, kind: "lesson", outcomeIds: [] },
    { id: "a2", title: "Opdracht", week: 3, kind: "assignment", outcomeIds: [] },
    { id: "a3", title: "Zonder week", kind: "lesson", outcomeIds: [] },
  ],
  assessments: [{ id: "t1", title: "Tentamen", week: 4, kind: "summative", coverage: [] }],
};
// The herfstvakantie (19 Oct) is skipped: week 3 is 26 Oct, week 4 is 2 Nov.
const weekDates = courseWeekDates("2026-10-05", ["2026-10-19"], 60);
const now = new Date("2026-11-05T12:34:56Z");
const ics = () => courseToIcs({ id: "c1", name: "Databases", data }, weekDates, "nl", now);

const events = (text: string) =>
  text
    .split("BEGIN:VEVENT")
    .slice(1)
    .map((e) => e.split("END:VEVENT")[0]);

describe("escapeIcsText", () => {
  it("escapes backslash, semicolon, comma and new lines", () => {
    expect(escapeIcsText("a\\b;c,d\ne")).toBe("a\\\\b;c\\,d\\ne");
  });
});

describe("foldIcsLine", () => {
  it("folds at 75 octets with CRLF and a space, never inside a character", () => {
    const line = `SUMMARY:${"é".repeat(60)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const [i, p] of parts.entries()) {
      expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
      if (i > 0) expect(p.startsWith(" ")).toBe(true);
    }
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
  });

  it("leaves a short line alone", () => {
    expect(foldIcsLine("VERSION:2.0")).toBe("VERSION:2.0");
  });
});

describe("courseToIcs (P22.4)", () => {
  it("is a calendar with CRLF line ends", () => {
    const text = ics();
    expect(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(text.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("makes one whole-week event per activity and assessment with a week", () => {
    const evs = events(ics());
    expect(evs).toHaveLength(3); // the activity without a week is left out
    const lesson = evs[0];
    expect(lesson).toContain("DTSTART;VALUE=DATE:20261005\r\n");
    expect(lesson).toContain("DTEND;VALUE=DATE:20261012\r\n");
    expect(lesson).toContain("SUMMARY:Les 1: normaliseren\\, deel 1 (Databases)\r\n");
    expect(lesson).toContain("DTSTAMP:20261105T123456Z\r\n");
  });

  it("skips the break week", () => {
    const evs = events(ics());
    expect(evs[1]).toContain("DTSTART;VALUE=DATE:20261026\r\n");
    expect(evs[2]).toContain("DTSTART;VALUE=DATE:20261102\r\n");
    expect(ics()).not.toContain("20261019");
  });

  it("uses a stable UID per item, so a new import updates instead of doubling", () => {
    expect(events(ics())[2]).toContain("UID:c1-t1@limeonit\r\n");
    const later = courseToIcs(
      { id: "c1", name: "Databases", data },
      weekDates,
      "nl",
      new Date("2026-12-01T00:00:00Z"),
    );
    expect(events(later)[2]).toContain("UID:c1-t1@limeonit\r\n");
  });

  it("describes the item in the user's language", () => {
    expect(events(ics())[2]).toContain("DESCRIPTION:Summatief · week 4\r\n");
    const en = courseToIcs({ id: "c1", name: "Databases", data }, weekDates, "en", now);
    expect(events(en)[2]).toContain("DESCRIPTION:Summative · week 4\r\n");
  });
});
