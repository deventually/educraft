/**
 * Evidence in one go (advice "vereenvoudigen", point 3): several files at once, each sorted by
 * the AI into a learning outcome, a kind, criteria and a line of the required evidence. The
 * pure half: the message, the code checks on the answer, the name check and the batch edit.
 *
 * The AI only proposes. Nothing is linked until the teacher ticks it, and anything the AI
 * doubted, or that the code had to correct, is marked "Controleren" (`check`). Files are read
 * in the browser; the name check runs per file before any text leaves it.
 */
import { z } from "zod";
import { extractJson } from "~/lib/ai/structuredAnswer";
import type { Locale } from "~/lib/i18n";
import { applyRedactions, findRedactions } from "~/lib/privacy/redact";
import * as edit from "./edit";
import { LIMITS } from "./schema";
import { type DossierData, EVIDENCE_KINDS, type EvidenceKind, type Outcome } from "./types";

export const SORT_PROMPT_ID = "portfolio-evidence-sort@v1";

export const BATCH_LIMITS = {
  /** Files per batch: a folder with a subfolder per outcome fits easily. */
  files: 30,
  /** Characters of each file the AI reads to sort it. */
  excerpt: 6_000,
  /** A file name with its folder path. */
  name: 300,
  reason: 300,
} as const;

export interface BatchFile {
  key: string;
  /** The file name, with its folder path when a folder was chosen ("LU1/lesplan.docx"). */
  name: string;
  /** The text after the name check. */
  text: string;
}

/** The AI's proposal for one file, after the code checks. */
export interface SortProposal {
  key: string;
  title: string;
  kind: EvidenceKind;
  outcomeId?: string;
  criterionIds: string[];
  /** A line of the outcome's required evidence, in the form's own words. */
  line?: string;
  /** "Controleren": the AI doubted, the code corrected its answer, or there was none. */
  check: boolean;
  reason?: string;
}

// ── The message ─────────────────────────────────────────────────────────────

const LABELS = {
  nl: { noText: "(Er is geen tekst gelezen uit dit bestand; ga alleen uit van de naam.)" },
  en: { noText: "(No text could be read from this file; go by its name only.)" },
} as const;

