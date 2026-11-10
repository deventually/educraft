/**
 * Route glue for programmes (opleidingen): the gate (the courses feature), the owner-scoped
 * load (a foreign or unknown programme is a 404), and the forms. Routes stay thin.
 */
import type { User } from "./auth.server";
import { getAvailableSectors } from "./availability.server";
import { requireCourseUser } from "./courses.server";
import { getProgramme, placeCourse, removeCourse } from "./repositories/programmes.server";
import { TRACKS_BY_SECTOR } from "~/lib/context/sectors";
import type { Locale } from "~/lib/i18n";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { type Placement, PlacementSchema, programmeKindLabel } from "~/lib/programmes/schema";

/** Programmes ride on courses: whoever may use courses may bundle them. */
export const requireProgrammeUser = requireCourseUser;

export async function loadProgramme(request: Request, id: string | undefined) {
  const user = await requireProgrammeUser(request);
  const programme = id ? await getProgramme(user, id) : null;
  if (!programme) throw new Response("Not Found", { status: 404 });
  return { user, programme };
}

/** The "level" choices: every track of every sector this instance offers, as `sector:track`. */
export async function kindOptions(user: User, locale: Locale) {
  return (await getAvailableSectors(user)).flatMap((sector) =>
    TRACKS_BY_SECTOR[sector].map((t) => ({
      value: `${sector}:${t.value}`,
      label: programmeKindLabel({ sector, track: t.value, form: null }, locale),
    })),
  );
}

/** The raw programme input from a form; the repository validates it. */
export function programmeFromForm(fd: FormData) {
  const [sector = "", track = ""] = String(fd.get("kind") ?? "").split(":");
  const form = String(fd.get("form") ?? "");
  return {
    name: String(fd.get("name") ?? ""),
    sector,
    ...(track && { track }),
    ...(form && { form }),
  };
}

const optionalInt = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : Number(s);
};

/** Year and period from a form, or null when they are not whole numbers in range. */
export function placementFromForm(fd: FormData): Placement | null {
  const parsed = PlacementSchema.safeParse({
    year: optionalInt(fd.get("year")),
    period: optionalInt(fd.get("period")),
  });
  return parsed.success ? parsed.data : null;
}

export type CourseProgrammeResult =
  | { ok: true; intent: "programme-place" | "programme-remove"; message: string }
  | { ok: false; intent: "programme-place" | "programme-remove"; error: string };

/** "Hoort bij opleiding…" on the course page; null when the form is not one of these. */
export async function courseProgrammeAction(
  request: Request,
  user: User,
  courseId: string,
): Promise<CourseProgrammeResult | null> {
  const fd = await request.clone().formData();
  const intent = fd.get("intent");
  if (intent !== "programme-place" && intent !== "programme-remove") return null;
  const m = getMessages(getLocale(request)).programmes;
  const programmeId = String(fd.get("programmeId") ?? "");
  if (intent === "programme-remove") {
    return (await removeCourse(user, programmeId, courseId))
      ? { ok: true, intent, message: m.toastRemoved }
      : { ok: false, intent, error: m.errorNotFound };
  }
  const placement = placementFromForm(fd);
  if (!placement) return { ok: false, intent, error: m.errorPlacement };
  return (await placeCourse(user, programmeId, courseId, placement))
    ? { ok: true, intent, message: m.toastPlaced }
    : { ok: false, intent, error: m.errorNotFound };
}
