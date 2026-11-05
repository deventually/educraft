/**
 * Framework extraction (brief P25, 25.4), the pure half: what the model gets
 * to see, and how its answer is checked before it becomes a proposal. No
 * server, no provider: `app/server/portfolioExtract.server.ts` does the call.
 *
 * The result is a proposal, never the truth: it is stored unconfirmed, and a
 * criterion whose text is not verbatim in the form (modulo layout) is marked
 * `unverified`, so the teacher checks it before confirming.
 */
import { z } from "zod";
import {
  STRUCTURED_INPUT_LIMIT,
  extractJson,
  verbatimIn,
  wrapAsData,
} from "~/lib/ai/structuredAnswer";
import { normalizeForMatch } from "~/lib/documents/locate";
import { LIMITS } from "./schema";
import type { DossierData, FormRequirements, Framework, Outcome } from "./types";

/** At most this much form text goes to the model (cost and context bound). */
export const EXTRACT_INPUT_LIMIT = STRUCTURED_INPUT_LIMIT;

/** The user message: the form text, as data. */
export function buildExtractMessage(formText: string): string {
  return wrapAsData("form", formText);
}

// ── Checking the answer ─────────────────────────────────────────────────────

const str = z.string().nullish();
const num = z.number().nullish();
const RawFramework = z.object({
  institution: str,
  year: str,
  outcomes: z.array(
    z.object({
      code: str,
      title: str,
      criteria: z.array(z.object({ text: z.string(), strongLevel: str })).nullish(),
      requiredEvidence: z.array(z.string()).nullish(),
    }),
  ),
  requirements: z
    .object({
      maxWords: num,
      minConstructedItems: num,
      minAnalysedItems: num,
      aiDisclosureRequired: z.boolean().nullish(),
      notes: str,
    })
    .nullish(),
});

export type ExtractParseResult =
  | { ok: true; framework: Framework; flagged: number; clipped: boolean }
  | { ok: false; error: "unparseable" | "empty" };

/** Parses, clips to the dossier limits and checks a raw model answer. Never throws. */
export function parseExtraction(raw: string, formText: string): ExtractParseResult {
  const parsed = RawFramework.safeParse(extractJson(raw));
  if (!parsed.success) return { ok: false, error: "unparseable" };
  const r = parsed.data;
  let clipped = false;
  const cut = (s: string | null | undefined, max: number): string => {
    const t = (s ?? "").trim();
    if (t.length > max) clipped = true;
    return t.slice(0, max);
  };
  const take = <T>(items: T[], max: number): T[] => {
    if (items.length > max) clipped = true;
    return items.slice(0, max);
  };

  const form = normalizeForMatch(formText);
  let flagged = 0;
  const outcomes: Outcome[] = take(
    r.outcomes.filter((o) => (o.title ?? o.code ?? "").trim()),
    LIMITS.outcomes,
  ).map((o) => {
    const code = cut(o.code, LIMITS.code);
    const criteria = take(
      (o.criteria ?? []).filter((c) => c.text.trim()),
      LIMITS.criteriaPerOutcome,
    ).map((c) => {
      const text = cut(c.text, LIMITS.criterionText);
      const strongLevel = cut(c.strongLevel, LIMITS.criterionText);
      const unverified = !verbatimIn(text, form);
      if (unverified) flagged++;
      return {
        id: crypto.randomUUID(),
        text,
        ...(strongLevel ? { strongLevel } : {}),
        ...(unverified ? { unverified: true } : {}),
      };
    });
    return {
      id: crypto.randomUUID(),
      code,
      title: cut(o.title, LIMITS.title) || code,
      criteria,
      requiredEvidence: take(
        (o.requiredEvidence ?? []).map((e) => cut(e, LIMITS.requiredEvidenceText)).filter(Boolean),
        LIMITS.requiredEvidence,
      ),
    };
  });
  if (!outcomes.some((o) => o.criteria.length > 0)) return { ok: false, error: "empty" };

  const req = r.requirements ?? {};
  const count = (n: number | null | undefined, max: number, min: number) =>
    typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : undefined;
  const notes = cut(req.notes, LIMITS.notes);
  const requirements: FormRequirements = Object.fromEntries(
    Object.entries({
      maxWords: count(req.maxWords, 100_000, 1),
      minConstructedItems: count(req.minConstructedItems, 500, 0),
      minAnalysedItems: count(req.minAnalysedItems, 500, 0),
      aiDisclosureRequired: req.aiDisclosureRequired ?? undefined,
      notes: notes || undefined,
    }).filter(([, v]) => v !== undefined),
  );
  const year = cut(r.year, 20);
  return {
    ok: true,
    framework: {
      institution: cut(r.institution, LIMITS.name),
      ...(year ? { year } : {}),
      outcomes,
      requirements,
    },
    flagged,
    clipped,
  };
}

// ── Applying the proposal ───────────────────────────────────────────────────

/** Does any teacher work hang on the current framework? Then extraction must not replace it. */
export function frameworkInUse(d: DossierData): boolean {
  return (
    Object.keys(d.status).length > 0 ||
    d.evidence.some((e) => e.criterionIds.length > 0) ||
    d.chapters.some((ch) => ch.text.trim().length > 0) ||
    Object.keys(d.reviews ?? {}).length > 0
  );
}

/**
 * Replaces the framework with the proposal, unconfirmed. Fields the form does
 * not name keep what the teacher had. Refused when work depends on the
 * current framework (statuses, linked evidence, chapters, reviews).
 */
export function applyExtraction(
  d: DossierData,
  proposal: Framework,
): { ok: true; data: DossierData } | { ok: false; error: "in-use" } {
  if (frameworkInUse(d)) return { ok: false, error: "in-use" };
  const next = structuredClone(d);
  const year = proposal.year ?? d.framework.year;
  next.framework = {
    institution: proposal.institution || d.framework.institution,
    ...(year ? { year } : {}),
    outcomes: structuredClone(proposal.outcomes),
    requirements: { ...d.framework.requirements, ...proposal.requirements },
  };
  // Empty chapters of the old outcomes would point at nothing.
  next.chapters = [];
  delete next.reviews;
  return { ok: true, data: next };
}
