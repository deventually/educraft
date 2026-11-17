/**
 * Jev's check of the course import's tests (experiment): the REAL import (`course-import@v3`, the
 * real message and checks), then Jev on each test exactly as the app asks it
 * (`coverageJevRequests`, `coverageVerdict`), scored against what the fictional documents say.
 *
 *   JEV_API_KEY=… npm run eval:coverage-jev -- --llm-model claude-code::claude-sonnet-5-5 --repeat 3 --label a
 *   npm run eval:coverage-jev -- --dry-run          # the Jev requests for the labels, no API
 *
 * Writes `evals/reports/<date><label>-coverage-jev.md` and `…-coverage-jev-raw.json` (every exact
 * Jev request with its answer, and every import answer). Never part of CI.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { providerForModel } from "~/lib/ai/provider";
import {
  type CoverageJevAnswer,
  coverageJevRequests,
  coverageVerdict,
  parseCoverageJevAnswer,
} from "~/lib/courses/coverageJev";
import {
  buildImportMessage,
  type ImportAssessment,
  type ImportProposal,
  parseImport,
} from "~/lib/courses/import";
import { emptyCourseData } from "~/lib/courses/schema";
import { getRuntimePrompt } from "~/lib/prompts";
import {
  type CoverageCase,
  type CoverageRun,
  coverageReport,
  loadCoverageCases,
  scoreCoverageRun,
} from "./eval-coverage-jev-helpers";
import { askJev, JEV_KEY_ENV, JEV_MODEL } from "./eval-evidence-jev-helpers";
import { REPORTS_DIR } from "./eval-files";
import { mapLimit, parallelism } from "./eval-helpers";

const PROMPT_ID = "course-import@v3";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** The labels as if the LLM read them perfectly: what the dry run shows Jev. */
function labelled(c: CoverageCase): ImportProposal {
  return {
    outcomes: c.outcomes.map((text, i) => ({
      key: `o${i + 1}`,
      text,
      verbatim: true,
      existing: false,
      criteria: [],
    })),
    assessments: c.assessments.map((a, i) => ({
      key: `a${i + 1}`,
      title: a.title,
      kind: a.kind,
      outcomeKeys: a.covers.map((n) => `o${n}`),
      existing: false,
      details: {},
      parts: [],
    })),
    weightsOff: false,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const repeat = Math.max(1, Number(arg("repeat") ?? 1));
  const label = (arg("label") ?? "").replace(/[^a-z0-9-]/gi, "");
  const jevModel = arg("model") ?? JEV_MODEL;
  const llmModel = arg("llm-model") ?? DEFAULT_MODEL;
  const apiKey = process.env[JEV_KEY_ENV] ?? "";
  if (!dryRun && !apiKey) throw new Error(`needs ${JEV_KEY_ENV}`);
  const only = arg("case");
  const cases = loadCoverageCases().filter((c) => !only || c.id === only);
  const limit = parallelism(arg("parallel") ?? "4");

  const runs: CoverageRun[] = [];
  const raw: unknown[] = [];
  const jevMs: number[] = [];
  let jevCostUsd = 0;

  for (const c of cases) {
    if (dryRun) {
      for (const r of coverageJevRequests(labelled(c), c.document, c.locale, jevModel))
        console.log(`--- ${c.id}/${r.key}\n${JSON.stringify(r.request, null, 2)}\n`);
      continue;
    }
    for (let run = 1; run <= repeat; run++) {
      // The LLM: the real import, as the app asks it (app/server/courseImport.server.ts).
      const message = buildImportMessage(c.document, c.courseName);
      const r = await providerForModel(llmModel).generate({
        model: llmModel,
        system: getRuntimePrompt(PROMPT_ID, c.locale),
        messages: [{ role: "user", content: message }],
        temperature: 0,
        maxTokens: 8_000,
      });
      raw.push({ case: c.id, run, import: r.text });
      const parsed = parseImport(r.text, c.document, emptyCourseData());
      if (!parsed.ok) {
        console.log(`  × ${c.id}#${run}: the import gave ${parsed.error}`);
        runs.push({ pairs: [], kinds: [], missing: c.assessments.map((a) => a.title) });
        continue;
      }
      const proposal = parsed.proposal;
      const keys = proposal.outcomes.map((o) => o.key);
      const requests = coverageJevRequests(proposal, c.document, c.locale, jevModel);
      const answers = await mapLimit(requests, limit, async ({ key, request }) => {
        const asked = await askJev(request, { apiKey });
        jevMs.push(asked.ms);
        const answer = parseCoverageJevAnswer(asked.body);
        if (answer.costUsd !== undefined) jevCostUsd += answer.costUsd;
        raw.push({ case: c.id, run, test: key, request, body: asked.body });
        return [key, answer] as const;
      });
      const jev = new Map<string, { answer: CoverageJevAnswer; checked: ImportAssessment }>();
      for (const [key, answer] of answers) {
        const a = proposal.assessments.find((x) => x.key === key);
        if (a) jev.set(key, { answer, checked: coverageVerdict(a, keys, answer) });
      }
      const scored = scoreCoverageRun(c, run, proposal, jev);
      runs.push(scored);
      console.log(`  ✓ ${c.id}#${run}${scored.missing.length ? ` (${scored.missing.length} tests not found)` : ""}`);
    }
  }
  if (dryRun) return;

  const date = new Date().toISOString().slice(0, 10);
  const meta = { date, llmModel, jevModel, repeat, jevMs, jevCostUsd };
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${date}${label}-coverage-jev.md`);
  writeFileSync(file, coverageReport({ ...meta, runs }));
  writeFileSync(
    join(REPORTS_DIR, `${date}${label}-coverage-jev-raw.json`),
    `${JSON.stringify({ meta, runs, raw }, null, 2)}\n`,
  );
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
