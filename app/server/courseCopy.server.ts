/**
 * "Kopiëren voor een nieuwe uitvoering": the `copy-run` intent of the course page. The
 * owner copies their own course for its next run and lands on the Controle tab of the copy,
 * which asks what has to change after the last run's evaluation.
 */
import { redirect } from "react-router";
import { z } from "zod";
import type { User } from "./auth.server";
import { copyCourse, type Course } from "./repositories/courses.server";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { courseTabHref } from "~/lib/courses/tabs";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || undefined)
    .optional();

const CopyRunFormSchema = z.object({
  name: z.string().trim().min(1).max(COURSE_LIMITS.title),
  studyYear: optional(COURSE_LIMITS.code),
  phase: optional(COURSE_LIMITS.title),
  startDate: optional(10),
});

type CopyRunResult = { ok: false; intent: "copy-run"; error: string };

/** The `copy-run` intent; null for any other intent. A copy throws its redirect. */
export async function copyRunAction(
  request: Request,
  user: User,
  course: Course,
): Promise<CopyRunResult | null> {
  const fd = await request.clone().formData();
  if (fd.get("intent") !== "copy-run") return null;
  const m = getMessages(getLocale(request)).courseCopy;
  if (course.ownerId !== user.id) return { ok: false, intent: "copy-run", error: m.ownerOnly };
  const field = (key: string) => fd.get(key)?.toString() ?? "";
  const parsed = CopyRunFormSchema.safeParse({
    name: field("name"),
    studyYear: field("studyYear"),
    phase: field("phase"),
    startDate: field("startDate"),
  });
  const copy = parsed.success
    ? await copyCourse(user.id, course.id, parsed.data).catch(() => null)
    : null;
  if (!copy) return { ok: false, intent: "copy-run", error: m.error };
  throw redirect(`${courseTabHref(copy.id, "check")}&copied=1`);
}