const attr = (s: string) => s.replace(/["<>\n]/g, " ");
/** The file's text cannot close or open the tags around it. */
const data = (s: string) => s.replace(/<(\/?)(file|framework|outcome)/gi, "‹$1$2");

const outcomeKey = (i: number) => `U${i + 1}`;

function outcomeBlock(o: Outcome, i: number): string {
  const key = outcomeKey(i);
  const lines = [
    `<outcome key="${key}">${data([o.code, o.title].filter(Boolean).join(" "))}`,
    ...o.criteria.map((c, j) => `<criterion key="${key}.C${j + 1}">${data(c.text)}</criterion>`),
    ...o.requiredEvidence.map((r, j) => `<required key="${key}.R${j + 1}">${data(r)}</required>`),
    "</outcome>",
  ];
  return lines.join("\n");
}

/** The user message for one file: the whole framework, keyed, then an excerpt of the file. */
export function buildSortMessage(
  d: DossierData,
  file: Pick<BatchFile, "name" | "text">,
  locale: Locale,
): string {
  const text = file.text.trim();
  const body = text ? data(text.slice(0, BATCH_LIMITS.excerpt)) : LABELS[locale].noText;
  return [
    `<framework>\n${d.framework.outcomes.map(outcomeBlock).join("\n")}\n</framework>`,
    `<file name="${attr(file.name.slice(0, BATCH_LIMITS.name))}">\n${body}\n</file>`,
  ].join("\n\n");
}

// ── Checking the answer ─────────────────────────────────────────────────────

const RawAnswer = z.object({
  outcome: z.string().nullish(),
  kind: z.string().nullish(),
  criteria: z.array(z.unknown()).nullish(),
  required: z.string().nullish(),
  title: z.string().nullish(),
  sure: z.boolean().nullish(),
  reason: z.string().nullish(),
});

/** "Mijn bewijs/LU1/lesplan.docx" → "lesplan". */
export function baseName(name: string): string {
  const last = name.split(/[\\/]/).pop() ?? name;
  return (last.replace(/\.[a-z0-9]{1,5}$/i, "").trim() || last).slice(0, LIMITS.title);
}

const isKind = (k: unknown): k is EvidenceKind =>
  typeof k === "string" && (EVIDENCE_KINDS as readonly string[]).includes(k);

/**
 * The proposal for one file. Keys are mapped back to ids and the form's own line; anything of
 * another outcome or unknown is dropped. Doubt, a correction, no criteria or no text: a check.
 */
export function parseSortAnswer(
  raw: string | null,
  d: DossierData,
  file: Pick<BatchFile, "key" | "name"> & { text?: string },
): SortProposal {
  const fallback: SortProposal = {
    key: file.key,
    title: baseName(file.name),
    kind: "other",
    criterionIds: [],
    check: true,
  };
  const parsed = raw === null ? null : RawAnswer.safeParse(extractJson(raw));
  if (!parsed?.success || parsed.data.outcome === undefined) return fallback;
  const a = parsed.data;

  let corrected = false;
  const index = d.framework.outcomes.findIndex((_, i) => outcomeKey(i) === a.outcome);
  const outcome = d.framework.outcomes[index];
  if (a.outcome && !outcome) corrected = true;

  const criterionIds: string[] = [];
  let line: string | undefined;
  if (outcome) {
    const key = outcomeKey(index);
    for (const c of a.criteria ?? []) {
      const m = typeof c === "string" ? new RegExp(`^${key}\\.C(\\d+)$`).exec(c) : null;
      const id = m ? outcome.criteria[Number(m[1]) - 1]?.id : undefined;
      if (id && !criterionIds.includes(id)) criterionIds.push(id);
      else corrected = true;
    }
    if (a.required) {
      const m = new RegExp(`^${key}\\.R(\\d+)$`).exec(a.required);
      line = m ? outcome.requiredEvidence[Number(m[1]) - 1] : undefined;
      if (!line) corrected = true;
    }
  }

  const kind = isKind(a.kind) ? a.kind : "other";
  const title = a.title?.replace(/\s+/g, " ").trim().slice(0, LIMITS.title) || fallback.title;
  const reason = a.reason?.replace(/\s+/g, " ").trim().slice(0, BATCH_LIMITS.reason);
  const check =
    a.sure !== true ||
    corrected ||
    !outcome ||
    criterionIds.length === 0 ||
    !isKind(a.kind) ||
    (file.text !== undefined && file.text.trim() === "");
  return {
    key: file.key,
    title,
    kind,
    ...(outcome ? { outcomeId: outcome.id } : {}),
    criterionIds,
    ...(line ? { line } : {}),
    check,
    ...(reason ? { reason } : {}),
  };
}

// ── The name check (in the browser) ─────────────────────────────────────────

/**
 * Replaces the student names the teacher listed, and what looks like an e-mail address, phone
 * number, postcode, IBAN or student number, by a code (`~/lib/privacy/redact`). Each finding
 * is listed once, so the teacher sees per file what went.
 */
export function checkNames(
  text: string,
  names: readonly string[],
): { text: string; found: { code: string; original: string }[] } {
  const entries = names.map((value) => ({ kind: "student" as const, value }));
  const spans = findRedactions(text, entries);
  const seen = new Set<string>();
  const found = spans.flatMap((s) => {
    const id = `${s.code}\u0000${s.original.toLowerCase()}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ code: s.code, original: s.original }];
  });
  return { text: applyRedactions(text, spans).text, found };
}

// ── The form boundary ───────────────────────────────────────────────────────

const Id = z.string().min(1).max(LIMITS.id);

/** A JSON form field, parsed and then checked against `schema`. */
const json = <T extends z.ZodType>(schema: T, maxChars: number) =>
  z
    .string()
    .max(maxChars)
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "invalid JSON" });
        return z.NEVER;
      }
    })
    .pipe(schema);

export const BatchFilesSchema = json(
  z
    .array(
      z.object({
        key: Id,
        name: z.string().min(1).max(BATCH_LIMITS.name),
        text: z.string().max(BATCH_LIMITS.excerpt),
      }),
    )
    .min(1)
    .max(BATCH_LIMITS.files),
  BATCH_LIMITS.files * (BATCH_LIMITS.excerpt + BATCH_LIMITS.name + 200),
);

const BatchItem = z.object({
  title: z.string().trim().min(1).max(LIMITS.title),
  kind: z.enum(EVIDENCE_KINDS),
  text: z.string().max(LIMITS.documentText),
  outcomeId: Id.optional(),
  criterionIds: z.array(Id).max(LIMITS.criteriaPerOutcome),
  line: z.string().min(1).max(LIMITS.requiredEvidenceText).optional(),
});
export type BatchItem = z.infer<typeof BatchItem>;

export const BatchItemsSchema = json(
  z.array(BatchItem).min(1).max(BATCH_LIMITS.files),
  BATCH_LIMITS.files * (LIMITS.documentText + 2_000),
);

/**
 * Adds the ticked items, each with its criteria and required-evidence line. Throws on a
 * criterion or line that is not the item's outcome's, or when the dossier would be too full:
 * the whole batch is refused, nothing half-stored.
 */
export function addEvidenceBatch(d: DossierData, items: readonly BatchItem[]): DossierData {
  if (d.evidence.length + items.length > LIMITS.evidence) throw new RangeError("too many");
  let next = d;
  for (const { outcomeId, line, ...item } of items) {
    const outcome = outcomeId ? d.framework.outcomes.find((o) => o.id === outcomeId) : undefined;
    if (outcomeId && !outcome) throw new RangeError("unknown outcome");
    const own = new Set(outcome?.criteria.map((c) => c.id) ?? []);
    if (item.criterionIds.some((id) => !own.has(id))) throw new RangeError("foreign criterion");
    if (line && !outcome?.requiredEvidence.includes(line))
      throw new RangeError("unknown requirement");
    next = edit.addEvidence(next, {
      ...item,
      ...(line && outcome ? { requirements: [{ outcomeId: outcome.id, line }] } : {}),
    });
  }
  return next;
}
