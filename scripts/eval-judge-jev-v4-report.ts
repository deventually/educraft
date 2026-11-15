/**
 * The report of version 4 (README "Versie 4"): Jev's five dimension scores next to Sonnet's, both
 * held to Bastiaan's own blind scores with the same rules. Every rule here was fixed in the plan
 * before the measurement: tests 1 to 3 decide, 4 to 7 only report.
 */
import { DIMENSIONS, type Dimension } from "./eval-judge-jev-v4";

export interface V4Row {
  /** `<tool>/<case>#<run>`. */
  key: string;
  tool: string;
  caseId: string;
  run: number;
  set: "tuning" | "holdout";
  dim: Dimension;
  /** Bastiaan's score; absent when not labelled or "weet ik niet". */
  truth?: number;
  sonnet?: number;
  jev?: number;
  /** Jev's score before rounding (after a cap). */
  jevX?: number;
  /** Each part's value, 0 to 1. */
  parts?: Record<string, number>;
}

export interface TestOptions {
  /** How much further from Bastiaan Jev may be than Sonnet (test 1). */
  margin: number;
  /** The judge that always gives the same score (test 2). */
  constant: number;
  seed: number;
  /** Bootstrap draws. */
  draws: number;
  /** Fewer pairs than this: test 3 says "too few". */
  minPairs: number;
}

/** The fixed rules of the plan. */
const PLAN: TestOptions = { margin: 0.25, constant: 4, seed: 20261115, draws: 10_000, minPairs: 10 };
/** A near miss: Jev's unrounded score this close to Bastiaan's, yet rounded to another. */
const NEAR = 0.75;

type Judged = V4Row & { truth: number; sonnet: number; jev: number };
type Judge = "jev" | "sonnet";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN);
const mae = (rows: Judged[], by: (r: Judged) => number) => mean(rows.map((r) => Math.abs(by(r) - r.truth)));

/** A small seeded generator, so a sample or a bootstrap is the same every time. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Paired bootstrap of MAE(Jev) − MAE(Sonnet): the 2.5th and 97.5th percentile. */
function bootstrap(rows: Judged[], o: TestOptions): [number, number] {
  const rand = seeded(o.seed);
  const diffs: number[] = [];
  for (let i = 0; i < o.draws; i++) {
    let d = 0;
    for (let j = 0; j < rows.length; j++) {
      const r = rows[Math.floor(rand() * rows.length)] as Judged;
      d += Math.abs(r.jev - r.truth) - Math.abs(r.sonnet - r.truth);
    }
    diffs.push(d / rows.length);
  }
  diffs.sort((a, b) => a - b);
  const at = (q: number) => round4(diffs[Math.min(diffs.length - 1, Math.floor(q * diffs.length))] as number);
  return [at(0.025), at(0.975)];
}

const round4 = (x: number) => Math.round(x * 1e4) / 1e4 + 0;

/** Test 3: of the same-tool pairs Bastiaan scores differently, the share a judge orders alike. */
function concordance(rows: Judged[]) {
  let pairs = 0;
  const hit = { jev: 0, sonnet: 0 };
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i] as Judged;
      const b = rows[j] as Judged;
      if (a.tool !== b.tool || a.truth === b.truth) continue;
      pairs++;
      const want = Math.sign(a.truth - b.truth);
      for (const k of ["jev", "sonnet"] as const) {
        const got = Math.sign(a[k] - b[k]);
        hit[k] += got === want ? 1 : got === 0 ? 0.5 : 0;
      }
    }
  return { pairs, jev: pairs ? hit.jev / pairs : Number.NaN, sonnet: pairs ? hit.sonnet / pairs : Number.NaN };
}

function modeShare(xs: number[]): number {
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return xs.length ? Math.max(...counts.values()) / xs.length : Number.NaN;
}

function off(rows: Judged[], k: Judge) {
  const d = rows.map((r) => Math.abs(r[k] - r.truth));
  return { exact: d.filter((x) => x === 0).length, one: d.filter((x) => x === 1).length, more: d.filter((x) => x >= 2).length };
}

