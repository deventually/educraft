/**
 * Pure helpers for the quick check's eval (`npm run eval:review-screen`): the cases, and scoring
 * Jev's skips against what the reviewers really said. The reviewers are the truth: a skipped
 * reviewer that gave a warning, or that a case expects a fault from, is a miss.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ScreenVerdict } from "../app/lib/agents/screen";
import type { CourseData } from "../app/lib/courses/types";
import type { AgentCase } from "./eval-agents-helpers";
import { EVALS_DIR } from "./eval-files";

export interface ScreenCase {
  id: string;
  set: "role-agents" | "holdout";
  locale: "nl" | "en";
  course: CourseData;
  /** Holdout: the reviewers expected to warn, written before any run. */
  faults?: string[];
  /** Role-agent case: the one reviewer it is about, and whether it hides a fault for it. */
  about?: { agent: string; fault: boolean };
  rejected?: AgentCase["rejected"];
  linkedWork?: AgentCase["linkedWork"];
}

export function loadScreenCases(dir = EVALS_DIR): ScreenCase[] {
  const agentCases = (
    JSON.parse(readFileSync(join(dir, "role-agents", "cases.json"), "utf8")) as {
      cases: AgentCase[];
    }
  ).cases.map(
    (c): ScreenCase => ({
      id: c.id,
      set: "role-agents",
      locale: c.locale,
      course: c.course,
      about: { agent: c.agent, fault: !!c.mustFind?.length },
      ...(c.rejected ? { rejected: c.rejected } : {}),
      ...(c.linkedWork ? { linkedWork: c.linkedWork } : {}),
    }),
  );
  const holdout = (
    JSON.parse(readFileSync(join(dir, "review-screen", "holdout.json"), "utf8")) as {
      cases: Omit<ScreenCase, "set">[];
    }
  ).cases.map((c): ScreenCase => ({ ...c, set: "holdout" }));
  return [...agentCases, ...holdout];
}

/** true/false where the case says something about this reviewer; null where it does not. */
export function expectedFault(c: ScreenCase, agent: string): boolean | null {
  if (c.about) return c.about.agent === agent ? c.about.fault : null;
  return (c.faults ?? []).includes(agent);
}

/** One reviewer's review of one case (one run), as the eval stores it. */
export interface HatReview {
  caseId: string;
  agent: string;
  run: number;
  parsed: boolean;
  findings: { severity: "warning" | "info"; target?: string; message: string }[];
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number };
  ms?: number;
}

/** One Jev verdict for one reviewer on one case (one repetition). */
export interface ScreenRow {
  set: ScreenCase["set"];
  caseId: string;
  agent: string;
  repeat: number;
  verdict: ScreenVerdict;
  ms: number;
  costUsd?: number;
}

const pairKey = (caseId: string, agent: string) => `${caseId}/${agent}`;

export interface ScreenSummary {
  pairs: number;
  skipped: number;
  missedWarning: string[];
  missedExpected: string[];
  missedInfoOnly: string[];
  rightlySkipped: string[];
  /** Pairs where Jev's repetitions did not agree on run or skip. */
  unstable: string[];
}

/** A pair counts as skipped when any repetition skipped it (the strict reading). */
export function summarise(cases: ScreenCase[], rows: ScreenRow[], reviews: HatReview[]): ScreenSummary {
  const byPair = new Map<string, ScreenRow[]>();
  for (const r of rows) {
    const k = pairKey(r.caseId, r.agent);
    byPair.set(k, [...(byPair.get(k) ?? []), r]);
  }
  const s: ScreenSummary = {
    pairs: byPair.size,
    skipped: 0,
    missedWarning: [],
    missedExpected: [],
    missedInfoOnly: [],
    rightlySkipped: [],
    unstable: [],
  };
  for (const [k, rs] of byPair) {
    const first = rs[0] as ScreenRow;
    if (new Set(rs.map((r) => r.verdict.run)).size > 1) s.unstable.push(k);
    if (rs.every((r) => r.verdict.run)) continue;
    s.skipped++;
    const said = reviews.filter((r) => r.caseId === first.caseId && r.agent === first.agent);
    const warns = said.some((r) => r.findings.some((f) => f.severity === "warning"));
    const infos = said.some((r) => r.findings.some((f) => f.severity === "info"));
    const c = cases.find((x) => x.id === first.caseId);
    const expected = c ? expectedFault(c, first.agent) === true : false;
    if (warns) s.missedWarning.push(k);
    if (expected) s.missedExpected.push(k);
    if (!warns && !expected && infos) s.missedInfoOnly.push(k);
    if (!warns && !expected && !infos) s.rightlySkipped.push(k);
  }
  return s;
}

export interface ScreenMeta {
  date: string;
  label: string;
  jevModel: string;
  reviewModel: string;
  repeat: number;
  /** Mean list price of one reviewer call in the reviews (USD), when known. */
  reviewCostUsd?: number;
}

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "–");

