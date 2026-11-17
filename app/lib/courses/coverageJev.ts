/**
 * TypeSafe's Jev (a decision model, not an LLM) checks the course import's reading of each test:
 * which outcomes it covers and whether it is formative or summative. TypeSafe's "verify and
 * escalate" pattern: the LLM extracts, Jev answers one yes/no per field, and code marks what the
 * teacher should check. Jev never changes a tick; it only fills a kind the LLM left open. Pure:
 * the passage, the request and the reading of the answer; the call is
 * `app/server/coverageJev.server.ts`, only when `jevAccess()` allows it.
 *
 * Built to TypeSafe's skill and docs (the SDE-cascade cookbook, the jaggedness page):
 * - judgments from Jev, the decision in code (the truth table in `coverageVerdict`);
 * - the state is only what a person would look at: the test's title and the parts of the
 *   document that name it, never the whole document (large state costs accuracy);
 * - one judgment per question: one yes/no per outcome, named in the question as the document
 *   writes it (with its code, so "LU2" in a table needs no lookup), and one for the kind;
 * - thresholds 0.7 / 0.3 as TypeSafe's starting points, the band between with its own row.
 */
import { z } from "zod";
import { locateAll } from "~/lib/documents/locate";
import type { Locale } from "~/lib/i18n";
import type { ImportAssessment, ImportProposal } from "./import";
import type { AssessmentKind } from "./types";

/** All question wording in one place (TypeSafe's skill). */
const TEXT = {
  nl: {
    about:
      "`passage` bevat de stukken uit een cursusdocument (OER, studiehandleiding of toetsplan) waarin de toets `assessment` genoemd wordt.",
    summative:
      "Telt het resultaat van `assessment` volgens `passage` mee voor het eindcijfer of voor het halen van de cursus?",
    summativeYes:
      "Ja: `assessment` is summatief. Het resultaat telt mee, bijvoorbeeld met een weging, een cijfer, een cesuur, een voldoende als voorwaarde of een go/no-go.",
    summativeNo:
      "Nee: `assessment` is formatief. Het is een oefening of een feedbackmoment onderweg, zoals een proeftoets, een oefentoets of een tussentijdse feedbackronde, en telt niet mee.",
    covers: (outcome: string) =>
      `Toetst \`assessment\` volgens \`passage\` deze leeruitkomst: "${outcome}"?`,
    coversYes:
      "Ja: `passage` koppelt `assessment` aan deze leeruitkomst, met haar code of nummer, of met haar inhoud.",
    coversNo:
      "Nee: `passage` koppelt `assessment` alleen aan andere leeruitkomsten, of noemt deze leeruitkomst niet bij `assessment`.",
  },
  en: {
    about:
      "`passage` holds the parts of a course document (study guide, course handbook or assessment plan) that name the test `assessment`.",
    summative:
      "According to `passage`, does the result of `assessment` count towards the final grade or towards passing the course?",
    summativeYes:
      "Yes: `assessment` is summative. Its result counts, for instance through a weight, a grade, a pass mark, a pass as a condition or a go/no-go.",
    summativeNo:
      "No: `assessment` is formative. It is practice or a feedback moment along the way, such as a mock exam, a practice test or an interim feedback round, and does not count.",
    covers: (outcome: string) =>
      `According to \`passage\`, does \`assessment\` assess this learning outcome: "${outcome}"?`,
    coversYes:
      "Yes: `passage` links `assessment` to this learning outcome, by its code or number, or by its content.",
    coversNo:
      "No: `passage` links `assessment` only to other learning outcomes, or does not name this learning outcome with `assessment`.",
  },
} satisfies Record<Locale, Record<string, unknown>>;

/** The passage: this much document before and after each mention of the title. */
const BEFORE = 800;
const AFTER = 1_500;
/** At most this many mentions, and this much passage in all (well within Jev's context). */
const MENTIONS = 4;
const PASSAGE_MAX = 8_000;
/** An outcome named in a question: its line in the document, cut at this length. */
const OUTCOME_MAX = 600;

/**
 * The parts of the document around each mention of `title` (forgiving about layout and case,
 * never about wording), merged where they overlap; `null` when the title is not in it.
 */
export function assessmentPassage(title: string, documentText: string): string | null {
  const hits = locateAll([documentText], title).slice(0, MENTIONS);
  if (hits.length === 0) return null;
  const spans: [number, number][] = [];
  for (const h of hits) {
    const start = Math.max(0, h.start - BEFORE);
    const end = Math.min(documentText.length, h.end + AFTER);
    const last = spans.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else spans.push([start, end]);
  }
  return spans
    .map(([s, e]) => documentText.slice(s, e).trim())
    .join("\n…\n")
    .slice(0, PASSAGE_MAX);
}

/** The outcome as the document writes it, from the start of its line (with "LU2"); else its text. */
export function outcomeAsWritten(text: string, documentText: string): string {
  const [hit] = locateAll([documentText], text);
  if (!hit) return text;
  const lineStart = documentText.lastIndexOf("\n", hit.start - 1) + 1;
  return documentText
    .slice(lineStart, hit.end)
    .replace(/\s+/g, " ")
    .replace(/(\p{L})- (\p{L})/gu, "$1$2")
    .trim()
    .slice(0, OUTCOME_MAX);
}

