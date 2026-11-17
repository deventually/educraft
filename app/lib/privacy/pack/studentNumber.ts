/**
 * The student number format, learnt from one example the teacher gives (BESLUIT-2026-11-17-…):
 * formats differ per institution, so none is built in. "s1234567" gives an optional "s" and
 * exactly seven digits; "12345678" exactly eight digits. Anything that does not look like a
 * student number (letters only, too short, spaces, an address) gives no format, and the engine
 * falls back to any run of 6–8 digits.
 */
const EXAMPLE = /^([a-z]{0,3})(\d{5,12})$/i;

export function studentNumberFormat(example: string | undefined): string | undefined {
  const m = EXAMPLE.exec(example?.trim() ?? "");
  if (!m) return undefined;
  const [, letters = "", digits = ""] = m;
  return `${letters ? `(?:${letters.toLowerCase()})?` : ""}\\d{${digits.length}}`;
}
