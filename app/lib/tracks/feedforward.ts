/**
 * Feedforward on a draft of an internship or thesis report (brief P38.3), the pure half: what the
 * model gets to see, and how its answer is checked before the teacher sees it. No server, no
 * provider: `app/server/trackFeedforward.server.ts` does the call.
 *
 * The draft is anonymised in the browser (`app/lib/privacy/redact.ts`). Anti-fabrication and the
 * "no judgement" rule live here:
 * - feedforward gives no level or grade: a line with one is dropped;
 * - a follow-up on an earlier point needs a quote literally in the new version; without one an
 *   "addressed" or "partly" becomes "not visible", and so does an earlier point the model skipped;
 * - unknown points, duplicates and malformed items are dropped; everything is capped.
 * Advice only: the teacher decides.
 */
import { z } from "zod";
import { extractJson, wrapAsData } from "~/lib/ai/structuredAnswer";
import { locateQuote } from "~/lib/portfolio/proofread";

export const FEEDFORWARD_LIMITS = {
  /** Characters of the criteria (an assessment model's framework). */
  criteria: 12,
  criteriaText: 12_000,
  /** Characters of the anonymised draft sent to the model. */
  version: 120_000,
  /** Strengths and improvements per criterion. */
  lines: 4,
  line: 600,
  label: 160,
  quote: 400,
  /** Earlier points carried into the next round. */
  previous: 40,
} as const;

/** An improvement point from an earlier round, numbered for the next. */
export interface FeedbackPoint {
  id: string;
  criterion: string;
  text: string;
}

