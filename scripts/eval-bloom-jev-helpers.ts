/**
 * An experiment (2026-11-13): the Bloom proposal of the course import three ways, on the same
 * learning outcomes, and a hybrid of the three:
 * - the LLM, as the app does it, inside the real import prompt;
 * - TypeSafe's Jev, one typed request per outcome;
 * - a list of verbs in code. TypeSafe: if code can decide reliably, it should; this measures
 *   whether it can;
 * - the hybrid: the list first, then Jev, then the LLM.
 *
 * Round 2 (after the first measurement): Bastiaan's rule is that an outcome with verbs of
 * different levels gets the highest one. Jev is asked per level whether the outcome has a verb of
 * that level, and code takes the highest yes (TypeSafe: one judgment per question, code decides).
 * Jev's threshold is set on the tuning sets (the round-1 sets) and measured on a fresh holdout.
 * Bastiaan labels every outcome (`evals/bloom-jev/labels.json`); no model judges the models.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { BLOOM_LEVELS, type BloomLevel } from "../app/lib/courses/bloom";
import { JEV_MODEL } from "./eval-evidence-jev-helpers";

type Locale = "nl" | "en";
export type BloomSet = "cases" | "holdout" | "holdout2" | "holdout3";
/** The sets the threshold may be set on. `holdout2` and `holdout3` are never tuned on. */
const TUNING_SETS: readonly BloomSet[] = ["cases", "holdout"];

export interface BloomCourse {
  id: string;
  locale: Locale;
  courseName: string;
  /** Holdout only: the public page the outcomes come from. */
  source?: string;
  outcomes: string[];
}

