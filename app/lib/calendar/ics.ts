/**
 * A course as an iCalendar file (P22.4, RFC 5545). Pure: no I/O, no clock.
 *
 * Each activity and assessment with a week becomes one whole-week event
 * (Monday up to the next Monday). Only what the teacher typed goes in: the
 * course name and the titles of its items, never student data. The UID is
 * stable per item, so importing the file again updates the events instead of
 * doubling them.
 */
import { type Locale, getMessages } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import type { CourseData } from "~/lib/courses/types";
import { addWeeks, type IsoDate } from "./weeks";

const CRLF = "\r\n";
const MAX_OCTETS = 75;

/** TEXT value escaping: backslash, semicolon, comma and new lines. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, ";")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets (CRLF + space), never inside a character. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    // Continuation lines start with a space, which counts towards their 75.
    const limit = parts.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
    }
    current += ch;
    octets += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

const icsDate = (date: IsoDate) => date.replace(/-/g, "");
const icsStamp = (now: Date) => `${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;

export function courseToIcs(
  course: { id: string; name: string; data: CourseData },
  weekDates: IsoDate[],
  locale: Locale,
  now: Date,
): string {
  const m = getMessages(locale);
  const items = [
    ...course.data.activities.map((a) => ({
      id: a.id,
      title: a.title,
      week: a.week,
      kind: m.courses.activities.kinds[a.kind],
    })),
    ...course.data.assessments.map((a) => ({
      id: a.id,
      title: a.title,
      week: a.week,
      kind: m.courses.assessments.kinds[a.kind],
    })),
  ];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LimeOnIt//Course calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(course.name)}`,
  ];
  for (const item of items) {
    const monday = item.week === undefined ? undefined : weekDates[item.week - 1];
    if (!monday) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${course.id}-${item.id}@limeonit`,
      `DTSTAMP:${icsStamp(now)}`,
      `DTSTART;VALUE=DATE:${icsDate(monday)}`,
      `DTEND;VALUE=DATE:${icsDate(addWeeks(monday, 1))}`,
      `SUMMARY:${escapeIcsText(`${item.title} (${course.name})`)}`,
      `DESCRIPTION:${escapeIcsText(`${item.kind} · ${fmt(m.week.courseWeek, { n: item.week as number })}`)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}
