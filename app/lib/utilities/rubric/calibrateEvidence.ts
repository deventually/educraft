import { z } from "zod";
import { table } from "~/lib/courses/evidence";
import { getMessages, type Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import type { Calibration } from "./calibrate";
import { RUBRIC_LIMITS, type RubricData } from "./schema";

/**
 * Calibrating as BKE evidence (P34.3). What may leave the browser is only this summary: per
 * criterion (by the rubric's own uuid) the counts and kappa, and which criteria are the talking
 * points. No code, name or score of a work fits in it, so the dossier text the server builds
 * from it cannot hold one either.
 */
const MAX_WORKS = 10_000;
const count = z.number().int().min(0).max(MAX_WORKS);

export const CalibrationSummarySchema = z.object({
  works: count,
  criteria: z
    .array(
      z.object({
        id: z.uuid(),
        works: count,
        exact: count,
        oneOff: count,
        twoOrMore: count,
        kappa: z.number().finite().min(-1).max(1).nullable(),
      }),
    )
    .max(RUBRIC_LIMITS.criteria),
  talkingPoints: z.array(z.uuid()).max(RUBRIC_LIMITS.criteria),
});
export type CalibrationSummary = z.infer<typeof CalibrationSummarySchema>;

/** The part of a calibration that may become evidence: no work, so no code. */
export function calibrationSummary(result: Calibration): CalibrationSummary {
  return {
    works: result.works.length,
    criteria: result.criteria.map(({ id, works, exact, oneOff, twoOrMore, kappa }) => ({
      id,
      works,
      exact,
      oneOff,
      twoOrMore,
      kappa,
    })),
    talkingPoints: result.agenda.flatMap((line) => (line.kind === "criterion" ? [line.id] : [])),
  };
}

const TAG: Record<Locale, string> = { nl: "nl-NL", en: "en-GB" };

const longDate = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(TAG[locale], { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

const decimal = (n: number, locale: Locale) =>
  new Intl.NumberFormat(TAG[locale], { maximumFractionDigits: 2, useGrouping: false }).format(
    Math.round(n * 100) / 100,
  );

/**
 * The evidence text: Markdown with the date, "with a colleague", the agreement per criterion and
 * the talking points. Only the rubric's own titles are printed; a summary id the rubric does not
 * have is left out.
 */
export function calibrationEvidenceText(
  data: RubricData,
  rubricName: string,
  summary: CalibrationSummary,
  { date, locale }: { date: string; locale: Locale },
): string {
  const s = getMessages(locale).rubricCalibrate;
  const e = s.evidence;
  const byId = new Map(summary.criteria.map((c) => [c.id, c]));
  const rows = data.criteria.flatMap((c) => {
    const a = byId.get(c.id);
    if (!a) return [];
    const exact = a.works
      ? fmt(s.exactOf, {
          exact: a.exact,
          works: a.works,
          percent: Math.round((a.exact / a.works) * 100),
        })
      : "—";
    const kappa = a.kappa === null ? s.kappaTooFew : decimal(a.kappa, locale);
    return [[c.title, exact, a.oneOff, a.twoOrMore, kappa]];
  });
  const points = summary.talkingPoints.flatMap((id) => {
    const c = data.criteria.find((x) => x.id === id);
    const a = byId.get(id);
    return c && a
      ? [fmt(s.agendaCriterion, { criterion: c.title, exact: a.exact, works: a.works })]
      : [];
  });
  return [
    `## ${e.textHeading}`,
    fmt(e.textIntro, { date: longDate(date, locale), name: rubricName, works: summary.works }),
    table([s.criterion, s.exact, s.oneOff, s.twoOrMore, s.kappa], rows),
    `### ${e.textTalkingPoints}`,
    points.length ? points.map((p, i) => `${i + 1}. ${p}`).join("\n") : e.textNoDifferences,
  ].join("\n\n");
}
