/**
 * The portfolio coach (brief P25, 25.5), the pure half: what the model gets to
 * see, and how its answer is checked before a teacher ever sees it. No server,
 * no provider: `app/server/portfolioCoach.server.ts` does the call.
 *
 * Anti-fabrication lives here, in code, not only in the prompt:
 * - every criterion of the outcome is answered exactly once, under its own key;
 * - a quote must be in the chapter (verbatim, modulo whitespace and quote
 *   style); otherwise it is dropped and "shown" becomes "partial";
 * - advice that cites an author + year the teacher's reference list lacks is
 *   dropped.
 */
import { z } from "zod";
import { extractJson } from "~/lib/ai/structuredAnswer";
import { COACH_LIMITS } from "./schema";
import { evidencePending } from "./evidence";
import type { CoachReview, CriterionReview, DossierData, Outcome } from "./types";
import { VERDICTS } from "./types";
import type { Locale } from "~/lib/i18n";

/** Caps on what one request sends (cost and context bounds). */
export const COACH_INPUT_LIMITS = {
  chapter: 60_000,
  evidenceItem: 4_000,
  evidenceTotal: 30_000,
} as const;

function outcomeOf(d: DossierData, outcomeId: string): Outcome {
  const o = d.framework.outcomes.find((x) => x.id === outcomeId);
  if (!o) throw new Error(`Unknown outcome: ${outcomeId}`);
  return o;
}

/** Short, stable keys the model answers under (K1, K2, …) → real criterion ids. */
export function criterionKeys(d: DossierData, outcomeId: string): Record<string, string> {
  return Object.fromEntries(outcomeOf(d, outcomeId).criteria.map((c, i) => [`K${i + 1}`, c.id]));
}

const LABELS = {
  nl: {
    institution: "Instelling",
    outcome: "Leeruitkomst",
    strong: "Wat het sterker maakt (volgens het formulier)",
    required: "Verplicht bewijs volgens het formulier",
    requirements: "Vormeisen",
    maxWords: "maximaal {n} woorden voor het hele verslag",
    none: "(geen)",
    empty: "(Het hoofdstuk is nog leeg.)",
    truncated: "[… ingekort]",
    linkedTo: "hoort bij",
    provisional: "Voorlopig kader: het landelijke startpunt, niet het formulier van de hogeschool.",
    pending: "(Volgt nog: hier is nog geen tekst. Telt nog niet als bewijs.)",
  },
  en: {
    institution: "Institution",
    outcome: "Learning outcome",
    strong: "What makes it stronger (according to the form)",
    required: "Required evidence according to the form",
    requirements: "Form requirements",
    maxWords: "at most {n} words for the whole report",
    none: "(none)",
    empty: "(The chapter is still empty.)",
    truncated: "[… shortened]",
    linkedTo: "belongs to",
    provisional: "Provisional framework: the national starting point, not the institution's form.",
    pending: "(Still to come: there is no text yet. Does not count as evidence yet.)",
  },
} as const;

function clip(text: string, max: number, marker: string): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n${marker}`;
}

function criteriaBlock(o: Outcome, l: (typeof LABELS)[Locale], only?: readonly string[]): string {
  return o.criteria
    .map((c, i) => ({ c, key: `K${i + 1}` }))
    .filter(({ c }) => !only || only.includes(c.id))
    .map(({ c, key }) => {
      const strong = c.strongLevel ? `\n   ${l.strong}: ${c.strongLevel}` : "";
      return `${key}: ${c.text}${strong}`;
    })
    .join("\n");
}

function evidenceBlock(
  d: DossierData,
  o: Outcome,
  l: (typeof LABELS)[Locale],
  only?: readonly string[],
): string {
  const keyOf = new Map(o.criteria.map((c, i) => [c.id, `K${i + 1}`]));
  const items = d.evidence.filter((e) =>
    e.criterionIds.some((id) => (only ? only.includes(id) : keyOf.has(id))),
  );
  let budget = COACH_INPUT_LIMITS.evidenceTotal;
  const parts: string[] = [];
  items.forEach((e, i) => {
    if (budget <= 0) return;
    const keys = e.criterionIds.flatMap((id) => keyOf.get(id) ?? []).join(", ");
    const text = evidencePending(e)
      ? l.pending
      : clip(e.text, Math.min(COACH_INPUT_LIMITS.evidenceItem, budget), l.truncated);
    budget -= text.length;
    parts.push(
      `<item id="B${i + 1}" kind="${e.kind}" ${l.linkedTo}="${keys}">\n# ${e.title}\n${text}\n</item>`,
    );
  });
  return parts.length ? parts.join("\n") : l.none;
}

