/**
 * An experiment (2026-11-13): the Bloom proposal of the course import ("a Bloom proposal only
 * from the verb", `course-import@v3`) three ways, on the same learning outcomes:
 * - the LLM, as the app does it now, inside the real import prompt;
 * - TypeSafe's Jev, one typed request per outcome;
 * - a list of verbs in code. TypeSafe: if code can decide reliably, it should; this measures
 *   whether it can.
 *
 * Built to TypeSafe's skill as the other Jev experiments: state as named fields, the null case
 * as its own yes/no, descriptive option names with what each covers and excludes, the option
 * order rotated per repeat, 0.7 thresholds, and a holdout of real outcomes never tuned on.
 * Bastiaan labels every outcome (`evals/bloom-jev/labels.json`); no model judges the models.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { BLOOM_LEVELS, type BloomLevel } from "../app/lib/courses/bloom";
import { JEV_MODEL } from "./eval-evidence-jev-helpers";

type Locale = "nl" | "en";

export interface BloomCourse {
  id: string;
  locale: Locale;
  courseName: string;
  /** Holdout only: the public page the outcomes come from. */
  source?: string;
  outcomes: string[];
}

export function loadBloomSuite(set: "cases" | "holdout"): { courses: BloomCourse[] } {
  const file = join(__dirname, "../evals/bloom-jev", `${set}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as { courses: BloomCourse[] };
}

// ── The verb list in code ───────────────────────────────────────────────────

/**
 * Verbs per level, from the usual revised-Bloom verb lists (Anderson & Krathwohl, 2001), written
 * before any label existed. Dutch as stems (they match every form) and separable verbs as
 * "stem…particle". A verb that the lists put on more than one level is left out on purpose.
 */
const VERBS: Record<Locale, Record<BloomLevel | "vague", string[]>> = {
  nl: {
    remember: ["benoem", "noem", "som…op", "opsom", "herken", "definieer"],
    understand: ["leg…uit", "uitleg", "verklaar", "licht…toe", "toelicht", "interpreteer", "vat…samen", "samenvat", "duid"],
    apply: ["pas…toe", "toepas", "bereken", "voer…uit", "uitvoer", "los…op", "oplos", "configureer", "implementeer", "demonstreer", "hanteer"],
    analyze: ["analyseer", "vergelijk", "onderscheid", "ontleed", "diagnosticeer", "categoriseer"],
    evaluate: ["beoordeel", "evalueer", "beargumenteer", "verantwoord", "onderbouw", "bekritiseer"],
    create: ["ontwerp", "ontwikkel", "creëer", "bouw", "stel…op", "opstel", "formuleer", "construeer", "genereer", "componeer"],
    vague: ["ken", "kent", "begrijp", "weet", "heeft inzicht", "heeft kennis", "is zich bewust", "is bekend met", "leert"],
  },
  en: {
    remember: ["list", "name", "define", "recall", "recognise", "recognize", "identify", "state"],
    understand: ["explain", "summarise", "summarize", "interpret", "classify", "paraphrase", "illustrate"],
    apply: ["apply", "use", "calculate", "solve", "implement", "execute", "demonstrate", "configure", "carry out"],
    analyze: ["analyse", "analyze", "compare", "contrast", "differentiate", "examine", "diagnose"],
    evaluate: ["evaluate", "assess", "appraise", "judge", "justify", "critique", "defend"],
    create: ["design", "develop", "create", "build", "construct", "formulate", "devise", "compose", "produce"],
    vague: ["know", "understand", "be familiar", "is familiar", "are familiar", "be aware", "appreciate", "learn"],
  },
};

const DUTCH_ENDINGS = "(?:t|en|de|den|te|ten|d)?";

function verbPattern(verb: string, locale: Locale): RegExp {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (verb.includes("…")) {
    const [stem, particle] = verb.split("…") as [string, string];
    return new RegExp(`\\b${esc(stem)}${locale === "nl" ? DUTCH_ENDINGS : ""}\\b.*\\b${esc(particle)}\\b`, "i");
  }
  if (locale === "nl" && !verb.includes(" ")) return new RegExp(`\\b${esc(verb)}${DUTCH_ENDINGS}\\b`, "i");
  return new RegExp(`\\b${esc(verb)}(?:s|es|d|ed|ing)?\\b`, "i");
}

/** The level when the outcome's known verbs all point to one level; otherwise none. */
export function bloomFromVerb(outcome: string, locale: Locale): BloomLevel | null {
  const levels = new Set<BloomLevel>();
  for (const level of BLOOM_LEVELS)
    if (VERBS[locale][level].some((v) => verbPattern(v, locale).test(outcome))) levels.add(level);
  return levels.size === 1 ? ([...levels][0] as BloomLevel) : null;
}

// ── Jev ─────────────────────────────────────────────────────────────────────

const TEXT = {
  nl: {
    about: "`outcome` is één leeruitkomst, letterlijk overgenomen uit een cursusdocument.",
    clear: "Geeft het werkwoord van `outcome` duidelijk één niveau van de herziene taxonomie van Bloom aan?",
    clearYes: "Het werkwoord noemt een waarneembare handeling die bij één niveau hoort, zoals \"ontwerpt\" (creëren) of \"past toe\" (toepassen).",
    clearNo: "Het werkwoord is vaag (zoals \"kent\", \"begrijpt\", \"heeft inzicht in\", \"is zich bewust van\"), past bij meer niveaus, of er is geen werkwoord.",
    level: "Bij welk niveau van de herziene taxonomie van Bloom hoort het werkwoord van `outcome`?",
    levels: {
      remember: { omvat: "Onthouden: feiten of begrippen ophalen, zoals benoemen, opsommen, herkennen.", niet: "Iets in eigen woorden uitleggen." },
      understand: { omvat: "Begrijpen: betekenis geven, zoals uitleggen, verklaren, samenvatten, interpreteren.", niet: "Iets toepassen in een nieuwe situatie." },
      apply: { omvat: "Toepassen: een methode of procedure uitvoeren, zoals toepassen, berekenen, uitvoeren, gebruiken.", niet: "Iets uit elkaar halen om verbanden te zien." },
      analyze: { omvat: "Analyseren: in delen uiteenrafelen en verbanden zien, zoals analyseren, vergelijken, onderscheiden.", niet: "Een oordeel geven op basis van criteria." },
      evaluate: { omvat: "Evalueren: oordelen op basis van criteria, zoals beoordelen, evalueren, beargumenteren, verantwoorden.", niet: "Iets nieuws maken." },
      create: { omvat: "Creëren: iets nieuws samenstellen, zoals ontwerpen, ontwikkelen, bouwen, opstellen.", niet: "Een bestaand ontwerp beoordelen." },
    },
  },
  en: {
    about: "`outcome` is one learning outcome, copied verbatim from a course document.",
    clear: "Does the verb of `outcome` clearly signal one level of Bloom's revised taxonomy?",
    clearYes: "The verb names an observable action that belongs to one level, such as \"designs\" (create) or \"applies\" (apply).",
    clearNo: "The verb is vague (such as \"knows\", \"understands\", \"is familiar with\", \"is aware of\"), fits several levels, or there is no verb.",
    level: "Which level of Bloom's revised taxonomy does the verb of `outcome` belong to?",
    levels: {
      remember: { covers: "Remember: retrieving facts or concepts, such as naming, listing, recognising.", excludes: "Explaining something in one's own words." },
      understand: { covers: "Understand: making meaning, such as explaining, summarising, interpreting.", excludes: "Applying something in a new situation." },
      apply: { covers: "Apply: carrying out a method or procedure, such as applying, calculating, executing, using.", excludes: "Breaking something down to see relations." },
      analyze: { covers: "Analyse: breaking into parts and seeing relations, such as analysing, comparing, differentiating.", excludes: "Judging against criteria." },
      evaluate: { covers: "Evaluate: judging against criteria, such as assessing, evaluating, justifying, appraising.", excludes: "Making something new." },
      create: { covers: "Create: putting together something new, such as designing, developing, building, formulating.", excludes: "Judging an existing design." },
    },
  },
} satisfies Record<Locale, { levels: Record<BloomLevel, Record<string, string>> } & Record<string, unknown>>;

export interface BloomJevRequest {
  model: string;
  state: { outcome: string; language: Locale; about_outcome: string };
  questions: Record<string, { type: "noul" | "choice"; instructions: string; criteria: Record<string, unknown> }>;
}

export function buildBloomJevRequest(
  outcome: string,
  locale: Locale,
  opts: { model?: string; rotate?: number } = {},
): BloomJevRequest {
  const t = TEXT[locale];
  const k = (((opts.rotate ?? 0) % BLOOM_LEVELS.length) + BLOOM_LEVELS.length) % BLOOM_LEVELS.length;
  const order = [...BLOOM_LEVELS.slice(k), ...BLOOM_LEVELS.slice(0, k)];
  return {
    model: opts.model ?? JEV_MODEL,
    state: { outcome, language: locale, about_outcome: t.about },
    questions: {
      clear_verb: { type: "noul", instructions: t.clear, criteria: { true: t.clearYes, false: t.clearNo } },
      level: {
        type: "choice",
        instructions: t.level,
        criteria: Object.fromEntries(order.map((l) => [l, t.levels[l]])),
      },
    },
  };
}

const BLOOM_JEV_THRESHOLDS = { clear: 0.7, level: 0.7 } as const;

const Response = z.object({
  answers: z.record(
    z.string(),
    z.object({
      type: z.string(),
      noul: z.number().optional(),
      choice: z.string().optional(),
      probabilities: z.record(z.string(), z.number()).optional(),
    }),
  ),
  usage: z.object({ cost: z.number().optional() }).partial().optional(),
});

/**
 * The truth table: a level only when the verb is clearly one level (≥ 0.7) and the top level is
 * sure (≥ 0.7); otherwise none, as the import prompt says ("if the verb is vague or you are in
 * doubt, use null").
 */
export function parseBloomJevAnswer(
  body: unknown,
  t: { clear: number; level: number } = BLOOM_JEV_THRESHOLDS,
): { level: BloomLevel | null; usable: boolean; pClear?: number; pLevel?: number; costUsd?: number } {
  const parsed = Response.safeParse(body);
  if (!parsed.success) return { level: null, usable: false };
  const { clear_verb, level } = parsed.data.answers;
  const pClear = clear_verb?.type === "noul" ? clear_verb.noul : undefined;
  const pick = level?.type === "choice" ? level.choice : undefined;
  const pLevel = pick ? (level?.probabilities?.[pick] ?? 0) : undefined;
  const known = (BLOOM_LEVELS as readonly string[]).includes(pick ?? "");
  const sure = pClear !== undefined && pClear >= t.clear && pLevel !== undefined && pLevel >= t.level;
  const cost = parsed.data.usage?.cost;
  return {
    level: sure && known ? (pick as BloomLevel) : null,
    usable: true,
    ...(pClear !== undefined ? { pClear } : {}),
    ...(pLevel !== undefined ? { pLevel } : {}),
    ...(cost !== undefined ? { costUsd: cost } : {}),
  };
}

// ── The LLM, through the real import ────────────────────────────────────────

/** A small course document with only the outcomes, for the real import prompt. */
export function outcomeDocument(c: BloomCourse): string {
  const head = c.locale === "nl" ? "Leeruitkomsten" : "Learning outcomes";
  return [`${c.courseName}`, "", head, ...c.outcomes.map((o) => `- ${o}`)].join("\n");
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** The same outcome after the import's layout repair (spacing, a full stop, a trailing comma). */
export const sameOutcome = (a: string, b: string) => norm(a) === norm(b);

// ── Scoring ─────────────────────────────────────────────────────────────────

export interface BloomRow {
  set: "cases" | "holdout";
  outcome: string;
  jev: BloomLevel | null;
  llm: BloomLevel | null;
  verb: BloomLevel | null;
}

type Labels = Record<string, BloomLevel | null>;

interface MethodScore {
  right: number;
  proposed: number;
  proposedRight: number;
}

export function scoreBloom(
  rows: BloomRow[],
  labels: Labels,
): { labelled: number; jev: MethodScore; llm: MethodScore; verb: MethodScore } {
  const empty = (): MethodScore => ({ right: 0, proposed: 0, proposedRight: 0 });
  const out = { labelled: 0, jev: empty(), llm: empty(), verb: empty() };
  for (const r of rows) {
    if (!(r.outcome in labels)) continue;
    const truth = labels[r.outcome] ?? null;
    out.labelled++;
    for (const m of ["jev", "llm", "verb"] as const) {
      const got = r[m];
      if (got === truth) out[m].right++;
      if (got !== null) {
        out[m].proposed++;
        if (got === truth) out[m].proposedRight++;
      }
    }
  }
  return out;
}

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

export function bloomReport(input: {
  date: string;
  jevModel: string;
  llmModel: string;
  repeat: number;
  rows: BloomRow[];
  labels: Labels;
  jevMs: number[];
  llmMs: number[];
  jevCostUsd?: number;
  llmCostUsd?: number;
}): string {
  const line = (name: string, set: BloomRow[]) => {
    const s = scoreBloom(set, input.labels);
    const f = (m: MethodScore) => `${m.right}/${s.labelled}`;
    return `| ${name} | ${s.labelled} | ${f(s.jev)} | ${f(s.llm)} | ${f(s.verb)} |`;
  };
  const proposals = (name: string, set: BloomRow[]) => {
    const s = scoreBloom(set, input.labels);
    const f = (m: MethodScore) => `${m.proposedRight}/${m.proposed}`;
    return `| ${name} | ${f(s.jev)} | ${f(s.llm)} | ${f(s.verb)} |`;
  };
  const tune = input.rows.filter((r) => r.set === "cases");
  const hold = input.rows.filter((r) => r.set === "holdout");
  const unlabelled = input.rows.filter((r) => !(r.outcome in input.labels)).length;
  const usd = (n: number) => `$${n.toFixed(6)}`;
  return [
    "# Eval — Bloom-voorstel: Jev, de LLM en een werkwoordenlijst",
    "",
    `Datum: ${input.date} · Jev: ${input.jevModel} · LLM: ${input.llmModel} (course-import@v3) · herhalingen: ${input.repeat}`,
    "",
    "Goed = hetzelfde als Bastiaans label, ook \"geen niveau\".",
    "",
    "| Set | Gelabeld | Jev goed | LLM goed | Werkwoordenlijst goed |",
    "| --- | --- | --- | --- | --- |",
    line("Afstemmen", tune),
    line("Holdout", hold),
    "",
    "Als er een niveau wordt voorgesteld: hoe vaak klopt het?",
    "",
    "| Set | Jev | LLM | Werkwoordenlijst |",
    "| --- | --- | --- | --- |",
    proposals("Afstemmen", tune),
    proposals("Holdout", hold),
    "",
    [
      input.jevMs.length ? `Jev: gemiddeld ${mean(input.jevMs)} ms per leeruitkomst` : "",
      input.llmMs.length ? `LLM: gemiddeld ${mean(input.llmMs)} ms per document (de hele import)` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    "",
    [
      input.jevCostUsd !== undefined ? `Kosten Jev: ${usd(input.jevCostUsd)}` : "",
      input.llmCostUsd !== undefined
        ? `Kosten LLM: ${usd(input.llmCostUsd)} (API-lijstprijs, de hele import)`
        : "",
    ]
      .filter(Boolean)
      .join(" · "),
    "",
    ...(input.llmModel.startsWith("claude-code::")
      ? [
          "Snelheid van de LLM via Claude Code: de model-call zelf, zoals Claude Code hem meet, zonder het opstarten van de CLI. Kosten tegen de API-lijstprijs van hetzelfde model.",
          "",
        ]
      : []),
    ...(unlabelled ? [`Nog geen label: ${unlabelled}`, ""] : []),
  ].join("\n");
}