export const FOLLOW_UP_STATUSES = ["addressed", "partly", "not", "unseen"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export interface Feedforward {
  criteria: { criterion: string; strengths: string[]; improvements: string[] }[];
  followUp: { point: string; status: FollowUpStatus; quote: string | null }[];
}

/** The user message. The draft and the criteria are data, never instruction. */
export function buildFeedforwardMessage(input: {
  criteria: string;
  version: string;
  previous: FeedbackPoint[];
  /** The teaching context as `formatProfile` writes it; "" for none. */
  context: string;
}): string {
  const L = FEEDFORWARD_LIMITS;
  const parts = [
    wrapAsData("criteria", input.criteria.trim(), L.criteriaText),
    wrapAsData("version", input.version.trim(), L.version),
  ];
  if (input.previous.length)
    parts.push(
      wrapAsData(
        "previous",
        input.previous
          .slice(0, L.previous)
          .map((p) => `[${p.id}] ${p.criterion}: ${p.text}`)
          .join("\n"),
      ),
    );
  if (input.context.trim()) parts.push(wrapAsData("context", input.context.trim()));
  return parts.join("\n\n");
}

// ── Checking the answer ─────────────────────────────────────────────────────

/**
 * A level or grade in a line: a mark out of ten, "Cijfer: 8" or "Grade: B", "I'd give this a 7",
 * a verdict after a copula ("is onvoldoende", "is sufficient") or on its own ("Voldoende."), or
 * excellent. The ordinary words
 * stay: "a figure" (cijfer), "enough interviews" (voldoende), "sufficient detail".
 */
export const JUDGEMENT = new RegExp(
  [
    String.raw`\b\d{1,2}([.,]\d)?\s*\/\s*10\b`,
    String.raw`\b(grade|cijfer|score|niveau|level|oordeel)\s*:\s*([A-F][+-]?(?![\w])|\d)`,
    String.raw`\b(geef|geven|krijgt|scoort|verdient|give|gives|scores|deserves)\s+((dit|het|je|this|it)\s+)?(een|a|an)\s+\d{1,2}([.,]\d)?(?![\w-])`,
    String.raw`\b(is|zijn|lijkt|lijken|was|wordt|are|seems|looks)\s+((nog|niet|still|not)\s+)?(onvoldoende|voldoende|insufficient|sufficient|goed genoeg|good enough)\b`,
    String.raw`^\s*(onvoldoende|voldoende|insufficient|sufficient)\s*([.!:,]|voor\b|for\b|$)`,
    String.raw`\b(excellent|uitstekend)e?\b`,
  ].join("|"),
  "i",
);

const RawAnswer = z.object({
  criteria: z.array(z.unknown()).default([]),
  followUp: z.array(z.unknown()).default([]),
});
const RawCriterion = z.object({
  criterion: z.string().trim().min(1),
  strengths: z.array(z.unknown()).default([]),
  improvements: z.array(z.unknown()).default([]),
});
const RawFollowUp = z.object({
  point: z.string(),
  status: z.enum(["addressed", "partly", "not"]),
  quote: z.string().nullish(),
});

export type FeedforwardParseResult =
  | { ok: true; result: Feedforward; dropped: number }
  | { ok: false; error: "unparseable" };

/** Checks and maps a raw model answer. Never throws. */
export function parseFeedforward(
  raw: string,
  ctx: { version: string; previous: FeedbackPoint[] },
): FeedforwardParseResult {
  const parsed = RawAnswer.safeParse(extractJson(raw));
  if (!parsed.success) return { ok: false, error: "unparseable" };
  const L = FEEDFORWARD_LIMITS;
  let dropped = 0;

  const lines = (items: unknown[]) => {
    const out: string[] = [];
    for (const item of items) {
      const text = typeof item === "string" ? item.trim() : "";
      if (!text || JUDGEMENT.test(text) || out.includes(text)) dropped++;
      else out.push(text.slice(0, L.line));
    }
    return out.slice(0, L.lines);
  };

  const criteria: Feedforward["criteria"] = [];
  for (const item of parsed.data.criteria) {
    const c = RawCriterion.safeParse(item);
    if (!c.success) {
      dropped++;
      continue;
    }
    criteria.push({
      criterion: c.data.criterion.slice(0, L.label),
      strengths: lines(c.data.strengths),
      improvements: lines(c.data.improvements),
    });
  }

  const known = new Set(ctx.previous.map((p) => p.id));
  const seen = new Map<string, Feedforward["followUp"][number]>();
  for (const item of parsed.data.followUp) {
    const f = RawFollowUp.safeParse(item);
    if (!f.success || !known.has(f.data.point) || seen.has(f.data.point)) {
      dropped++;
      continue;
    }
    const quote = f.data.quote ? locateQuote(f.data.quote, ctx.version) : null;
    const usable = quote && quote.length <= L.quote ? quote : null;
    if (f.data.quote && !usable) dropped++;
    const status: FollowUpStatus =
      f.data.status === "not" ? "not" : usable ? f.data.status : "unseen";
    seen.set(f.data.point, {
      point: f.data.point,
      status,
      quote: status === "not" ? null : usable,
    });
  }
  const followUp = ctx.previous.map(
    (p) => seen.get(p.id) ?? { point: p.id, status: "unseen" as const, quote: null },
  );

  return { ok: true, dropped, result: { criteria: criteria.slice(0, L.criteria), followUp } };
}

/** Every improvement of a result, numbered: the earlier points of the next round. */
export function previousPoints(result: Feedforward): FeedbackPoint[] {
  return result.criteria
    .flatMap((c) => c.improvements.map((text) => ({ criterion: c.criterion, text })))
    .slice(0, FEEDFORWARD_LIMITS.previous)
    .map((p, i) => ({ id: `p${i + 1}`, ...p }));
}

/** The feedback as Markdown, as a round keeps it, in the teacher's language. */
export function feedforwardMarkdown(
  result: Feedforward,
  previous: FeedbackPoint[],
  labels: {
    strong: string;
    improve: string;
    followUp: string;
    status: Record<FollowUpStatus, string>;
  },
): string {
  const out: string[] = [];
  if (result.followUp.length) {
    out.push(`## ${labels.followUp}`, "");
    for (const f of result.followUp) {
      const point = previous.find((p) => p.id === f.point)?.text ?? f.point;
      out.push(`- **${labels.status[f.status]}:** ${point}${f.quote ? ` *"${f.quote}"*` : ""}`);
    }
    out.push("");
  }
  for (const c of result.criteria) {
    out.push(`### ${c.criterion}`, "");
    for (const s of c.strengths) out.push(`- **${labels.strong}:** ${s}`);
    for (const s of c.improvements) out.push(`- **${labels.improve}:** ${s}`);
    out.push("");
  }
  return out.join("\n").trim();
}
