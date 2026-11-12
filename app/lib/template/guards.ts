/**
 * Output guards: a stage's output cleaned in code after the model, before the teacher sees or
 * keeps it (P36.2). Registry data names one by id (`OutputFormat.guard`); validation checks the
 * id at boot. The stream applies it before saving, the result view before showing, so both
 * agree. No per-tool branch.
 */
export const GUARD_IDS = ["input-numbers"] as const;
export type GuardId = (typeof GUARD_IDS)[number];

// A number in digits, with an optional decimal part, not part of a word or a longer number.
const NUMBER = /(?<![\p{L}\p{N}.,])\d+(?:[.,]\d+)?(?![\p{L}\p{N}])(?:\s?%)?/gu;
// An ordered-list marker at the start of a line ("1. ", "  3) ") is structure, not a count.
const LIST_MARKER = /^\s*\d+[.)]\s/;
const DROPPED = "…";

/** "5,5" and "5.5" are the same number; "07" is 7. */
function normalize(n: string): string {
  return String(Number(n.replace("%", "").trim().replace(",", ".")));
}

function inputNumbers(values: Record<string, unknown>): Set<string> {
  const found = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "number") found.add(normalize(String(v)));
    else if (typeof v === "string") for (const m of v.matchAll(NUMBER)) found.add(normalize(m[0]));
    else if (Array.isArray(v)) v.forEach(add);
  };
  Object.values(values).forEach(add);
  return found;
}

/**
 * "input-numbers": a count is never the model's (brief P36, principle 2). Every number in digits
 * that is not in the input is dropped; numbers that are not counts belong in words.
 */
function onlyInputNumbers(output: string, values: Record<string, unknown>): string {
  const allowed = inputNumbers(values);
  const clean = (text: string) =>
    text.replace(NUMBER, (m) => (allowed.has(normalize(m)) ? m : DROPPED));
  return output
    .split("\n")
    .map((line) => {
      const marker = LIST_MARKER.exec(line)?.[0] ?? "";
      return marker + clean(line.slice(marker.length));
    })
    .join("\n");
}

const GUARDS: Record<GuardId, (output: string, values: Record<string, unknown>) => string> = {
  "input-numbers": onlyInputNumbers,
};

/** The output as the teacher may see and keep it; unchanged for a stage without a guard. */
export function guardOutput(
  id: GuardId | undefined,
  output: string,
  values: Record<string, unknown>,
): string {
  return id ? GUARDS[id](output, values) : output;
}
