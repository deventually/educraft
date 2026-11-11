/**
 * Pure helpers for the framework-extraction eval (`npm run eval:framework`):
 * score a checked extraction against what a synthetic form is known to hold.
 */
import type { ExtractParseResult } from "../app/lib/portfolio/extract";
import type { Outcome } from "../app/lib/portfolio/types";

export interface ExpectedOutcome {
  /** Matched against the digits of the outcome's code (or title): "1" matches "LU1". */
  code: string;
  /** Fragments of the criteria, in the form's order. */
  criteria: string[];
  /** The form's sections; `covers` are 1-based positions in `criteria` above. */
  sections: { title: string; covers?: number[] }[];
  /** Fragments of the sources the form names. */
  literature: string[];
}

export interface FrameworkCase {
  id: string;
  description?: string;
  locale: "nl" | "en";
  form: string;
  expect: ExpectedOutcome[];
}

export interface FrameworkScore {
  caseId: string;
  parse: boolean;
  /** 0–1 shares. */
  criteria: number;
  sections: number;
  covers: number;
  literature: number;
  /** Counts that should be 0. */
  unverified: number;
  extra: number;
  sectionFlags: number;
  pass: boolean;
}

const low = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const digits = (s: string) => s.replace(/\D/g, "");
const same = (a: string, b: string) => low(a).includes(low(b)) || low(b).includes(low(a));

function findOutcome(outcomes: Outcome[], code: string): Outcome | undefined {
  return outcomes.find((o) => (digits(o.code) || digits(o.title)) === digits(code));
}

export function scoreFrameworkCase(c: FrameworkCase, r: ExtractParseResult): FrameworkScore {
  const totals = { criteria: 0, sections: 0, covers: 0, literature: 0 };
  const hits = { criteria: 0, sections: 0, covers: 0, literature: 0 };
  let extra = 0;
  let sectionFlags = 0;
  let unverified = 0;
  const outcomes = r.ok ? r.framework.outcomes : [];
  if (r.ok) {
    unverified = outcomes.reduce((n, o) => n + o.criteria.filter((x) => x.unverified).length, 0);
    for (const o of outcomes) {
      if (!c.expect.some((e) => findOutcome([o], e.code))) extra += o.outline?.length ?? 0;
    }
  }
  for (const e of c.expect) {
    const o = r.ok ? findOutcome(outcomes, e.code) : undefined;
    const outline = o?.outline ?? [];
    // Expected criterion i → the id of the found criterion with that fragment.
    const ids = e.criteria.map(
      (frag) => o?.criteria.find((x) => low(x.text).includes(low(frag)))?.id,
    );
    totals.criteria += e.criteria.length;
    hits.criteria += ids.filter(Boolean).length;
    for (const s of e.sections) {
      totals.sections++;
      const found = outline.find((x) => same(x.title, s.title));
      if (found) hits.sections++;
      for (const n of s.covers ?? []) {
        totals.covers++;
        const id = ids[n - 1];
        if (found && id && found.criterionIds.includes(id)) hits.covers++;
      }
    }
    extra += outline.filter((x) => !e.sections.some((s) => same(x.title, s.title))).length;
    sectionFlags += outline.filter((x) => x.unverified).length;
    totals.literature += e.literature.length;
    hits.literature += e.literature.filter((frag) =>
      (o?.literature ?? []).some((l) => low(l).includes(low(frag))),
    ).length;
  }
  const share = (k: keyof typeof totals) => (totals[k] ? hits[k] / totals[k] : 1);
  const score = {
    caseId: c.id,
    parse: r.ok,
    criteria: r.ok ? share("criteria") : 0,
    sections: r.ok ? share("sections") : 0,
    covers: r.ok ? share("covers") : 0,
    literature: r.ok ? share("literature") : 0,
    unverified,
    extra,
    sectionFlags,
  };
  return {
    ...score,
    pass:
      score.parse &&
      score.criteria === 1 &&
      score.sections === 1 &&
      score.covers === 1 &&
      score.literature === 1 &&
      unverified === 0 &&
      extra === 0 &&
      sectionFlags === 0,
  };
}

export function frameworkReportMarkdown(input: {
  date: string;
  model: string;
  promptId: string;
  repeat: number;
  rows: FrameworkScore[];
}): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const yesNo = (b: boolean) => (b ? "ja" : "nee");
  return [
    `# Eval kaderextractie — ${input.date}`,
    "",
    `Prompt: ${input.promptId}. Model: ${input.model}. Herhalingen per case: ${input.repeat}. Deterministische score, geen beoordelaarsmodel.`,
    "",
    "| Case | Geparsed | Criteria | Niet letterlijk | Secties | Extra secties | Koppelingen | Literatuur | Sectienaam niet letterlijk | Geslaagd |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${yesNo(r.parse)} | ${pct(r.criteria)} | ${r.unverified} | ${pct(r.sections)} | ${r.extra} | ${pct(r.covers)} | ${pct(r.literature)} | ${r.sectionFlags} | ${yesNo(r.pass)} |`,
    ),
    "",
    `Geslaagd: ${input.rows.filter((r) => r.pass).length} van ${input.rows.length}.`,
    "",
  ].join("\n");
}