export function loadBloomSuite(set: BloomSet): { courses: BloomCourse[] } {
  const file = join(__dirname, "../evals/bloom-jev", `${set}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as { courses: BloomCourse[] };
}

// ── The verb list in code ───────────────────────────────────────────────────

/**
 * Verbs per level, from the usual revised-Bloom verb lists (Anderson & Krathwohl, 2001), written
 * before any label existed; round 2 added the infinitive after "kan" and the verbs the round-1
 * holdout (now a tuning set) missed, never from the fresh holdout. Dutch as stems (they match
 * every regular form) plus infinitives where the stem changes, separable verbs as
 * "stem…particle". Vague verbs give no level.
 */
const VERBS: Record<Locale, Record<BloomLevel, string[]>> = {
  nl: {
    remember: ["benoem", "noem", "som…op", "opsom", "opsommen", "herken", "definieer", "definiëren"],
    understand: [
      "leg…uit", "uitleg", "uitleggen", "verklaar", "verklaren", "licht…toe", "toelicht",
      "interpreteer", "interpreteren", "vat…samen", "samenvat", "samenvatten", "duid",
      "beschrijf", "beschrijven",
    ],
    apply: [
      "pas…toe", "toepas", "toepassen", "bereken", "voer", "uitvoer", "los…op", "oplos",
      "oplossen", "configureer", "configureren", "implementeer", "implementeren", "demonstreer",
      "demonstreren", "hanteer", "hanteren", "doorloop", "organiseer", "organiseren", "meet",
      "meten", "toon…aan", "aantonen",
    ],
    analyze: [
      "analyseer", "analyseren", "vergelijk", "onderscheid", "ontleed", "ontleden",
      "diagnosticeer", "diagnosticeren", "categoriseer", "categoriseren", "onderzoek",
    ],
    evaluate: [
      "beoordeel", "beoordelen", "evalueer", "evalueren", "beargumenteer", "beargumenteren",
      "verantwoord", "onderbouw", "bekritiseer", "bekritiseren", "reflecteer", "reflecteren",
      "weeg…af", "afwegen",
    ],
    create: [
      "ontwerp", "ontwikkel", "creëer", "creëren", "bouw", "stel…op", "opstel", "opstellen",
      "formuleer", "formuleren", "construeer", "construeren", "genereer", "genereren",
      "componeer", "componeren",
    ],
  },
  en: {
    remember: ["list", "name", "define", "recall", "recognise", "recognize", "identify", "state"],
    understand: [
      "explain", "summarise", "summarize", "interpret", "classify", "paraphrase", "illustrate",
      "describe", "outline",
    ],
    apply: [
      "apply", "use", "calculate", "solve", "implement", "execute", "demonstrate", "configure",
      "carry out",
    ],
    analyze: ["analyse", "analyze", "compare", "contrast", "differentiate", "examine", "diagnose"],
    evaluate: [
      "evaluate", "assess", "appraise", "judge", "justify", "critique", "defend", "reflect",
    ],
    create: [
      "design", "develop", "create", "build", "construct", "formulate", "devise", "compose",
      "produce",
    ],
  },
};

const DUTCH_ENDINGS = "(?:t|en|de|den|te|ten|d)?";

function verbPattern(verb: string, locale: Locale): RegExp {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ending = locale === "nl" ? DUTCH_ENDINGS : "(?:s|es|d|ed|ing)?";
  if (verb.includes("…")) {
    const [stem, particle] = verb.split("…") as [string, string];
    return new RegExp(`\\b${esc(stem)}${ending}\\b.*\\b${esc(particle)}\\b`, "i");
  }
  return new RegExp(`\\b${esc(verb)}${verb.includes(" ") ? "" : ending}\\b`, "i");
}

/** The highest level among the outcome's known verbs (Bastiaan's rule); none without one. */
export function bloomFromVerb(outcome: string, locale: Locale): BloomLevel | null {
  let best: BloomLevel | null = null;
  for (const level of BLOOM_LEVELS)
    if (VERBS[locale][level].some((v) => verbPattern(v, locale).test(outcome))) best = level;
  return best;
}

// ── Jev ─────────────────────────────────────────────────────────────────────

/** All question wording in one place (TypeSafe's skill). */
const TEXT = {
  nl: {
    about: "`outcome` is één leeruitkomst, letterlijk overgenomen uit een cursusdocument.",
    ask: (name: string) =>
      `Staat er in \`outcome\` een werkwoord dat duidelijk het Bloom-niveau ${name} aangeeft?`,
    yes: (what: string) => `Ja: een werkwoord vraagt om ${what}.`,
    no: "Nee: geen werkwoord van dit niveau, of alleen een vaag werkwoord (zoals kent, begrijpt, heeft inzicht in, is zich bewust van).",
    levels: {
      remember: ["Onthouden", "feiten of begrippen ophalen, zoals benoemen, opsommen, herkennen"],
      understand: ["Begrijpen", "betekenis geven, zoals uitleggen, verklaren, beschrijven, samenvatten"],
      apply: ["Toepassen", "een methode of procedure uitvoeren, zoals toepassen, berekenen, uitvoeren"],
      analyze: [
        "Analyseren",
        "in delen uiteenrafelen en verbanden zien, zoals analyseren, vergelijken, onderscheiden",
      ],
      evaluate: [
        "Evalueren",
        "oordelen op basis van criteria, zoals beoordelen, evalueren, beargumenteren, kritisch reflecteren",
      ],
      create: ["Creëren", "iets nieuws samenstellen, zoals ontwerpen, ontwikkelen, bouwen, opstellen"],
    },
  },
  en: {
    about: "`outcome` is one learning outcome, copied verbatim from a course document.",
    ask: (name: string) =>
      `Does \`outcome\` contain a verb that clearly signals the Bloom level ${name}?`,
    yes: (what: string) => `Yes: a verb asks for ${what}.`,
    no: "No: no verb of this level, or only a vague verb (such as knows, understands, is familiar with, is aware of).",
    levels: {
      remember: ["Remember", "retrieving facts or concepts, such as naming, listing, recognising"],
      understand: ["Understand", "making meaning, such as explaining, describing, summarising, interpreting"],
      apply: ["Apply", "carrying out a method or procedure, such as applying, calculating, executing"],
      analyze: [
        "Analyse",
        "breaking into parts and seeing relations, such as analysing, comparing, differentiating",
      ],
      evaluate: [
        "Evaluate",
        "judging against criteria, such as assessing, evaluating, justifying, critically reflecting",
      ],
      create: ["Create", "putting together something new, such as designing, developing, building, formulating"],
    },
  },
} satisfies Record<Locale, { levels: Record<BloomLevel, [string, string]> } & Record<string, unknown>>;

export interface BloomJevRequest {
  model: string;
  state: { outcome: string; language: Locale; about_outcome: string };
  questions: Record<
    string,
    { type: "noul"; instructions: string; criteria: { true: string; false: string } }
  >;
}

