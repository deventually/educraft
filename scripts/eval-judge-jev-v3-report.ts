/**
 * The report of version 3 (README "Versie 3"): version 2 and 3 on the same outputs, next to the
 * LLM judge (Sonnet). Bastiaan's labels are the truth; Jev and Sonnet are held to the same rules
 * against them, and each with its cost. Every rule here was fixed before the measurement.
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
  /** The sort of check (`PieceCheck.family`), or "llm" for a check the judge keeps. */
  family: string;
  /** The LLM judge (Sonnet) failed the check (with a quote that is in the output). */
  judge: boolean;
  /** Version 2 on the same output; absent on the fresh holdout. */
  v2?: JevVerdict;
  v3: JevVerdict;
  v3P?: number;
  /** code: the check does not hold for this case. */
  by?: "code";
  /** The piece that shows the failure (or the line that names a known error). */
  evidence?: Unit;
}

type Labels = Record<string, boolean>;

const SETS: [JudgeSet, string][] = [
  ["tuning", "Afstemmen"],
  ["holdout", "Holdout"],
  ["fresh", "Verse holdout"],
];
const HOLDOUTS = SETS.filter(([s]) => s !== "tuning");

/** Too few to say anything: under this many real errors, cases or judged pieces of evidence. */
const MIN = { real: 5, passCases: 30, failCases: 10 } as const;
/** The lower bound (95%) a share must reach to report a failure, or to count as a second look. */
const LOWER = { report: 0.6, secondLook: 0.5 } as const;

const settled = (v: JevVerdict | undefined) => v === "fail" || v === "pass";
const outputOf = (r: V3Row) => `${r.tool}/${r.caseId}#${r.run}`;
const caseOf = (r: V3Row) => `${r.tool}/${r.caseId}/${r.check}`;
const pct = (n: number, d: number) => `${Math.round((100 * n) / d)}%`;
const floorPct = (x: number) => `${Math.floor(100 * x)}%`;

/** Wilson's lower bound (95%) of k out of n. */
function wilsonLow(k: number, n: number): number {
  if (!n) return 0;
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.max(0, (centre - margin) / d);
}

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

/** A judge's verdict on a row: Jev (v2, v3), Sonnet, or the hybrid (Jev where it decides, else Sonnet). */
type Who = "v2" | "v3" | "sonnet" | "hybrid";
const verdictOf = (r: V3Row, who: Who): JevVerdict | undefined =>
  who === "sonnet"
    ? r.judge
      ? "fail"
      : "pass"
    : who === "hybrid"
      ? settled(r.v3)
        ? r.v3
        : r.judge
          ? "fail"
          : "pass"
      : r[who];

/** The rows every judge is compared on: what Jev could decide (not a check the judge keeps). */
const comparable = (rows: V3Row[]) => rows.filter((r) => r.v3 !== "llm");

/**
 * The rows that must be labelled (any fail of Jev or Sonnet) and the rest, of which a fixed sample
 * is labelled; `weight` scales the sample up to the rest.
 */
function strata(set: V3Row[], labels: Labels) {
  const rows = comparable(set);
  const must = rows.filter((r) => r.v2 === "fail" || r.v3 === "fail" || r.judge);
  const rest = rows.filter((r) => !must.includes(r) && r.by !== "code");
  const sample = rest.filter((r) => labels[rowKey(r)] !== undefined);
  return { rows, must, rest, sample, weight: sample.length ? rest.length / sample.length : 0 };
}

