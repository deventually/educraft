/**
 * The layer between the institution and its programmes (a division): every institution names it
 * its own way, so the name is data. One environment is one institution (BESLUIT-2026-11-12-2);
 * the admin picks the word, and the app uses it wherever the layer shows. Stable slugs, never
 * shown; adding a kind is adding a row.
 */
import { z } from "zod";
import type { LocalizedText } from "~/lib/i18n/localized";

export const DIVISION_KINDS = [
  {
    value: "faculty",
    one: { nl: "Faculteit", en: "Faculty" },
    add: { nl: "Nieuwe faculteit", en: "New faculty" },
  },
  {
    value: "academy",
    one: { nl: "Academie", en: "Academy" },
    add: { nl: "Nieuwe academie", en: "New academy" },
  },
  {
    value: "institute",
    one: { nl: "Instituut", en: "Institute" },
    add: { nl: "Nieuw instituut", en: "New institute" },
  },
  {
    value: "college",
    one: { nl: "College", en: "College" },
    add: { nl: "Nieuw college", en: "New college" },
  },
  {
    value: "location",
    one: { nl: "Vestiging", en: "Location" },
    add: { nl: "Nieuwe vestiging", en: "New location" },
  },
  {
    value: "department",
    one: { nl: "Afdeling", en: "Department" },
    add: { nl: "Nieuwe afdeling", en: "New department" },
  },
] as const satisfies readonly { value: string; one: LocalizedText; add: LocalizedText }[];

export type DivisionKind = (typeof DIVISION_KINDS)[number]["value"];

export const DivisionKindSchema = z.enum(
  DIVISION_KINDS.map((k) => k.value) as [DivisionKind, ...DivisionKind[]],
);

/** The word for one division before the admin chose a kind. */
const NEUTRAL_DIVISION: LocalizedText = { nl: "Onderdeel", en: "Division" };

/** "Nieuwe faculteit" / "Nieuw instituut": Dutch needs the article's form per word. */
export function newDivisionLabel(kind: DivisionKind | null): LocalizedText {
  return (
    DIVISION_KINDS.find((k) => k.value === kind)?.add ?? {
      nl: "Nieuw onderdeel",
      en: "New division",
    }
  );
}

/** The word for one division: the chosen kind's, or the neutral one. */
export function divisionWord(kind: DivisionKind | null): LocalizedText {
  return DIVISION_KINDS.find((k) => k.value === kind)?.one ?? NEUTRAL_DIVISION;
}

export const DivisionNameSchema = z.string().trim().min(1).max(200);