function requirementsBlock(d: DossierData, l: (typeof LABELS)[Locale]): string {
  const r = d.framework.requirements;
  const lines = [
    r.maxWords ? l.maxWords.replace("{n}", String(r.maxWords)) : null,
    r.notes ?? null,
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : l.none;
}

function referencesBlock(d: DossierData, l: (typeof LABELS)[Locale]): string {
  return d.references.length ? d.references.map((r) => `- ${r.apa}`).join("\n") : l.none;
}

/** The user message for a review of one outcome. All teacher material is data. */
export function buildCoachMessage(d: DossierData, outcomeId: string, locale: Locale): string {
  const o = outcomeOf(d, outcomeId);
  const l = LABELS[locale];
  const chapter = d.chapters.find((ch) => ch.outcomeId === outcomeId)?.text.trim() ?? "";
  const required = o.requiredEvidence.length
    ? o.requiredEvidence.map((r) => `- ${r}`).join("\n")
    : l.none;
  return [
    `${l.institution}: ${d.framework.institution || l.none}`,
    ...(d.framework.provisional ? [l.provisional] : []),
    `${l.outcome}: ${[o.code, o.title].filter(Boolean).join(" ")}`,
    `<criteria>\n${criteriaBlock(o, l)}\n</criteria>`,
    `<required-evidence>\n${l.required}:\n${required}\n</required-evidence>`,
    `<requirements>\n${l.requirements}:\n${requirementsBlock(d, l)}\n</requirements>`,
    `<chapter>\n${chapter ? clip(chapter, COACH_INPUT_LIMITS.chapter, l.truncated) : l.empty}\n</chapter>`,
    `<evidence>\n${evidenceBlock(d, o, l)}\n</evidence>`,
    `<references>\n${referencesBlock(d, l)}\n</references>`,
  ].join("\n\n");
}

/**
 * The teacher's material for some criteria of one outcome, as tagged blocks (guided writing,
 * `guided.ts`): the outcome line, those criteria, only their linked evidence, the chapter so far
 * and the reference list. `hasEvidence` is false when none of it has text yet.
 */
export function criteriaMaterial(
  d: DossierData,
  outcomeId: string,
  criterionIds: readonly string[],
  chapter: string,
  locale: Locale,
) {
  const o = outcomeOf(d, outcomeId);
  const l = LABELS[locale];
  const text = chapter.trim();
  return {
    outcome: `${l.outcome}: ${[o.code, o.title].filter(Boolean).join(" ")}`,
    criteria: `<criteria>\n${criteriaBlock(o, l, criterionIds)}\n</criteria>`,
    evidence: `<evidence>\n${evidenceBlock(d, o, l, criterionIds)}\n</evidence>`,
    chapter: `<chapter-so-far>\n${text ? clip(text, COACH_INPUT_LIMITS.chapter, l.truncated) : l.empty}\n</chapter-so-far>`,
    references: `<references>\n${referencesBlock(d, l)}\n</references>`,
    hasEvidence: d.evidence.some(
      (e) => e.criterionIds.some((id) => criterionIds.includes(id)) && !evidencePending(e),
    ),
  };
}

// ── Checking the answer ─────────────────────────────────────────────────────

const RawCriterion = z.object({
  key: z.string(),
  verdict: z.enum(VERDICTS),
  quote: z.string().nullish(),
  gap: z.string().nullish(),
  strengthen: z.array(z.string()).nullish(),
  evidenceNeeded: z.array(z.string()).nullish(),
});
const RawReview = z.object({ criteria: z.array(RawCriterion), overall: z.string().nullish() });

export type ParseResult =
  | { ok: true; review: CoachReview }
  | { ok: false; error: "unparseable" | "incomplete" };

function normalize(s: string): string {
  return s
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Is `quote` in `chapter`? Elisions ("…" / "...") allow gaps, in order. */
export function quoteInChapter(quote: string, chapter: string): boolean {
  const hay = normalize(chapter);
  const parts = normalize(quote)
    .replace(/^["']|["']$/g, "")
    .split(/\s*(?:…|\.\.\.|\[…\]|\[\.\.\.\])\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return false;
  let from = 0;
  for (const p of parts) {
    const at = hay.indexOf(p, from);
    if (at < 0) return false;
    from = at + p.length;
  }
  return true;
}

const YEAR = /\b(19|20)\d{2}[a-z]?\b/g;
const CAPITALIZED = /\p{Lu}[\p{L}'’-]+/gu;

/**
 * Does `text` cite an author + year that the reference list does not contain?
 * Simple on purpose: the surname is the last capitalized word before the year.
 */
export function citesUnknownSource(text: string, references: string[]): boolean {
  const refs = references.map((r) => r.toLowerCase());
  for (const m of text.matchAll(YEAR)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 60), m.index);
    const names = before.match(CAPITALIZED);
    const surname = names?.[names.length - 1]?.toLowerCase();
    if (!surname) continue;
    const year = m[0].slice(0, 4);
    if (!refs.some((r) => r.includes(surname) && r.includes(year))) return true;
  }
  return false;
}

function cleanList(items: string[] | null | undefined, references: string[]): string[] {
  return (items ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !citesUnknownSource(s, references))
    .map((s) => s.slice(0, COACH_LIMITS.item))
    .slice(0, COACH_LIMITS.items);
}

const trimTo = (s: string | null | undefined, max: number) => {
  const t = s?.trim();
  return t ? t.slice(0, max) : undefined;
};

/** Checks and maps a raw model answer. Never throws. */
export function parseCoachReview(raw: string, d: DossierData, outcomeId: string): ParseResult {
  const parsed = RawReview.safeParse(extractJson(raw));
  if (!parsed.success) return { ok: false, error: "unparseable" };
  const keys = criterionKeys(d, outcomeId);
  const seen = new Set<string>();
  for (const c of parsed.data.criteria) {
    if (!Object.hasOwn(keys, c.key) || seen.has(c.key)) return { ok: false, error: "incomplete" };
    seen.add(c.key);
  }
  if (seen.size !== Object.keys(keys).length) return { ok: false, error: "incomplete" };

  const chapter = d.chapters.find((ch) => ch.outcomeId === outcomeId)?.text ?? "";
  const references = d.references.map((r) => r.apa);
  const order = Object.keys(keys);
  const criteria: CriterionReview[] = [...parsed.data.criteria]
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((c) => {
      const quote = trimTo(c.quote, COACH_LIMITS.quote);
      const verified = quote ? quoteInChapter(quote, chapter) : false;
      const out: CriterionReview = {
        criterionId: keys[c.key] ?? "",
        verdict: quote && !verified && c.verdict === "shown" ? "partial" : c.verdict,
        strengthen: cleanList(c.strengthen, references),
        evidenceNeeded: cleanList(c.evidenceNeeded, references),
      };
      if (quote && verified) out.quote = quote;
      if (quote && !verified) out.quoteUnverified = true;
      const gap = trimTo(c.gap, COACH_LIMITS.gap);
      if (gap) out.gap = gap;
      return out;
    });
  return {
    ok: true,
    review: { criteria, overall: trimTo(parsed.data.overall, COACH_LIMITS.overall) ?? "" },
  };
}