/** The six tests of the plan, on one holdout. */
function tests(set: V3Row[], labels: Labels, evidence: Labels, order: OrderCount, fresh: boolean) {
  const label = (r: V3Row) => labels[rowKey(r)];
  const labelled = set.filter((r) => label(r) !== undefined);
  const falseAlarms = (v: "v2" | "v3") => set.filter((r) => r[v] === "fail" && label(r) === false).length;
  const v3Fails = labelled.filter((r) => r.v3 === "fail");
  const real = v3Fails.filter((r) => label(r) === true).length;
  const t1 = fresh
    ? `${real}/${v3Fails.length} echt fout: ${v3Fails.length < MIN.real ? "te weinig" : ok(real / v3Fails.length >= 0.8)}`
    : `v2 ${falseAlarms("v2")}, v3 ${falseAlarms("v3")}: ${ok(falseAlarms("v3") <= falseAlarms("v2") / 2)}`;
  const realErrors = labelled.filter((r) => label(r) === true);
  const misses = (who: Who) => realErrors.filter((r) => verdictOf(r, who) === "pass").length;
  const t2 =
    realErrors.length < MIN.real
      ? `${realErrors.length} echt fout gelabeld: te weinig`
      : `hybride ${misses("hybrid")}, Sonnet ${misses("sonnet")}: ${ok(misses("hybrid") <= misses("sonnet"))}`;
  const clear2 = clearOutputs(set, "v2");
  const clear3 = clearOutputs(set, "v3");
  // Reported only: version 3 leaves a check about the whole output to the judge (TypeSafe asks
  // for small questions), so fewer outputs can do without it; the cost table weighs that.
  const t3 = fresh ? `${clear3} (geen versie 2)` : `v2 ${clear2}, v3 ${clear3}`;
  const shown = set.filter((r) => r.v3 === "fail" && r.evidence && label(r) === true);
  const judged = shown.filter((r) => evidence[rowKey(r)] !== undefined);
  const right = judged.filter((r) => evidence[rowKey(r)]).length;
  const t4 = judged.length
    ? `${right}/${judged.length}: ${judged.length < MIN.real ? "te weinig" : ok(right / judged.length >= 0.8)}`
    : "-";
  const t5 = order.total ? `${pct(order.same, order.total)}: ${ok(order.same / order.total >= 0.95)}` : "-";
  const second = labelled.filter((r) => r.v3 === "fail" && !r.judge);
  const secondReal = second.filter((r) => label(r) === true).length;
  const t6 = second.length
    ? `${secondReal}/${second.length} echt fout: ${secondReal < MIN.real ? "te weinig" : ok(wilsonLow(secondReal, second.length) >= LOWER.secondLook)}`
    : "-";
  return [t1, t2, t3, t4, t5, t6];
}

/**
 * Per sort of check, holdout and judge (Jev v3 or Sonnet), the same rules against the labels:
 * - let pass (no LLM needed): at least 30 cases (a case and check, its runs counted once) where
 *   the judge passes, none of them labelled a real error; the bound 3/n says how far that goes;
 * - report a failure: at least 10 cases among the labelled fails, the lower bound (95%) of the
 *   real share at least 60%, and for Jev the same for the evidence in the piece it pointed to.
 */
function confidenceLine(
  family: string,
  setName: string,
  set: V3Row[],
  labels: Labels,
  evidence: Labels,
  who: "v3" | "sonnet",
) {
  const label = (r: V3Row) => labels[rowKey(r)];
  const rows = comparable(set);
  const passes = rows.filter((r) => verdictOf(r, who) === "pass" && r.by !== "code");
  const passCases = new Set(passes.map(caseOf)).size;
  const missed = passes.filter((r) => label(r) === true).length;
  const mayPass = missed > 0 ? "nee" : passCases < MIN.passCases ? "te weinig" : "ja";
  const bound = passCases ? pct(3, passCases) : "-";
  const name = who === "v3" ? "Jev" : "Sonnet";
  const head = `| ${family} | ${setName} | ${name} | ${passCases} | ${missed} | ${bound} | ${mayPass} |`;
  const fails = rows.filter((r) => verdictOf(r, who) === "fail" && label(r) !== undefined);
  const real = fails.filter((r) => label(r) === true);
  const low = wilsonLow(real.length, fails.length);
  const withEvidence = who === "v3" ? real.filter((r) => r.evidence && evidence[rowKey(r)] !== undefined) : [];
  const evidenceRight = withEvidence.filter((r) => evidence[rowKey(r)]).length;
  const evidenceOk = who === "sonnet" || (withEvidence.length > 0 && wilsonLow(evidenceRight, withEvidence.length) >= LOWER.report);
  const mayReport =
    new Set(fails.map(caseOf)).size < MIN.failCases ? "te weinig" : low >= LOWER.report && evidenceOk ? "ja" : "nee";
  const evidenceCell = who === "v3" && withEvidence.length ? pct(evidenceRight, withEvidence.length) : "-";
  return `${head} ${fails.length} | ${fails.length ? pct(real.length, fails.length) : "-"} | ${fails.length ? floorPct(low) : "-"} | ${evidenceCell} | ${mayReport} |`;
}

