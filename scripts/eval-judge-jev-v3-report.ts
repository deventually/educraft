/**
 * The report of version 3 (README "Versie 3"): version 2 and 3 on the same outputs, next to the
 * LLM judge, with the five tests of the plan and the table that says per sort of check where Jev
 * can be used with confidence. Every rule here was fixed before the measurement.
 */
import type { JevVerdict } from "./eval-judge-jev-helpers";
import { rowKey } from "./eval-judge-jev-helpers";
import type { Unit } from "./eval-judge-jev-v3";

export type JudgeSet = "tuning" | "holdout" | "fresh";

export interface V3Row {
  tool: string;
  caseId: string;
  run: number;
  check: string;
  set: JudgeSet;
  /** The sort of check (`PieceCheck.family`), or "v2" / "llm" for the others. */
  family: string;
  /** The LLM judge failed the check (with a quote that is in the output). */
  judge: boolean;
  /** Version 2 on the same output; absent on the fresh holdout. */
  v2?: JevVerdict;
  v3: JevVerdict;
  v3P?: number;
  /** code: the check does not hold for this case; v2: asked as in version 2. */
  by?: "code" | "v2";
  /** The piece that shows the failure. */
  evidence?: Unit;
}

type Labels = Record<string, boolean>;

const SETS: [JudgeSet, string][] = [
  ["tuning", "Afstemmen"],
  ["holdout", "Holdout"],
  ["fresh", "Verse holdout"],
];
const HOLDOUTS = SETS.filter(([s]) => s !== "tuning");

const settled = (v: JevVerdict | undefined) => v === "fail" || v === "pass";
const outputOf = (r: V3Row) => `${r.tool}/${r.caseId}#${r.run}`;
const pct = (n: number, d: number) => `${Math.round((100 * n) / d)}%`;

/** Outputs where every check passed in Jev: the hybrid needs no LLM for them. */
function clearOutputs(rows: V3Row[], v: "v2" | "v3"): string {
  const outputs = new Map<string, boolean>();
  for (const r of rows) outputs.set(outputOf(r), (outputs.get(outputOf(r)) ?? true) && r[v] === "pass");
  return `${[...outputs.values()].filter(Boolean).length}/${outputs.size}`;
}

function setLine(name: string, set: V3Row[]): string {
  const has2 = set.some((r) => r.v2 !== undefined);
  const two = (s: string) => (has2 ? `${s} → ` : "- → ");
  const decided = (v: "v2" | "v3") => set.filter((r) => settled(r[v])).length;
  const agree = (v: "v2" | "v3") =>
    `${set.filter((r) => settled(r[v]) && (r[v] === "fail") === r.judge).length}/${decided(v)}`;
  const unsettled = (v: "v2" | "v3") => set.filter((r) => r[v] === "unsettled").length;
  const llm = set.filter((r) => r.v3 === "llm").length;
  return `| ${name} | ${set.length} | ${two(String(decided("v2")))}${decided("v3")} | ${two(agree("v2"))}${agree("v3")} | ${two(String(unsettled("v2")))}${unsettled("v3")} | ${llm} | ${two(clearOutputs(set, "v2"))}${clearOutputs(set, "v3")} |`;
}

const ok = (pass: boolean) => (pass ? "geslaagd" : "niet geslaagd");

/** The five tests of the plan, on one holdout. */
function tests(set: V3Row[], labels: Labels, evidence: Labels, order: OrderCount, fresh: boolean) {
  const label = (r: V3Row) => labels[rowKey(r)];
  const falseAlarms = (v: "v2" | "v3") => set.filter((r) => r[v] === "fail" && label(r) === false).length;
  const v3Fails = set.filter((r) => r.v3 === "fail" && label(r) !== undefined);
  const real = v3Fails.filter((r) => label(r) === true).length;
  const t1 = fresh
    ? `${real}/${v3Fails.length} echt fout: ${ok(!v3Fails.length || real / v3Fails.length >= 0.8)}`
    : `v2 ${falseAlarms("v2")}, v3 ${falseAlarms("v3")}: ${ok(falseAlarms("v3") <= falseAlarms("v2") / 2)}`;
  const missed = set.filter((r) => r.v3 === "pass" && r.judge && label(r) === true).length;
  const clear2 = clearOutputs(set, "v2");
  const clear3 = clearOutputs(set, "v3");
  const n = (s: string) => Number(s.split("/")[0]);
  const t3 = fresh ? `${clear3} (geen versie 2)` : `v2 ${clear2}, v3 ${clear3}: ${ok(n(clear3) > n(clear2))}`;
  const shown = set.filter((r) => r.v3 === "fail" && r.evidence && label(r) === true);
  const judged = shown.filter((r) => evidence[rowKey(r)] !== undefined);
  const right = judged.filter((r) => evidence[rowKey(r)]).length;
  const t4 = judged.length ? `${right}/${judged.length}: ${ok(right / judged.length >= 0.8)}` : "-";
  const t5 = order.total ? `${pct(order.same, order.total)}: ${ok(order.same / order.total >= 0.95)}` : "-";
  return [t1, `${missed}: ${ok(missed === 0)}`, t3, t4, t5];
}

