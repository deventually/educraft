/**
 * The layer between the institution and its programmes (a division): every institution names it
 * its own way, so the name is data. One environment is one institution (BESLUIT-2026-11-12-2);
 * the admin picks the word, and the app uses it wherever the layer shows. Stable slugs, never
 * shown; adding a kind is adding a row.
 */
import { z } from "zod";
import type { LocalizedText } from "~/lib/i18n/localized";

export const DIVISION_KINDS = [
  { value: "faculty", one: { nl: "Faculteit", en: "Faculty" } },
  { value: "academy", one: { nl: "Academie", en: "Academy" } },
  { value: "institute", one: { nl: "Instituut", en: "Institute" } },
  { value: "college", one: { nl: "College", en: "College" } },
  { value: "location", one: { nl: "Vestiging", en: "Location" } },
  { value: "department", one: { nl: "Afdeling", en: "Department" } },
] as const satisfies readonly { value: string; one: LocalizedText }[];

export type DivisionKind = (typeof DIVISION_KINDS)[number]["value"];

export const DivisionKindSchema = z.enum(
  DIVISION_KINDS.map((k) => k.value) as [DivisionKind, ...DivisionKind[]],
);

/** The word for one division before the admin chose a kind. */
const NEUTRAL_DIVISION: LocalizedText = { nl: "Onderdeel", en: "Division" };

/** The word for one division: the chosen kind's, or the neutral one. */
export function divisionWord(kind: DivisionKind | null): LocalizedText {
  return DIVISION_KINDS.find((k) => k.value === kind)?.one ?? NEUTRAL_DIVISION;
}

export const DivisionNameSchema = z.string().trim().min(1).max(200);