export type Decision = "confident" | "replace" | "no" | "undecided";

/** Tests 1 to 7 of one dimension, on the rows given (the test set). */
export function dimensionTests(all: V4Row[], o: TestOptions = PLAN) {
  const labelled = all.filter((r) => r.truth !== undefined);
  const rows = labelled.filter((r): r is Judged => r.jev !== undefined && r.sonnet !== undefined);
  const m = { jev: mae(rows, (r) => r.jev), sonnet: mae(rows, (r) => r.sonnet), constant: mae(rows, () => o.constant) };
  const diff = m.jev - m.sonnet;
  const ci = rows.length ? bootstrap(rows, o) : ([Number.NaN, Number.NaN] as [number, number]);
  const c = concordance(rows);
  const test1 = { diff, ci, pass: diff <= o.margin + 1e-9, confident: ci[1] <= o.margin + 1e-9 };
  const test2 = { pass: m.jev < m.constant };
  const test3 = {
    ...c,
    pass: c.pairs < o.minPairs ? undefined : c.jev >= c.sonnet - 0.05 - 1e-9 && c.jev > 0.5,
  };
  const decision: Decision =
    !rows.length || !test1.pass || !test2.pass || test3.pass === false
      ? rows.length
        ? "no"
        : "undecided"
      : test3.pass === undefined
        ? "undecided"
        : test1.confident
          ? "confident"
          : "replace";
  const perTool: Record<string, { n: number; truth: number; jev: number; sonnet: number }> = {};
  for (const t of [...new Set(rows.map((r) => r.tool))].sort()) {
    const of = rows.filter((r) => r.tool === t);
    perTool[t] = {
      n: of.length,
      truth: mean(of.map((r) => r.truth)),
      jev: mean(of.map((r) => r.jev)),
      sonnet: mean(of.map((r) => r.sonnet)),
    };
  }
  const drivers: Record<string, number> = {};
  for (const r of rows.filter((x) => x.jev < x.truth))
    for (const [p, v] of Object.entries(r.parts ?? {})) if (v <= 0.5) drivers[p] = (drivers[p] ?? 0) + 1;
  return {
    n: rows.length,
    /** Labelled, but a judge gave no score. */
    missing: labelled.length - rows.length,
    mae: m,
    test1,
    test2,
    test3,
    decision,
    perTool,
    modeShare: {
      truth: modeShare(rows.map((r) => r.truth)),
      jev: modeShare(rows.map((r) => r.jev)),
      sonnet: modeShare(rows.map((r) => r.sonnet)),
    },
    off: { jev: off(rows, "jev"), sonnet: off(rows, "sonnet") },
    nearMisses: rows.filter(
      (r) => r.jev !== r.truth && r.jevX !== undefined && Math.abs(r.jevX - r.truth) <= NEAR + 1e-9,
    ),
    /** Per part: how often it was at most half while Jev scored below Bastiaan. */
    drivers,
  };
}

// ── Labels and samples ────────────────────────────────────────────────────

/** Bastiaan's scores per output; null is "weet ik niet". */
export type V4Labels = Record<string, Partial<Record<Dimension, number | null>>>;

export function withLabels(rows: V4Row[], labels: V4Labels): V4Row[] {
  return rows.map((r) => {
    const t = labels[r.key]?.[r.dim];
    return typeof t === "number" ? { ...r, truth: t } : r;
  });
}