export function buildBloomJevRequest(
  outcome: string,
  locale: Locale,
  opts: { model?: string } = {},
): BloomJevRequest {
  const t = TEXT[locale];
  return {
    model: opts.model ?? JEV_MODEL,
    state: { outcome, language: locale, about_outcome: t.about },
    questions: Object.fromEntries(
      BLOOM_LEVELS.map((l) => {
        const [name, what] = t.levels[l];
        return [
          `has_${l}`,
          {
            type: "noul" as const,
            instructions: t.ask(name),
            criteria: { true: t.yes(what), false: t.no },
          },
        ];
      }),
    ),
  };
}

/** TypeSafe's starting threshold, used when there is nothing to set it on. */
const START_THRESHOLD = 0.7;

type LevelP = Partial<Record<BloomLevel, number>>;

const Response = z.object({
  answers: z.record(z.string(), z.object({ type: z.string(), noul: z.number().optional() })),
  usage: z.object({ cost: z.number().optional() }).partial().optional(),
});

/** Every level's yes-probability, kept so the threshold can be set afterwards. */
export function parseBloomJevAnswer(body: unknown): {
  p: LevelP;
  usable: boolean;
  costUsd?: number;
} {
  const parsed = Response.safeParse(body);
  if (!parsed.success) return { p: {}, usable: false };
  const p: LevelP = {};
  for (const l of BLOOM_LEVELS) {
    const a = parsed.data.answers[`has_${l}`];
    if (a?.type === "noul" && a.noul !== undefined) p[l] = a.noul;
  }
  const cost = parsed.data.usage?.cost;
  return { p, usable: true, ...(cost !== undefined ? { costUsd: cost } : {}) };
}

/** The truth table: the highest level whose yes-probability reaches the threshold; else none. */
export function jevLevel(p: LevelP, threshold: number): BloomLevel | null {
  let best: BloomLevel | null = null;
  for (const l of BLOOM_LEVELS) if ((p[l] ?? 0) >= threshold) best = l;
  return best;
}

// ── The LLM, through the real import ────────────────────────────────────────

/** A small course document with only the outcomes, for the real import prompt. */
export function outcomeDocument(c: BloomCourse): string {
  const head = c.locale === "nl" ? "Leeruitkomsten" : "Learning outcomes";
  return [`${c.courseName}`, "", head, ...c.outcomes.map((o) => `- ${o}`)].join("\n");
}

const RULE = {
  nl: {
    anchor: "Is het werkwoord vaag of twijfel je, gebruik dan `null`.",
    rule: "Noemt de leeruitkomst werkwoorden van verschillende niveaus, kies dan het hoogste.",
  },
  en: {
    anchor: "If the verb is vague or you are in doubt, use `null`.",
    rule: "If the outcome names verbs of different levels, use the highest.",
  },
};

/**
 * The import prompt with Bastiaan's rule for several verbs, for this eval only: the app keeps
 * `course-import@v3` until the measurement says where the Bloom proposal should come from.
 */
export function withHighestRule(prompt: string, locale: Locale): string {
  const { anchor, rule } = RULE[locale];
  if (prompt.split(anchor).length !== 2)
    throw new Error(`Bloom rule anchor not found once (${locale})`);
  return prompt.replace(anchor, `${rule} ${anchor}`);
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
  set: BloomSet;
  outcome: string;
  /** Jev's yes-probability per level; the level follows from the threshold. */
  jevP: LevelP;
  llm: BloomLevel | null;
  verb: BloomLevel | null;
}

type Labels = Record<string, BloomLevel | null>;

interface MethodScore {
  right: number;
  proposed: number;
  proposedRight: number;
}

const METHODS = ["jev", "llm", "verb", "hybrid"] as const;

export function scoreBloom(
  rows: BloomRow[],
  labels: Labels,
  threshold: number,
): Record<(typeof METHODS)[number], MethodScore> & {
  labelled: number;
  decidedBy: { verb: number; jev: number; llm: number; none: number };
} {
  const empty = (): MethodScore => ({ right: 0, proposed: 0, proposedRight: 0 });
  const out = {
    labelled: 0,
    jev: empty(),
    llm: empty(),
    verb: empty(),
    hybrid: empty(),
    decidedBy: { verb: 0, jev: 0, llm: 0, none: 0 },
  };
  for (const r of rows) {
    if (!(r.outcome in labels)) continue;
    const truth = labels[r.outcome] ?? null;
    out.labelled++;
    const jev = jevLevel(r.jevP, threshold);
    const by = r.verb ? "verb" : jev ? "jev" : r.llm ? "llm" : "none";
    out.decidedBy[by]++;
    const got = { jev, llm: r.llm, verb: r.verb, hybrid: r.verb ?? jev ?? r.llm };
    for (const m of METHODS) {
      if (got[m] === truth) out[m].right++;
      if (got[m] !== null) {
        out[m].proposed++;
        if (got[m] === truth) out[m].proposedRight++;
      }
    }
  }
  return out;
}

