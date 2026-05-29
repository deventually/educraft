import type { Attribution } from "~/lib/registry/types";

/** Shared book-level constants reused by every tool's Attribution. */
export const BOOK = {
  bookTitle: "The Pedagogical Promptbook",
  editor: "David Wiley (Ed.)",
  doi: "10.59668/2340",
  year: 2026,
  license: "CC BY 4.0",
} as const;

export const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

/** Build a full Attribution from the book constants plus chapter-specific fields. */
export function attribution(
  fields: Pick<
    Attribution,
    "chapterTitle" | "authors" | "sourcePages" | "evaluatedWith" | "adapted"
  >,
): Attribution {
  return {
    ...fields,
    bookTitle: BOOK.bookTitle,
    editor: BOOK.editor,
    doi: BOOK.doi,
    year: BOOK.year,
    license: BOOK.license,
  };
}
