import type { Route } from "./+types/courses.$id.calendar";
import { loadCourse } from "~/server/courses.server";
import { getBreakWeeks } from "~/server/repositories/settings.server";
import { getLocale } from "~/lib/i18n/locale.server";
import { courseToIcs } from "~/lib/calendar/ics";
import { courseWeekDates } from "~/lib/calendar/weeks";
import { COURSE_LIMITS } from "~/lib/courses/schema";

/** "Databases — jaar 1" → "databases-jaar-1" (ASCII, for the file name). */
function fileSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "course";
}

/**
 * Resource route (no UI): GET /courses/:id/calendar.ics → the course's lessons and
 * assessments as a calendar file to download (P22.4, BESLUIT-2026-11-05-7: a file,
 * not a feed with a secret link). Only the owner gets it, and only with a start
 * date; anything else is a 404.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { course } = await loadCourse(request, params.id);
  if (!course.data.startDate) throw new Response("Not Found", { status: 404 });
  const weekDates = courseWeekDates(
    course.data.startDate,
    await getBreakWeeks(),
    COURSE_LIMITS.week,
  );
  const body = courseToIcs(course, weekDates, getLocale(request), new Date());
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileSlug(course.name)}.ics"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