export function screenReport(
  meta: ScreenMeta,
  cases: ScreenCase[],
  rows: ScreenRow[],
  reviews: HatReview[],
): string {
  const out: string[] = [
    `# Snelle check vóór het reviewteam (Jev) — ${meta.date}${meta.label ? ` (${meta.label})` : ""}`,
    "",
    `Jev: \`${meta.jevModel}\`, ${meta.repeat}× per cursus. Reviewers: \`${meta.reviewModel}\`. Drempels vooraf vast (0,3/0,7), niets afgesteld.`,
    "",
    "| Set | Paren | Overgeslagen | Gemist: waarschuwing | Gemist: verwachte fout | Alleen tips gemist | Terecht overgeslagen | Wisselend |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  const sets = [
    ["role-agents", "Rolagenten-cases"],
    ["holdout", "Holdout"],
  ] as const;
  const sums = sets.map(([set, name]) => {
    const s = summarise(cases, rows.filter((r) => r.set === set), reviews);
    out.push(
      `| ${name} | ${s.pairs} | ${s.skipped} (${pct(s.skipped, s.pairs)}) | ${s.missedWarning.length} | ${s.missedExpected.length} | ${s.missedInfoOnly.length} | ${s.rightlySkipped.length} | ${s.unstable.length} |`,
    );
    return [name, s] as const;
  });

  const agents = [...new Set(rows.map((r) => r.agent))];
  out.push("", "## Per reviewer (beide sets)", "", "| Reviewer | Paren | Overgeslagen | Gemist: waarschuwing |", "| --- | --- | --- | --- |");
  for (const a of agents) {
    const s = summarise(cases, rows.filter((r) => r.agent === a), reviews);
    out.push(`| ${a} | ${s.pairs} | ${s.skipped} | ${s.missedWarning.length} |`);
  }

  out.push("", "## Wat Jev oversloeg, en wat de reviewer zei", "");
  for (const [name, s] of sums) {
    const listed = [...s.missedWarning, ...s.missedExpected, ...s.missedInfoOnly];
    out.push(`### ${name}`, "");
    if (!listed.length && !s.rightlySkipped.length) out.push("Niets overgeslagen.", "");
    for (const k of [...new Set(listed)]) {
      const [caseId, agent] = k.split("/") as [string, string];
      const said = reviews.filter((r) => r.caseId === caseId && r.agent === agent);
      out.push(`- **${k}**${s.missedExpected.includes(k) ? " (verwachte fout)" : ""}:`);
      for (const f of said.flatMap((r) => r.findings))
        out.push(`  - ${f.severity}${f.target ? ` ${f.target}` : ""}: ${f.message.replace(/\s+/g, " ")}`);
    }
    if (s.rightlySkipped.length) out.push(`- Terecht overgeslagen: ${s.rightlySkipped.join(", ")}`);
    out.push("");
  }

  const reasons = new Map<string, number>();
  for (const r of rows)
    for (const why of r.verdict.reasons) {
      const k = why.split(".").slice(0, 2).join(".");
      reasons.set(k, (reasons.get(k) ?? 0) + 1);
    }
  out.push("## Waarom een reviewer wél draaide", "", "| Reden | Keer |", "| --- | --- |");
  for (const [k, n] of [...reasons].sort((a, b) => b[1] - a[1])) out.push(`| ${k} | ${n} |`);

  const calls = new Map<string, ScreenRow>();
  for (const r of rows) calls.set(`${r.caseId}#${r.repeat}`, r);
  const ms = [...calls.values()].map((r) => r.ms);
  const cost = [...calls.values()].reduce((s, r) => s + (r.costUsd ?? 0), 0);
  const skippedAll = sums.reduce((s, [, x]) => s + x.skipped, 0);
  const pairsAll = sums.reduce((s, [, x]) => s + x.pairs, 0);
  out.push(
    "",
    "## Snelheid en kosten",
    "",
    `- Jev: ${calls.size} verzoeken (één per cursus en herhaling, alle reviewers samen), gemiddeld ${Math.round(ms.reduce((s, x) => s + x, 0) / (ms.length || 1))} ms, hoogst ${Math.max(0, ...ms)} ms; samen $${cost.toFixed(5)} (gemeten).`,
    `- Overgeslagen reviewer-aanroepen: ${skippedAll} van ${pairsAll} (${pct(skippedAll, pairsAll)}).`,
    meta.reviewCostUsd === undefined
      ? "- Kosten van een reviewer-aanroep: onbekend."
      : `- Een reviewer-aanroep kost gemiddeld $${meta.reviewCostUsd.toFixed(4)} (API-lijstprijs van de reviews in deze meting). Jev per cursus: $${(cost / (calls.size || 1)).toFixed(5)}.`,
  );
  return `${out.join("\n")}\n`;
}