const toolOf = (key: string) => key.split("/")[0] as string;
const caseOfKey = (key: string) => (key.split("/")[1] ?? "").replace(/#\d+$/, "");

function shuffle<T>(xs: T[], rand: () => number): T[] {
  return xs
    .map((x) => ({ x, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .map((e) => e.x);
}

/**
 * The outputs Bastiaan labels, drawn by code with a fixed seed: `perTool` per tool, from as many
 * different cases as there are; `tools` limits the draw to that many tools (the tuning set).
 */
export function labelSample(keys: string[], opts: { perTool: number; tools?: number; seed: number }): string[] {
  const rand = seeded(opts.seed);
  const all = [...new Set(keys.map(toolOf))].sort();
  const tools = opts.tools ? shuffle(all, rand).slice(0, opts.tools).sort() : all;
  return tools.flatMap((t) => {
    const mine = shuffle(
      keys.filter((k) => toolOf(k) === t).sort(),
      rand,
    );
    const picked: string[] = [];
    for (const k of mine)
      if (picked.length < opts.perTool && !picked.some((p) => caseOfKey(p) === caseOfKey(k))) picked.push(k);
    for (const k of mine) if (picked.length < opts.perTool && !picked.includes(k)) picked.push(k);
    return picked;
  });
}

/** How far Bastiaan's second score of the same output is from his first, per dimension. */
export function retestAgreement(first: V4Labels, again: V4Labels): Partial<Record<Dimension, { n: number; mae: number }>> {
  const out: Partial<Record<Dimension, { n: number; mae: number }>> = {};
  for (const d of DIMENSIONS) {
    const diffs: number[] = [];
    for (const [k, a] of Object.entries(again)) {
      const x = first[k]?.[d];
      const y = a[d];
      if (typeof x === "number" && typeof y === "number") diffs.push(Math.abs(x - y));
    }
    if (diffs.length) out[d] = { n: diffs.length, mae: mean(diffs) };
  }
  return out;
}

/** The sentence of each dimension in a rubric (`- **dim** — …`, with its continuation lines). */
export function rubricSentences(rubric: string): Partial<Record<Dimension, string>> {
  const out: Partial<Record<Dimension, string>> = {};
  const body = rubric.split(/^## Hard checks/m)[0] ?? "";
  let at: Dimension | undefined;
  for (const line of body.split("\n")) {
    const m = /^- \*\*(\w+)\*\*\s*[—–-]\s*(.*)$/.exec(line);
    if (m) {
      at = (DIMENSIONS as readonly string[]).includes(m[1] as string) ? (m[1] as Dimension) : undefined;
      if (at) out[at] = (m[2] as string).trim();
      continue;
    }
    if (at && /^\s+\S/.test(line)) out[at] = `${out[at]} ${line.trim()}`;
    else at = undefined;
  }
  return out;
}

// ── Score distributions (to choose how code reads a Score) ──────────────────

export interface ScoreAnswer {
  part: string;
  levels: number;
  score: number;
  probabilities: Record<string, number>;
}

export function scoreSpread(answers: ScoreAnswer[]) {
  const parts = [...new Set(answers.map((a) => a.part))].sort();
  return parts.map((part) => {
    const of = answers.filter((a) => a.part === part);
    const levels = of[0]?.levels ?? 0;
    const top = Array<number>(levels).fill(0);
    const topP: number[] = [];
    for (const a of of) {
      const [lvl, p] = Object.entries(a.probabilities).reduce((b, e) => (e[1] > b[1] ? e : b), ["0", -1]);
      top[Number(lvl)] = (top[Number(lvl)] ?? 0) + 1;
      topP.push(p);
    }
    return {
      part,
      n: of.length,
      meanPosition: round4(mean(of.map((a) => a.score / (levels - 1)))),
      top,
      meanTopP: round4(mean(topP)),
    };
  });
}

// ── The markdown ───────────────────────────────────────────────────────────

const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "-");
const pct = (x: number) => (Number.isFinite(x) ? `${Math.round(100 * x)}%` : "-");
const yes = (b: boolean | undefined) => (b === undefined ? "te weinig" : b ? "ja" : "nee");
const DECISION: Record<Decision, string> = {
  confident: "Jev kan het overnemen, met vertrouwen",
  replace: "Jev kan het overnemen (interval te breed voor vertrouwen)",
  no: "Nee, Sonnet houdt dit",
  undecided: "Onbeslist (te weinig labels of paren)",
};

export interface V4ReportInput {
  date: string;
  jevModel: string;
  judgeModel: string;
  /** The report whose outputs and Sonnet scores were reused. */
  source: string;
  read: "position" | "top";
  calls: number;
  jevMs: number[];
  jevCostUsd?: number;
  /** Outputs Jev judged (for the price per 1,000). */
  outputs: number;
  judgeCostUsd?: number;
  judgeOutputs?: number;
  rows: V4Row[];
  tests?: TestOptions;
  retest?: Partial<Record<Dimension, { n: number; mae: number }>>;
  spread?: ReturnType<typeof scoreSpread>;
}

function section(title: string, rows: V4Row[], o: TestOptions): string[] {
  const tests = DIMENSIONS.map((d) => [d, dimensionTests(rows.filter((r) => r.dim === d), o)] as const);
  return [
    `## ${title}`,
    "",
    "| Dimensie | Gelabeld | MAE Jev | MAE Sonnet | MAE Altijd 4 | Jev − Sonnet (95%-interval) | 1. Binnen 0,25 | 2. Beter dan altijd 4 | 3. Rangorde Jev / Sonnet (paren) | Besluit |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...tests.map(([d, t]) =>
      t.n
        ? `| ${d} | ${t.n}${t.missing ? ` (+${t.missing} zonder score)` : ""} | ${f2(t.mae.jev)} | ${f2(t.mae.sonnet)} | ${f2(t.mae.constant)} | ${f2(t.test1.diff)} (${f2(t.test1.ci[0])} tot ${f2(t.test1.ci[1])}) | ${yes(t.test1.pass)} | ${yes(t.test2.pass)} | ${pct(t.test3.jev)} / ${pct(t.test3.sonnet)} (${t.test3.pairs}): ${yes(t.test3.pass)} | ${DECISION[t.decision]} |`
        : `| ${d} | 0 | - | - | - | - | - | - | - | te weinig labels |`,
    ),
    "",
    "**Precies goed, één punt ernaast, twee of meer** (Jev · Sonnet), en **het meest gegeven cijfer** (aandeel bij Bastiaan · Jev · Sonnet):",
    "",
    "| Dimensie | Jev | Sonnet | Meest gegeven: Bastiaan · Jev · Sonnet |",
    "| --- | --- | --- | --- |",
    ...tests
      .filter(([, t]) => t.n)
      .map(
        ([d, t]) =>
          `| ${d} | ${t.off.jev.exact} · ${t.off.jev.one} · ${t.off.jev.more} | ${t.off.sonnet.exact} · ${t.off.sonnet.one} · ${t.off.sonnet.more} | ${pct(t.modeShare.truth)} · ${pct(t.modeShare.jev)} · ${pct(t.modeShare.sonnet)} |`,
      ),
    "",
    "**Gemiddelde per tool** (Bastiaan · Jev · Sonnet):",
    "",
    "| Dimensie | Tool | n | Bastiaan | Jev | Sonnet |",
    "| --- | --- | --- | --- | --- | --- |",
    ...tests.flatMap(([d, t]) =>
      Object.entries(t.perTool).map(([tool, p]) => `| ${d} | ${tool} | ${p.n} | ${f2(p.truth)} | ${f2(p.jev)} | ${f2(p.sonnet)} |`),
    ),
    "",
    `**Net ernaast**: Jevs cijfer vóór afronden lag binnen ${NEAR} van dat van Bastiaan, maar rondde naar een ander cijfer af.`,
    "",
    "| Dimensie | Uitvoer | Bastiaan | Jev (vóór afronden) | Sonnet |",
    "| --- | --- | --- | --- | --- |",
    ...tests.flatMap(([d, t]) =>
      t.nearMisses.map((r) => `| ${d} | ${r.key} | ${r.truth} | ${r.jev} (${f2(r.jevX ?? Number.NaN)}) | ${r.sonnet} |`),
    ),
    "",
    "**Welke deelvragen trokken Jev omlaag** waar hij lager scoorde dan Bastiaan (hoe vaak het deel op de helft of lager stond):",
    "",
    ...tests.flatMap(([d, t]) => {
      const list = Object.entries(t.drivers).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      return list.length ? [`- ${d}: ${list.map(([p, n]) => `${p} (${n})`).join(", ")}`] : [];
    }),
    "",
  ];
}

export function judgeJevV4Report(input: V4ReportInput): string {
  const o = input.tests ?? PLAN;
  const meanMs = input.jevMs.length ? Math.round(mean(input.jevMs)) : 0;
  const per1000 = (cost: number | undefined, n: number | undefined) =>
    cost !== undefined && n ? `$${((cost / n) * 1000).toFixed(2)}` : "-";
  const holdout = input.rows.filter((r) => r.set === "holdout");
  const tuning = input.rows.filter((r) => r.set === "tuning" && r.truth !== undefined);
  return [
    "# Eval — Jev scoort de dimensies (versie 4)",
    "",
    `Datum: ${input.date} · Jev: ${input.jevModel} · Score gelezen als: ${input.read === "position" ? "positie" : "meest waarschijnlijke niveau"} · judge: ${input.judgeModel} · uitvoer en Sonnet-scores uit: ${input.source}`,
    "",
    `Requests aan Jev: ${input.calls} · gemiddeld ${meanMs} ms · uitvoer: ${input.outputs}`,
    "",
    `Regels (vastgelegd vóór de meting): Bastiaans blinde cijfers zijn de waarheid; Jev en Sonnet krijgen dezelfde regels. Toets 1: Jev zit gemiddeld hooguit ${o.margin} punt verder van Bastiaan dan Sonnet. Toets 2: Jev zit dichter bij Bastiaan dan een judge die altijd ${o.constant} zegt. Toets 3: bij paren van dezelfde tool die Bastiaan verschillend scoort, zet Jev ze minstens zo vaak goed als Sonnet min 5 procentpunt, en vaker dan de helft (gelijk telt half; onder ${o.minPairs} paren: te weinig). Met vertrouwen: ook de bovengrens van het 95%-interval (gepaarde bootstrap, ${o.draws} trekkingen, seed ${o.seed}) blijft binnen ${o.margin}.`,
    "",
    ...section("Toetsset (de meting)", holdout, o),
    ...(tuning.length ? section("Afstemset (geen toets: hierop is afgestemd)", tuning, o) : []),
    "## Kosten",
    "",
    `Tegen de API-lijstprijs, per 1.000 uitvoer: Jev ${per1000(input.jevCostUsd, input.outputs)}${input.jevCostUsd !== undefined ? ` (deze run: $${input.jevCostUsd.toFixed(4)})` : ""}; Sonnet, de hele judge-call: ${per1000(input.judgeCostUsd, input.judgeOutputs)}.`,
    "",
    ...(input.retest
      ? [
          "## Hoe vast zijn Bastiaans eigen cijfers",
          "",
          "Dezelfde uitvoer, later nog een keer gescoord zonder het te weten: de gemiddelde afwijking tussen de twee keer.",
          "",
          "| Dimensie | Uitvoeren | Afwijking |",
          "| --- | --- | --- |",
          ...DIMENSIONS.flatMap((d) => {
            const r = input.retest?.[d];
            return r ? [`| ${d} | ${r.n} | ${f2(r.mae)} |`] : [];
          }),
          "",
        ]
      : []),
    ...(input.spread?.length
      ? [
          "## Hoe Jevs Scores eruitzien",
          "",
          "Per Score-deelvraag: aantal antwoorden, de gemiddelde positie (0 tot 1), hoe vaak elk niveau het meest waarschijnlijk was, en de gemiddelde kans van dat niveau.",
          "",
          "| Deelvraag | n | Gem. positie | Meest waarschijnlijk per niveau | Gem. kans |",
          "| --- | --- | --- | --- | --- |",
          ...input.spread.map((s) => `| ${s.part} | ${s.n} | ${f2(s.meanPosition)} | ${s.top.join(" · ")} | ${f2(s.meanTopP)} |`),
          "",
        ]
      : []),
  ].join("\n");
}