/**
 * Per sort of check and holdout, the plan's rules for using Jev with confidence:
 * - let pass (skip the LLM): at least 20 rows where Jev passes, and none of them a real error the
 *   judge caught (the bound 3/n says how far that goes);
 * - report a failure (a second look, with the piece as evidence): at least 10 labelled fails of
 *   Jev, 80% real, and the evidence right for 80% of the real ones.
 */
function confidenceLine(family: string, setName: string, set: V3Row[], labels: Labels, evidence: Labels) {
  const label = (r: V3Row) => labels[rowKey(r)];
  const passes = set.filter((r) => r.v3 === "pass" && r.by !== "code");
  const missed = passes.filter((r) => r.judge && label(r) === true).length;
  const mayPass =
    passes.length < 20 ? "te weinig" : missed === 0 ? "ja" : "nee";
  const bound = passes.length ? pct(3, passes.length) : "-";
  const head = `| ${family} | ${setName} | ${passes.length} | ${missed} | ${bound} | ${mayPass} |`;
  const fails = set.filter((r) => r.v3 === "fail" && label(r) !== undefined);
  const real = fails.filter((r) => label(r) === true);
  const withEvidence = real.filter((r) => r.evidence && evidence[rowKey(r)] !== undefined);
  const evidenceRight = withEvidence.filter((r) => evidence[rowKey(r)]).length;
  const mayReport =
    fails.length < 10
      ? "te weinig"
      : real.length / fails.length >= 0.8 && withEvidence.length && evidenceRight / withEvidence.length >= 0.8
        ? "ja"
        : "nee";
  return `${head} ${fails.length} | ${fails.length ? pct(real.length, fails.length) : "-"} | ${withEvidence.length ? pct(evidenceRight, withEvidence.length) : "-"} | ${mayReport} |`;
}

export interface OrderCount {
  /** Pieces on topic whose top kind stayed the same with the kinds reversed. */
  same: number;
  total: number;
}

const short = (s: string) => (s.length > 120 ? `${s.slice(0, 117)}…` : s).replace(/\s+/g, " ").replace(/[\\|]/g, "\\$&");