interface Noul {
  type: "noul";
  instructions: string;
  criteria: { true: string; false: string };
}

export interface CoverageJevRequest {
  model: string;
  state: { assessment: string; passage: string; about_passage: string };
  questions: Record<string, Noul>;
}

const coversKey = (outcomeKey: string) => `covers_${outcomeKey}`;

/** One request for one test: the kind, and one question per outcome (asked speculatively). */
export function buildCoverageJevRequest(
  input: { title: string; passage: string; outcomes: { key: string; text: string }[] },
  locale: Locale,
  model: string,
): CoverageJevRequest {
  const t = TEXT[locale];
  const questions: Record<string, Noul> = {
    summative: {
      type: "noul",
      instructions: t.summative,
      criteria: { true: t.summativeYes, false: t.summativeNo },
    },
  };
  for (const o of input.outcomes)
    questions[coversKey(o.key)] = {
      type: "noul",
      instructions: t.covers(o.text),
      criteria: { true: t.coversYes, false: t.coversNo },
    };
  return {
    model,
    state: { assessment: input.title, passage: input.passage, about_passage: t.about },
    questions,
  };
}

/**
 * The requests for a whole proposal, one per test Jev can read: not one the course already has
 * (it keeps its own coverage), not one whose title is not in the document (nothing to read), and
 * none without outcomes. The app and the eval both build them here.
 */
export function coverageJevRequests(
  proposal: ImportProposal,
  documentText: string,
  locale: Locale,
  model: string,
): { key: string; request: CoverageJevRequest }[] {
  if (proposal.outcomes.length === 0) return [];
  const outcomes = proposal.outcomes.map((o) => ({
    key: o.key,
    text: outcomeAsWritten(o.text, documentText),
  }));
  return proposal.assessments.flatMap((a) => {
    const passage = a.existing ? null : assessmentPassage(a.title, documentText);
    if (!passage) return [];
    return [
      {
        key: a.key,
        request: buildCoverageJevRequest({ title: a.title, passage, outcomes }, locale, model),
      },
    ];
  });
}

const Response = z.object({
  answers: z.record(z.string(), z.object({ type: z.string(), noul: z.number().optional() })),
  usage: z.object({ cost: z.number().optional() }).partial().optional(),
});

export interface CoverageJevAnswer {
  usable: boolean;
  /** P(the test counts); absent when Jev did not answer it. */
  summative?: number;
  /** P(the test covers it), by outcome key. */
  covers: Record<string, number>;
  costUsd?: number;
}

export function parseCoverageJevAnswer(body: unknown): CoverageJevAnswer {
  const parsed = Response.safeParse(body);
  if (!parsed.success) return { usable: false, covers: {} };
  const p = (a: { type: string; noul?: number } | undefined) =>
    a?.type === "noul" ? a.noul : undefined;
  const covers: Record<string, number> = {};
  for (const [k, a] of Object.entries(parsed.data.answers)) {
    const v = p(a);
    if (k.startsWith("covers_") && v !== undefined) covers[k.slice("covers_".length)] = v;
  }
  const summative = p(parsed.data.answers.summative);
  const cost = parsed.data.usage?.cost;
  return {
    usable: true,
    covers,
    ...(summative !== undefined ? { summative } : {}),
    ...(cost !== undefined ? { costUsd: cost } : {}),
  };
}

/** TypeSafe's starting thresholds: yes from 0.7, no up to 0.3, unsettled in between. */
export const COVERAGE_JEV_THRESHOLDS = { yes: 0.7, no: 0.3 } as const;

/**
 * The truth table: the LLM's reading and Jev's answers → what the teacher should check.
 *
 * | LLM ticked the outcome | Jev yes | Jev unsettled | Jev no |
 * | --- | --- | --- | --- |
 * | yes | — | check | check |
 * | no | check | — | — |
 *
 * | LLM's kind | Jev agrees (sure) | Jev unsettled | Jev disagrees (sure) |
 * | --- | --- | --- | --- |
 * | given | — | check | check |
 * | open | Jev's kind | check | Jev's kind |
 *
 * A question Jev left out counts as unsettled; an unusable answer changes nothing. Ticks stay
 * the LLM's: Jev is not measured as better, so it only escalates to the teacher.
 */
export function coverageVerdict(
  a: ImportAssessment,
  outcomeKeys: readonly string[],
  answer: CoverageJevAnswer,
  t: { yes: number; no: number } = COVERAGE_JEV_THRESHOLDS,
): ImportAssessment {
  if (!answer.usable) return a;
  const ticked = new Set(a.outcomeKeys);
  const doubted = outcomeKeys.filter((k) => {
    const p = answer.covers[k];
    return ticked.has(k) ? p === undefined || p < t.yes : p !== undefined && p >= t.yes;
  });
  const s = answer.summative;
  const jevKind: AssessmentKind | undefined =
    s === undefined ? undefined : s >= t.yes ? "summative" : s <= t.no ? "formative" : undefined;
  const fill = !a.kind && jevKind ? { kind: jevKind } : {};
  const kindDoubted = !jevKind || (a.kind !== undefined && a.kind !== jevKind);
  if (!kindDoubted && doubted.length === 0) return { ...a, ...fill };
  return { ...a, ...fill, check: { kind: kindDoubted, outcomeKeys: doubted } };
}
