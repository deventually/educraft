/**
 * The privacy pack (anonymiseerpoort, PR 1): the locale-specific data that keeps the redaction
 * engine (`../redact.ts`) from removing too much. The engine stays neutral; every list here
 * grows as data, and the student number format comes from the teacher, not from a table.
 */
import type { RedactOptions } from "../redact";
import { COMMON_WORDS } from "./commonWords";
import { KEEP_WORDS } from "./keep";
import { studentNumberFormat } from "./studentNumber";

const COMMON = [...new Set(Object.values(COMMON_WORDS).flat())];

/** The options for `findRedactions`; `studentNumberExample` is one number the teacher typed. */
export function redactOptions(given: { studentNumberExample?: string } = {}): RedactOptions {
  const studentNumber = studentNumberFormat(given.studentNumberExample);
  return { keep: KEEP_WORDS, commonWords: COMMON, ...(studentNumber ? { studentNumber } : {}) };
}

export { CODE_NOTE } from "./codeNote";
