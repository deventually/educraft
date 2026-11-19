/**
 * Calibrating as BKE evidence (P34.3). The browser posts only the summary
 * (`CalibrationSummarySchema`: counts and the rubric's own criterion ids); the server builds the
 * text from it and the rubric, so no code or name of a work can reach the dossier. It goes in
 * through the one evidence path (`addTextToDossier`). The rubric is only read, never written.
 */
import type { User } from "./auth.server";
import { addTextToDossier } from "./evidence.server";
import { getTimeZone } from "./repositories/settings.server";
import { todayIn } from "~/lib/calendar/weeks";
import { getMessages, type Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import {
  CalibrationSummarySchema,
  calibrationEvidenceText,
  type RubricData,
} from "~/lib/utilities/rubric";

/** Today for the institution, as `YYYY-MM-DD`: the date in the evidence text. */
export async function calibrationDate(): Promise<string> {
  return todayIn(await getTimeZone(), new Date());
}

function parseSummary(raw: FormDataEntryValue | null) {
  try {
    return CalibrationSummarySchema.safeParse(JSON.parse(String(raw ?? "")));
  } catch {
    return { success: false as const };
  }
}

export async function addCalibrationEvidence(
  user: User,
  rubric: { name: string; data: RubricData },
  fd: FormData,
  locale: Locale,
) {
  const e = getMessages(locale).rubricCalibrate.evidence;
  const summary = parseSummary(fd.get("summary"));
  if (!summary.success) return { ok: false as const, error: e.errorInvalid };
  const text = calibrationEvidenceText(rubric.data, rubric.name, summary.data, {
    date: await calibrationDate(),
    locale,
  });
  const added = await addTextToDossier(user, {
    dossierId: String(fd.get("dossierId") ?? ""),
    title: fmt(e.title, { name: rubric.name }),
    kind: "analysis",
    text,
    criterionIds: fd.getAll("criterionIds").map(String),
  });
  if (!added.ok)
    return {
      ok: false as const,
      error: added.error === "criterion" ? e.errorCriterion : e.errorInvalid,
    };
  return { ok: true as const, intent: "use-as-evidence" as const };
}
