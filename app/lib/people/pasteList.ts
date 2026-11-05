import { z } from "zod";

/** The most people one pasted list may carry; the rest is refused as "tooMany". */
export const MAX_PASTED_LINES = 200;
const MAX_NAME = 200;

export type PasteRefusal =
  | "invalidEmail"
  | "nameRequired"
  | "nameTooLong"
  | "duplicate"
  | "tooMany";

export type PastedPerson =
  | { line: number; ok: true; text: string; name: string; email: string }
  | { line: number; ok: false; text: string; reason: PasteRefusal };

/** Why the server refused a line: the parser's reasons plus what only the database knows. */
export type PasteReason = PasteRefusal | "emailTaken" | "alreadyInvited";

/** One line of a pasted list after the server judged it: an invite link, or why not. */
export type PasteOutcome =
  | { line: number; name: string; email: string; link: string }
  | { line: number; text: string; reason: PasteReason };

/** One accepted line: a name and an e-mail address (Zod validates both). */
const PersonSchema = z.object({
  name: z.string().min(1, "nameRequired").max(MAX_NAME, "nameTooLong"),
  email: z.string().email("invalidEmail"),
});

// Anything that looks like an address; Zod decides whether it really is one.
const EMAIL_LIKE = /<?[^\s,;<>]*@[^\s,;<>]*>?/g;

/**
 * A pasted list of people (P28.5): one person per line, a name and an e-mail address in
 * any order, separated by a comma, semicolon, tab (a spreadsheet column) or `Name <email>`.
 * Pure: it reads text and says per line what it accepts or why it refuses. Blank lines are
 * skipped; line numbers stay those of the paste so the refusal table points at the right line.
 */
export function parsePastedPeople(text: string): PastedPerson[] {
  const out: PastedPerson[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);
  let accepted = 0;
  for (const [index, raw] of lines.entries()) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const line = index + 1;
    const verdict = accepted >= MAX_PASTED_LINES ? "tooMany" : judge(trimmed);
    if (typeof verdict === "string") {
      out.push({ line, ok: false, text: trimmed, reason: verdict });
    } else if (seen.has(verdict.email)) {
      out.push({ line, ok: false, text: trimmed, reason: "duplicate" });
    } else {
      seen.add(verdict.email);
      accepted++;
      out.push({ line, ok: true, text: trimmed, ...verdict });
    }
  }
  return out;
}

/** One non-blank line: the person on it, or why it is not one. */
function judge(trimmed: string): { name: string; email: string } | PasteRefusal {
  const found = trimmed.match(EMAIL_LIKE) ?? [];
  if (found.length !== 1) return "invalidEmail";
  const email = found[0].replace(/^<|>$/g, "").toLowerCase();
  const name = trimmed
    .replace(found[0], " ")
    .replace(/[,;\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parsed = PersonSchema.safeParse({ name, email });
  if (parsed.success) return parsed.data;
  // Report the e-mail first: a line without an address is not a person at all.
  const messages = parsed.error.issues.map((i) => i.message);
  const reason = (["invalidEmail", "nameRequired", "nameTooLong"] as const).find((r) =>
    messages.includes(r),
  );
  return reason ?? "invalidEmail";
}