/** Jev (v3, v2), Sonnet and the hybrid side by side on one holdout, with the cost per 1,000 outputs. */
function sideBySide(
  setName: string,
  set: V3Row[],
  labels: Labels,
  cost: { jev?: number; sonnet?: number },
): string[] {
  const label = (r: V3Row) => labels[rowKey(r)];
  const { rows, must, sample, weight } = strata(set, labels);
  const outputs = new Set(set.map(outputOf));
  const escalated = new Set(set.filter((r) => !settled(r.v3)).map(outputOf)).size;
  const dollars = (x: number | undefined) => (x === undefined ? "-" : `$${(1000 * x).toFixed(2)}`);
  const costOf: Record<Who, string> = {
    v3: dollars(cost.jev),
    v2: "-",
    sonnet: dollars(cost.sonnet),
    hybrid:
      cost.jev !== undefined && cost.sonnet !== undefined
        ? dollars(cost.jev + (cost.sonnet * escalated) / outputs.size)
        : "-",
  };
  const has2 = set.some((r) => r.v2 !== undefined);
  const who: [Who, string][] = [
    ["v3", "Jev v3"],
    ...(has2 ? ([["v2", "Jev v2"]] as [Who, string][]) : []),
    ["sonnet", "Sonnet"],
    ["hybrid", "Hybride (Jev, anders Sonnet)"],
  ];
  return who.map(([w, name]) => {
    const decided = rows.filter((r) => settled(verdictOf(r, w))).length;
    const falseAlarms = must.filter((r) => verdictOf(r, w) === "fail" && label(r) === false).length;
    const missedMust = must.filter((r) => verdictOf(r, w) === "pass" && label(r) === true).length;
    const missedRest = Math.round(sample.filter((r) => verdictOf(r, w) === "pass" && label(r) === true).length * weight);
    const right = decided ? pct(decided - falseAlarms - missedMust - missedRest, decided) : "-";
    return `| ${setName} | ${name} | ${decided} | ${falseAlarms} | ${missedMust} + ${missedRest} geschat | ${right} | ${costOf[w]} |`;
  });
}

const BANDS: [number, number, string][] = [
  [0, 0.1, "0–0,1"],
  [0.1, 0.3, "0,1–0,3"],
  [0.3, 0.7, "0,3–0,7"],
  [0.7, 0.9, "0,7–0,9"],
  [0.9, 1.0001, "0,9–1"],
];

