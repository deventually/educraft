/**
 * A programme (opleiding): a named bundle of courses with a year and period per course.
 * Pure data and validation; the level comes from the sector and track catalogue
 * (`~/lib/context/sectors`), so a new sector or track needs no change here.
 */
import { z } from "zod";
import type { Locale } from "~/lib/i18n";
import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { SECTORS, tracksForSector } from "~/lib/context/sectors";

export const PROGRAMME_LIMITS = { name: 200, year: 8, period: 6 } as const;

/** How the programme is taught. Stable slugs; the label is what a teacher reads. */
export const PROGRAMME_FORMS = [
  { value: "fulltime", label: { nl: "voltijd", en: "full-time" } },
  { value: "parttime", label: { nl: "deeltijd", en: "part-time" } },
  { value: "dual", label: { nl: "duaal", en: "work-based (dual)" } },
] as const satisfies readonly { value: string; label: LocalizedText }[];

export type ProgrammeForm = (typeof PROGRAMME_FORMS)[number]["value"];

const FORM_VALUES = PROGRAMME_FORMS.map((f) => f.value) as [ProgrammeForm, ...ProgrammeForm[]];

export const ProgrammeInputSchema = z
  .object({
    name: z.string().trim().min(1).max(PROGRAMME_LIMITS.name),
    sector: z.enum(SECTORS),
    track: z.string().min(1).max(40).optional(),
    form: z.enum(FORM_VALUES).optional(),
  })
  .refine((p) => !p.track || tracksForSector(p.sector).some((t) => t.value === p.track), {
    path: ["track"],
  });

/** Where a course sits in a programme: study year and period, both optional. */
export const PlacementSchema = z.object({
  year: z.number().int().min(1).max(PROGRAMME_LIMITS.year).optional(),
  period: z.number().int().min(1).max(PROGRAMME_LIMITS.period).optional(),
});

export type Placement = z.infer<typeof PlacementSchema>;

/** "hbo-bachelor · deeltijd": the kind of programme, as a teacher names it. */
export function programmeKindLabel(
  p: { sector: string; track: string | null; form: string | null },
  locale: Locale,
): string {
  const track = tracksForSector(p.sector).find((t) => t.value === p.track);
  let kind = p.sector;
  if (track) {
    const label = loc(track.label, locale);
    kind = label.includes(p.sector) ? label : `${label} (${p.sector})`;
  }
  const form = PROGRAMME_FORMS.find((f) => f.value === p.form);
  return form ? `${kind} · ${loc(form.label, locale)}` : kind;
}
