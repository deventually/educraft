/**
 * Designing a course in broad outline (the course wizard, step 1), the pure half: what the
 * teacher gives (a short description, the EC, the weeks), what the model gets to see, and how its
 * proposal of learning outcomes is checked. The answer is an `ImportProposal` marked
 * `source: "design"`: the teacher ticks and edits it in the same review form as an import, and
 * `import-apply` adds what is ticked. Nothing is stored before that. No server, no provider:
 * `app/server/courseDesign.server.ts` does the call.
 */
import { z } from "zod";
import { extractJson, wrapAsData } from "~/lib/ai/structuredAnswer";
import { normalizeForMatch } from "~/lib/documents/locate";
import { BLOOM_LEVELS, type BloomLevel } from "./bloom";
import type { ImportOutcome, ImportProposal } from "./import";
import { optionalNumber } from "./intentFields";
import { COURSE_LIMITS } from "./schema";
import type { CourseData } from "./types";

export const DESIGN_LIMITS = {
  /** The teacher's description: a few sentences, never a whole document. */
  description: 2_000,
  /** A course has a handful of outcomes; more is a list of topics. */
  outcomes: 8,
  criteria: 4,
  notes: 2_000,
};

// ── What the teacher gives ──────────────────────────────────────────────────

export interface DesignBrief {
  description: string;
  ec?: number;
  weeks?: number;
}

const BriefSchema = z.object({
  description: z.string().trim().min(1).max(DESIGN_LIMITS.description),
  ec: optionalNumber(0, COURSE_LIMITS.ec),
  weeks: optionalNumber(1, COURSE_LIMITS.week, true),
});

/** The design form, checked again on the server; `null` for anything off. */
export function parseDesignBrief(fd: FormData): DesignBrief | null {
  const one = (name: string) => {
    const v = fd.get(name);
    return typeof v === "string" ? v : undefined;
  };
  const r = BriefSchema.safeParse({
    description: one("description") ?? "",
    ec: one("ec"),
    weeks: one("weeks"),
  });
  if (!r.success) return null;
  const { description, ec, weeks } = r.data;
  return { description, ...(ec ? { ec } : {}), ...(weeks ? { weeks } : {}) };
}

/**
 * What the teacher typed becomes part of the course, but only where the course is still empty:
 * the EC, the number of weeks in the schedule, and the description. Nothing filled in changes.
 */
export function applyDesignBrief(d: CourseData, b: DesignBrief): CourseData {
  return {
    ...d,
    ...(d.ec === undefined && b.ec ? { ec: b.ec } : {}),
    ...(!d.description ? { description: b.description } : {}),
    ...(d.schedule?.weeks === undefined && b.weeks
      ? { schedule: { ...d.schedule, weeks: b.weeks } }
      : {}),
  };
}

// ── What the model sees ─────────────────────────────────────────────────────

export interface OutcomesDesignInput {
  name: string;
  brief: DesignBrief;
  /** The names of the course's disciplines, so the outcomes cover them. */
  disciplines: string[];
  /** The course's context profile (level, sector), as `formatProfile` writes it; "" for none. */
  context: string;
}

/** The user message: what is known about the course, and the description as data. */
export function buildOutcomesDesignMessage(input: OutcomesDesignInput): string {
  const { brief } = input;
  const parts = [`<course>${input.name.trim().slice(0, COURSE_LIMITS.title)}</course>`];
  if (brief.ec) parts.push(`<studyLoad>${brief.ec} EC</studyLoad>`);
  if (brief.weeks) parts.push(`<weeks>${brief.weeks}</weeks>`);
  if (input.disciplines.length)
    parts.push(
      `<disciplines>\n${input.disciplines.map((n) => `- ${n}`).join("\n")}\n</disciplines>`,
    );
  if (input.context.trim()) parts.push(wrapAsData("context", input.context.trim()));
  parts.push(wrapAsData("description", brief.description, DESIGN_LIMITS.description));
  return parts.join("\n\n");
}

// ── Checking the answer ─────────────────────────────────────────────────────

const RawDesign = z.object({
  outcomes: z.array(
    z.object({
      text: z.string(),
      bloom: z.string().nullish(),
      criteria: z.array(z.string()).nullish(),
    }),
  ),
  notes: z.string().nullish(),
});

export type DesignParseResult =
  | { ok: true; proposal: ImportProposal; clipped: boolean }
  | { ok: false; error: "unparseable" }
  /** A valid answer without outcomes; `notes` is the model's explanation, if any. */
  | { ok: false; error: "empty"; notes?: string };

const comparable = (s: string) => normalizeForMatch(s).replace(/[.;:]$/, "");

/**
 * Parses and checks the model's proposal. Never throws. Empty outcomes and duplicates go, an
 * unknown Bloom level is left out, and the proposal is cut to `DESIGN_LIMITS`. Nothing here is
 * from a document, so `verbatim` is false throughout; the review form shows the whole proposal
 * as the AI's.
 */
export function parseOutcomesDesign(raw: string, course: CourseData): DesignParseResult {
  const parsed = RawDesign.safeParse(extractJson(raw));
  if (!parsed.success) return { ok: false, error: "unparseable" };
  let clipped = false;
  const cut = (s: string, max: number) => {
    const t = s.trim();
    if (t.length > max) clipped = true;
    return t.slice(0, max);
  };

  const seen = new Set<string>();
  const unique = parsed.data.outcomes.filter((o) => {
    const k = comparable(o.text);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length > DESIGN_LIMITS.outcomes) clipped = true;
  const have = new Set(course.outcomes.map((o) => comparable(o.text)));

  const outcomes: ImportOutcome[] = unique.slice(0, DESIGN_LIMITS.outcomes).map((o, i) => {
    const text = cut(o.text, COURSE_LIMITS.text);
    const bloom = BLOOM_LEVELS.includes(o.bloom as BloomLevel) ? (o.bloom as BloomLevel) : null;
    const criteria = (o.criteria ?? []).map((c) => c.trim()).filter(Boolean);
    if (criteria.length > DESIGN_LIMITS.criteria) clipped = true;
    return {
      key: `o${i + 1}`,
      text,
      ...(bloom ? { bloom } : {}),
      verbatim: false,
      existing: have.has(comparable(text)),
      criteria: criteria
        .slice(0, DESIGN_LIMITS.criteria)
        .map((c) => ({ text: cut(c, COURSE_LIMITS.text), verbatim: false })),
    };
  });

  const notes = cut(parsed.data.notes ?? "", DESIGN_LIMITS.notes);
  if (outcomes.length === 0) return { ok: false, error: "empty", ...(notes ? { notes } : {}) };
  return {
    ok: true,
    proposal: {
      source: "design",
      outcomes,
      assessments: [],
      ...(notes ? { notes } : {}),
      weightsOff: false,
    },
    clipped,
  };
}