/** TypeSafe: "plot confidence against accuracy on your data". On the labelled holdout rows. */
function calibration(rows: V3Row[], labels: Labels): string[] {
  const labelled = rows.filter((r) => r.set !== "tuning" && r.v3P !== undefined && labels[rowKey(r)] !== undefined);
  return BANDS.flatMap(([lo, hi, name]) => {
    const band = labelled.filter((r) => (r.v3P as number) >= lo && (r.v3P as number) < hi);
    const real = band.filter((r) => labels[rowKey(r)] === true).length;
    return band.length ? [`| ${name} | ${band.length} | ${real} | ${pct(real, band.length)} |`] : [];
  });
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
  /** Jev's cost without the reversed requests: what use would cost. */
  jevUseCostUsd?: number;
  /** The judge's cost (API list price) over the outputs it judged (the 19 tools). */
  judgeCostUsd?: number;
  judgeOutputs?: number;
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
  const allOutputs = new Set(rows.map(outputOf)).size;
  const jevPerOutput = input.jevUseCostUsd !== undefined && allOutputs ? input.jevUseCostUsd / allOutputs : undefined;
  const sonnetPerOutput =
    input.judgeCostUsd !== undefined && input.judgeOutputs ? input.judgeCostUsd / input.judgeOutputs : undefined;
  return [
    "# Eval — harde checks, versie 3: Jev per stuk, naast versie 2 en de LLM-judge",
    "",
    `Datum: ${input.date} · Jev: ${input.jevModel} · checks: v3 · judge: ${input.judgeModel} · uitvoer en judge uit: ${input.source}`,
    "",
    `Requests aan Jev: ${input.calls} (met de omgekeerde volgorde) · gemiddeld ${meanMs} ms${input.jevCostUsd !== undefined ? ` · kosten Jev: $${input.jevCostUsd.toFixed(4)}` : ""}${input.jevUseCostUsd !== undefined ? ` (zonder de omgekeerde volgorde: $${input.jevUseCostUsd.toFixed(4)})` : ""}`,
    "",
    "| Set | Rijen | Beslist door Jev (v2 → v3) | Eens met de judge (v2 → v3) | Onbeslist (v2 → v3) | Bij de judge (rekenen, tellen, geheel) | Uitvoer zonder LLM (v2 → v3) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...present.map(([s, name]) => setLine(name, inSet(s))),
    "",
    ...(labels
      ? [
          "## Jev en Sonnet naast de labels",
          "",
          "Bastiaans labels zijn de waarheid, niet Sonnet. Gelabeld is elke rij waar Jev (v2 of v3) of Sonnet zegt dat de check faalt, plus een vaste steekproef van de rest; wat de steekproef mist, is opgeschaald naar de hele rest (geschat). Kosten tegen de API-lijstprijs, per 1.000 uitvoer: Jev zonder de omgekeerde volgorde; Sonnet is de hele judge-call, met de dimensies van de rubric erbij (de prijs van alleen de harde checks ligt lager); de hybride is Jev plus Sonnet voor de uitvoer waarin Jev iets niet beslist.",
          "",
          "| Set | Beoordelaar | Beslist | Vals alarm | Gemist | Geschat juist | Kosten per 1.000 uitvoer |",
          "| --- | --- | --- | --- | --- | --- | --- |",
          ...HOLDOUTS.filter(([s]) => inSet(s).length).flatMap(([s, name]) =>
            sideBySide(name, inSet(s), labels, {
              ...(jevPerOutput !== undefined ? { jev: jevPerOutput } : {}),
              ...(sonnetPerOutput !== undefined && s !== "fresh" ? { sonnet: sonnetPerOutput } : {}),
            }),
          ),
          "",
        ]
      : []),
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
          `Op Bastiaans labels, blind gekozen. Onder ${MIN.real} echte fouten (of beoordeelde bewijsstukken) zegt een toets "te weinig". Op de verse holdout is er geen versie 2: toets 1 vraagt daar dat 80% van de fails van versie 3 echt fout is.`,
          "",
          "| Toets | Oude holdout | Verse holdout |",
          "| --- | --- | --- |",
          ...(() => {
            const at = (s: JudgeSet, fresh: boolean) =>
              inSet(s).length ? tests(inSet(s), labels, evidence, input.order[s], fresh) : ["-", "-", "-", "-", "-", "-"];
            const old = at("holdout", false);
            const fresh = at("fresh", true);
            return [
              "1. Valse alarmen",
              "2. Gemist: de hybride niet meer dan Sonnet alleen",
              "3. Uitvoer zonder LLM (alleen gerapporteerd)",
              "4. Bewijs in het aangewezen stuk",
              "5. Volgorde van de opties",
              "6. Tweede blik: Jev faalt, Sonnet niet",
            ].map((name, i) => `| ${name} | ${old[i]} | ${fresh[i]} |`);
          })(),
          "",
          "## Met vertrouwen, per soort check",
          "",
          `Dezelfde regels voor Jev en Sonnet, tegen de labels. Een casus is een case met een check; zijn runs tellen één keer. Laten slagen: minstens ${MIN.passCases} casussen waar de beoordelaar slaagt, en geen gelabelde echte fout daarbij; de bovengrens (3/n) zegt hoe ver dat reikt. Fout melden: minstens ${MIN.failCases} casussen onder de gelabelde fails, en de ondergrens (95%) van het aandeel echt fout minstens ${floorPct(LOWER.report)}; voor Jev geldt dat ook voor het bewijs in het aangewezen stuk.`,
          "",
          "| Soort | Set | Beoordelaar | Slaagt (casussen) | Gemist | Bovengrens | Laten slagen | Faalt, gelabeld | Echt fout | Ondergrens | Bewijs klopt | Fout melden |",
          "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
          ...families.flatMap((f) =>
            HOLDOUTS.filter(([s]) => inSet(s).some((r) => r.family === f)).flatMap(([s, name]) =>
              (["v3", "sonnet"] as const).map((who) =>
                confidenceLine(f, name, inSet(s).filter((r) => r.family === f), labels, evidence, who),
              ),
            ),
          ),
          "",
          ...(() => {
            const sample = HOLDOUTS.flatMap(([s]) => strata(inSet(s), labels).sample);
            const real = sample.filter((r) => labels[rowKey(r)] === true).length;
            return sample.length
              ? [`Steekproef waar niemand zegt dat de check faalt: ${sample.length} gelabeld, ${real} echt fout (gemist door Jev én Sonnet, of door Sonnet waar Jev niet besliste).`, ""]
              : [];
          })(),
          "## Kalibratie",
          "",
          "Zoals TypeSafe aanraadt: hoe vaak is de check echt fout, per kans die Jev gaf? Op de gelabelde rijen van de holdouts; die zijn niet willekeurig gekozen (elke fail is gelabeld), dus dit laat de vorm zien, geen percentage voor alle uitvoer.",
          "",
          "| p(faalt) volgens Jev | Gelabeld | Echt fout | Aandeel |",
          "| --- | --- | --- | --- |",
          ...calibration(rows, labels),
          "",
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
 * The rows Bastiaan labels, blind: every row where Jev (version 2 or 3) or Sonnet says the check
 * fails, and a fixed sample of the rest, so both are measured the same way. Not a check the judge
 * keeps, nor one code passes. The tuning set only on request: the tests are on the holdouts.
 */
export function labelRows(rows: V3Row[], opts: { sample: number; seed: number; tuning?: boolean }): V3Row[] {
  const sets = comparable(rows).filter((r) => opts.tuning || r.set !== "tuning");
  const must = sets.filter((r) => r.v2 === "fail" || r.v3 === "fail" || r.judge);
  const pool = sets.filter((r) => !must.includes(r) && r.by !== "code");
  const rand = seeded(opts.seed);
  const shuffled = pool
    .map((r) => ({ r, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r);
  return [...must, ...shuffled.slice(0, opts.sample)];
}
