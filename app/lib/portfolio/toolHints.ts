/**
 * Which LimeOnIt tool helps at which moment of a BDB/BKE dossier (pure data,
 * no LLM). A hint matches on the teacher's own words: the criterion text
 * first, then the outcome title and the evidence the form asks for. Nothing
 * is suggested when no pattern fits; a wrong suggestion is worse than none.
 */
import type { Criterion, Outcome } from "./types";

export type HintStep = "evidence" | "chapter";

export interface ToolHint {
  /** Tool slug in the registry. */
  slug: string;
  /** "evidence": the tool makes something to add to the dossier; "chapter": a thinking partner. */
  step: HintStep;
  /** Dutch and English keywords from criteria. */
  match: RegExp;
}

export const TOOL_HINTS: readonly ToolHint[] = [
  {
    slug: "guided-reflection",
    step: "evidence",
    match:
      /lesontwerp|lesvoorbereiding|lesplan|onderwijssessie|bereid|ontwerp|leerdoel|leeruitkomst|backward|lesson plan|prepar|design|learning (goal|outcome|objective)/i,
  },
  {
    slug: "cognitive-architect",
    step: "evidence",
    match:
      /werkvorm|activerend|leeractiviteit|instructie|opbouw|structuur|activating|learning activit|instruction|structure/i,
  },
  { slug: "arcs-reactor", step: "evidence", match: /motiv|betrokken|engag/i },
  {
    slug: "bloom-by-design",
    step: "evidence",
    match: /technolog|digita|\bict\b|blended|onderwijsmiddel|media/i,
  },
  {
    slug: "contextualization",
    step: "evidence",
    match:
      /opleidingsprofiel|leerlijn|alignment|samenhang|curricul|programme profile|learning line|coherence/i,
  },
  {
    slug: "authentic-assessment",
    step: "evidence",
    match: /toets|rubric|formatie|summatie|assessment|\btests?\b/i,
  },
  {
    slug: "stage-assessment",
    step: "evidence",
    match: /beoordeel|nakijk|\bstage|afstudeer|grading|marking|internship|thesis/i,
  },
  {
    slug: "forum-autograder",
    step: "evidence",
    match: /forum|discussie|interactie|discussion|interaction/i,
  },
  // P27.2: the P24 tools, after the older ones so existing rankings stay put.
  {
    slug: "lesson-plan",
    step: "evidence",
    match:
      /lesontwerp|lesvoorbereiding|lesplan|lesopzet|onderwijssessie|lesson plan|lesson design/i,
  },
  { slug: "test-items", step: "evidence", match: /toets|toetsvra|\btests?\b|test items?|exam/i },
  {
    slug: "rubric-builder",
    step: "evidence",
    match: /rubric|beoordelingsmodel|beoordelingscriteri|nakijkmodel|marking scheme/i,
  },
  {
    slug: "test-analysis",
    step: "evidence",
    match:
      /toetsanalyse|analyse van (de )?toets|itemanalyse|toetskwaliteit|test analysis|item analysis/i,
  },
  {
    slug: "differentiation",
    step: "evidence",
    match:
      /differentia|beginsituatie|verschillen tussen studenten|starting situation|differences between students/i,
  },
  {
    slug: "dialogic-encounters",
    step: "chapter",
    match: /theor|literatuur|onderbouw|literature|justif/i,
  },
  {
    slug: "peer-tutoring",
    step: "chapter",
    match: /literatuur|\bbron|literature|source/i,
  },
  {
    slug: "socratic-partner",
    step: "chapter",
    match: /ontwikkeling|reflect|onderzoekend|development|inquir/i,
  },
];

const MAX = 2;

function rank(
  step: HintStep,
  strong: string,
  weak: string,
  available: Set<string>,
  max = MAX,
): string[] {
  return TOOL_HINTS.filter((h) => h.step === step && available.has(h.slug))
    .map((h, i) => ({
      slug: h.slug,
      i,
      score: h.match.test(strong) ? 2 : h.match.test(weak) ? 1 : 0,
    }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, max)
    .map((h) => h.slug);
}

function outcomeText(o: Outcome): string {
  return [o.title, ...o.requiredEvidence].join("\n");
}

/** Tools that make evidence for this criterion, best first, among the available slugs. */
export function criterionHints(o: Outcome, c: Criterion, available: Set<string>): string[] {
  return rank("evidence", c.text, outcomeText(o), available);
}

/**
 * Every tool whose output could be evidence for this criterion, on the
 * criterion's own words only (no cap, no availability filter): a suggestion of
 * earlier work must be precise.
 */
export function criterionTools(c: Criterion): Set<string> {
  const all = new Set(TOOL_HINTS.map((h) => h.slug));
  return new Set(rank("evidence", c.text, "", all, Infinity));
}

/** Thinking partners for writing this outcome's chapter. */
export function chapterHints(o: Outcome, available: Set<string>): string[] {
  return rank("chapter", o.criteria.map((c) => c.text).join("\n"), outcomeText(o), available);
}

/**
 * P26.4: a criterion about a test blueprint or (constructive) alignment can take
 * a course snapshot as evidence. Only on the criterion's own words; no match, no hint.
 */
const COURSE_HINT =
  /toetsmatrijs|toetsmatrix|constructi(ve|eve) alignment|afstemming|afgestemd|test blueprint|alignment/i;

export function courseHint(c: Pick<Criterion, "text">): boolean {
  return COURSE_HINT.test(c.text);
}

/** The tools whose criteria a test dossier fits: making, marking and analysing a test. */
const TEST_DOSSIER_TOOLS = [
  "authentic-assessment",
  "test-items",
  "rubric-builder",
  "test-analysis",
];

/**
 * P35.3: a criterion a test dossier can be evidence for, through the same hints that suggest
 * earlier work (P27.2). Only on the criterion's own words; no match, no proposal.
 */
export function testDossierHint(c: Criterion): boolean {
  const tools = criterionTools(c);
  return TEST_DOSSIER_TOOLS.some((t) => tools.has(t));
}