export function judgeJevV3Report(input: {
  date: string;
  jevModel: string;
  judgeModel: string;
  /** The report whose outputs and judge verdicts were reused. */
  source: string;
  rows: V3Row[];
  order: Record<JudgeSet, OrderCount>;
  /** Requests to Jev, the reversed ones included. */
  calls: number;
  jevMs: number[];
  jevCostUsd?: number;
  labels?: Labels;
  /** Per row labelled as a real failure: is the failure in the piece Jev pointed to? */
  evidence?: Labels;
}): string {
  const { rows, labels } = input;
  const evidence = input.evidence ?? {};
  const inSet = (s: JudgeSet) => rows.filter((r) => r.set === s);
  const present = SETS.filter(([s]) => inSet(s).length);
  const families = [...new Set(rows.map((r) => r.family))].filter((f) => f !== "llm").sort();
  const disagree = rows.filter((r) => settled(r.v3) && (r.v3 === "fail") !== r.judge);
  const meanMs = input.jevMs.length
    ? Math.round(input.jevMs.reduce((a, b) => a + b, 0) / input.jevMs.length)
    : 0;
  return [
    "# Eval — harde checks, versie 3: Jev per stuk, naast versie 2 en de LLM-judge",
    "",
    `Datum: ${input.date} · Jev: ${input.jevModel} · checks: v3 · judge: ${input.judgeModel} · uitvoer en judge uit: ${input.source}`,
    "",
    `Requests aan Jev: ${input.calls} (met de omgekeerde volgorde) · gemiddeld ${meanMs} ms${input.jevCostUsd !== undefined ? ` · kosten Jev: $${input.jevCostUsd.toFixed(4)}` : ""}`,
    "",
    "| Set | Rijen | Beslist door Jev (v2 → v3) | Eens met de judge (v2 → v3) | Onbeslist (v2 → v3) | Bij de judge (rekenen, tellen) | Uitvoer zonder LLM (v2 → v3) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...present.map(([s, name]) => setLine(name, inSet(s))),
    "",
    "## Volgorde van de opties (toets 5)",
    "",
    "Stukken waarvan Jev zegt dat ze over het onderwerp gaan (Noul ≥ 0,7): blijft de hoogste categorie gelijk als de opties omgekeerd staan?",
    "",
    "| Set | Gelijk | Aandeel |",
    "| --- | --- | --- |",
    ...present
      .filter(([s]) => input.order[s].total)
      .map(([s, name]) => `| ${name} | ${input.order[s].same}/${input.order[s].total} | ${pct(input.order[s].same, input.order[s].total)} |`),
    "",
    ...(labels
      ? [
          "## De toetsen (vooraf vastgelegd)",
          "",
          "Op Bastiaans labels, blind gekozen. Op de verse holdout is er geen versie 2: toets 1 vraagt daar dat 80% van de fails van versie 3 echt fout is.",
          "",
          "| Toets | Oude holdout | Verse holdout |",
          "| --- | --- | --- |",
          ...(() => {
            const at = (s: JudgeSet, fresh: boolean) =>
              inSet(s).length ? tests(inSet(s), labels, evidence, input.order[s], fresh) : ["-", "-", "-", "-", "-"];
            const old = at("holdout", false);
            const fresh = at("fresh", true);
            return [
              "1. Valse alarmen",
              "2. Gemist wat de judge ziet",
              "3. Uitvoer zonder LLM",
              "4. Bewijs in het aangewezen stuk",
              "5. Volgorde van de opties",
            ].map((name, i) => `| ${name} | ${old[i]} | ${fresh[i]} |`);
          })(),
          "",
          "## Met vertrouwen, per soort check",
          "",
          "Laten slagen: minstens 20 rijen waar Jev slaagt, en geen echte fout daarbij die de judge wel zag; de bovengrens (3/n) zegt hoe ver dat reikt. Fout melden: minstens 10 gelabelde fails van Jev, 80% echt fout, en bij 80% van de echte het bewijs in het aangewezen stuk.",
          "",
          "| Soort | Set | Jev slaagt | Gemist (judge zag het) | Bovengrens | Laten slagen | Jev faalt, gelabeld | Echt fout | Bewijs klopt | Fout melden |",
          "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
          ...families.flatMap((f) =>
            HOLDOUTS.filter(([s]) => inSet(s).some((r) => r.family === f)).map(([s, name]) =>
              confidenceLine(f, name, inSet(s).filter((r) => r.family === f), labels, evidence),
            ),
          ),
          "",
          ...(() => {
            const sample = rows.filter(
              (r) => r.set !== "tuning" && r.v3 === "pass" && r.by !== "code" && !r.judge && labels[rowKey(r)] !== undefined && r.v2 !== "fail",
            );
            const both = sample.filter((r) => labels[rowKey(r)] === true).length;
            return sample.length
              ? [`Steekproef waar alle drie zeggen dat de check slaagt: ${sample.length} gelabeld, ${both} echt fout (gemist door Jev én de judge).`, ""]
              : [];
          })(),
        ]
      : []),
    "## Waar versie 3 en de judge verschillen",
    "",
    "| Tool | Case | Check | Soort | v3 | Judge | v2 | Stuk | Set |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...disagree.map(
      (r) =>
        `| ${r.tool} | ${r.caseId}#${r.run} | ${r.check} | ${r.family} | ${r.v3} | ${r.judge ? "fail" : "pass"} | ${r.v2 ?? "-"} | ${r.evidence ? `${r.evidence.id}: ${short(r.evidence.text)}` : "-"} | ${SETS.find(([s]) => s === r.set)?.[1]} |`,
    ),
    "",
  ].join("\n");
}

/** A small seeded generator, so the sample is the same every time it is drawn. */
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

/**
 * The rows Bastiaan labels, blind: every row where version 2 or 3 disagrees with the judge, every
 * fail of version 3, and a fixed sample of rows where all three pass. The tuning set only on
 * request: the tests are on the holdouts.
 */
export function labelRows(rows: V3Row[], opts: { sample: number; seed: number; tuning?: boolean }): V3Row[] {
  const sets = rows.filter((r) => opts.tuning || r.set !== "tuning");
  const differs = (v: JevVerdict | undefined, judge: boolean) => settled(v) && (v === "fail") !== judge;
  const must = sets.filter((r) => differs(r.v2, r.judge) || differs(r.v3, r.judge) || r.v3 === "fail");
  const pool = sets.filter(
    (r) => !must.includes(r) && r.v3 === "pass" && r.by !== "code" && !r.judge && r.v2 !== "fail",
  );
  const rand = seeded(opts.seed);
  const shuffled = pool
    .map((r) => ({ r, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r);
  return [...must, ...shuffled.slice(0, opts.sample)];
}