/**
 * Jev's threshold, set on the tuning sets only: the one with the most right answers there (the
 * highest such one on a tie), or TypeSafe's starting value when nothing there is labelled.
 */
export function calibrate(rows: BloomRow[], labels: Labels): number {
  const tune = rows.filter((r) => TUNING_SETS.includes(r.set));
  if (!scoreBloom(tune, labels, START_THRESHOLD).labelled) return START_THRESHOLD;
  let best = START_THRESHOLD;
  let bestRight = -1;
  for (let i = 10; i <= 19; i++) {
    const t = i / 20;
    const right = scoreBloom(tune, labels, t).jev.right;
    if (right >= bestRight) {
      best = t;
      bestRight = right;
    }
  }
  return best;
}

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
const SET_NAMES: Record<BloomSet, string> = {
  cases: "Afstemmen",
  holdout: "Afstemmen (oude holdout)",
  holdout2: "Nieuwe holdout",
  holdout3: "Derde holdout",
};

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
  const t = calibrate(input.rows, input.labels);
  const sets = (Object.keys(SET_NAMES) as BloomSet[]).filter((s) =>
    input.rows.some((r) => r.set === s),
  );
  const of = (s: BloomSet) =>
    scoreBloom(
      input.rows.filter((r) => r.set === s),
      input.labels,
      t,
    );
  const usd = (n: number) => `$${n.toFixed(6)}`;
  const unlabelled = input.rows.filter((r) => !(r.outcome in input.labels)).length;
  return [
    "# Eval — Bloom-voorstel: Jev, de LLM, een werkwoordenlijst en de hybride",
    "",
    `Datum: ${input.date} · Jev: ${input.jevModel} · LLM: ${input.llmModel} (course-import@v3 met de regel "het hoogste niveau") · herhalingen: ${input.repeat}`,
    "",
    `Drempel voor Jev: ${String(t).replace(".", ",")} (${
      input.rows.some((r) => TUNING_SETS.includes(r.set))
        ? "afgesteld op de afstemsets"
        : "vast: geen afstemsets in deze run"
    })`,
    "",
    'Goed = hetzelfde als Bastiaans label, ook "geen niveau". Hybride = eerst de lijst, dan Jev, dan de LLM.',
    "",
    "| Set | Gelabeld | Jev goed | LLM goed | Werkwoordenlijst goed | Hybride goed |",
    "| --- | --- | --- | --- | --- | --- |",
    ...sets.map((s) => {
      const r = of(s);
      const f = (m: MethodScore) => `${m.right}/${r.labelled}`;
      return `| ${SET_NAMES[s]} | ${r.labelled} | ${f(r.jev)} | ${f(r.llm)} | ${f(r.verb)} | ${f(r.hybrid)} |`;
    }),
    "",
    "Als er een niveau wordt voorgesteld: hoe vaak klopt het?",
    "",
    "| Set | Jev | LLM | Werkwoordenlijst | Hybride |",
    "| --- | --- | --- | --- | --- |",
    ...sets.map((s) => {
      const r = of(s);
      const f = (m: MethodScore) => `${m.proposedRight}/${m.proposed}`;
      return `| ${SET_NAMES[s]} | ${f(r.jev)} | ${f(r.llm)} | ${f(r.verb)} | ${f(r.hybrid)} |`;
    }),
    "",
    "Wie beslist in de hybride (lijst / Jev / LLM / niemand):",
    "",
    ...sets.map((s) => {
      const d = of(s).decidedBy;
      return `- ${SET_NAMES[s]}: ${d.verb} / ${d.jev} / ${d.llm} / ${d.none}`;
    }),
    "",
    [
      input.jevMs.length ? `Jev: gemiddeld ${mean(input.jevMs)} ms per leeruitkomst` : "",
      input.llmMs.length
        ? `LLM: gemiddeld ${mean(input.llmMs)} ms per document (de hele import)`
        : "",
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
