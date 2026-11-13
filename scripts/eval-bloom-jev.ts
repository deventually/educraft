/**
 * The Bloom proposal three ways (experiment, 2026-11-13): the LLM inside the real course import
 * (`course-import@v3`, one call per course document), TypeSafe's Jev (one call per outcome) and
 * the verb list in code, on the same outcomes: the tuning set and the holdout of public ones.
 *
 *   ANTHROPIC_API_KEY=… OPENROUTER_API_KEY=… npm run eval:bloom-jev -- --repeat 3 --label a
 *   … -- --set holdout              # one set only (default: both)
 *   npm run eval:bloom-jev -- --dry-run   # build the requests only, no API
 *   npm run eval:bloom-jev -- --rescore evals/reports/<date><label>-bloom-jev-raw.json
 *                                    # the report again with the labels as they are now, no API
 *
 * Writes `evals/reports/<date><label>-bloom-jev.md` and `…-bloom-jev-raw.json` (every exact Jev
 * request with its answer, and every import answer). Bastiaan's labels go in
 * `evals/bloom-jev/labels.json` (outcome → level, or null for "no level"). Never part of CI.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { providerForModel } from "~/lib/ai/provider";
import type { BloomLevel } from "~/lib/courses/bloom";
import { buildImportMessage, parseImport } from "~/lib/courses/import";
import { emptyCourseData } from "~/lib/courses/schema";
import { getRuntimePrompt } from "~/lib/prompts";
import {
  type BloomRow,
  bloomFromVerb,
  bloomReport,
  buildBloomJevRequest,
  loadBloomSuite,
  outcomeDocument,
  parseBloomJevAnswer,
  sameOutcome,
} from "./eval-bloom-jev-helpers";
import { askJev, JEV_MODEL } from "./eval-evidence-jev-helpers";
import { EVALS_DIR, REPORTS_DIR } from "./eval-files";
import { mapLimit, parallelism } from "./eval-helpers";
import { catalogPrice, listPriceUsd } from "./eval-judge-jev-helpers";

const PROMPT_ID = "course-import@v3";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type Meta = Omit<Parameters<typeof bloomReport>[0], "rows" | "labels">;

function loadLabels(): Record<string, BloomLevel | null> {
  const file = join(EVALS_DIR, "bloom-jev", "labels.json");
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as { labels: Record<string, BloomLevel | null> })
        .labels
    : {};
}

function rescore(rawFile: string) {
  const { meta, rows } = JSON.parse(readFileSync(rawFile, "utf8")) as {
    meta: Meta;
    rows: BloomRow[];
  };
  const file = rawFile.replace(/-raw\.json$/, ".md");
  writeFileSync(file, bloomReport({ ...meta, rows, labels: loadLabels() }));
  console.log(`Report: ${file}`);
}

async function main() {
  const again = arg("rescore");
  if (again) return rescore(again);
  const dryRun = process.argv.includes("--dry-run");
  const repeat = Math.max(1, Number(arg("repeat") ?? 1));
  const label = (arg("label") ?? "").replace(/[^a-z0-9-]/gi, "");
  const jevModel = arg("model") ?? JEV_MODEL;
  const llmModel = arg("llm-model") ?? DEFAULT_MODEL;
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!dryRun && !apiKey) throw new Error("needs OPENROUTER_API_KEY");
  const only = arg("set");
  const sets = (["cases", "holdout"] as const).filter((s) => !only || s === only);
  const price = catalogPrice(llmModel);
  const limit = parallelism(arg("parallel") ?? "4");

  const rows: BloomRow[] = [];
  const raw: unknown[] = [];
  const jevMs: number[] = [];
  const llmMs: number[] = [];
  let jevCostUsd = 0;
  let llmCostUsd = 0;
  let llmPriced = true;

  for (const set of sets) {
    for (const course of loadBloomSuite(set).courses) {
      const document = outcomeDocument(course);
      const message = buildImportMessage(document, course.courseName);
      if (dryRun) {
        const req = buildBloomJevRequest(course.outcomes[0] ?? "", course.locale);
        console.log(`  · ${set}/${course.id}: ${course.outcomes.length} outcomes, ${message.length} chars`);
        console.log(JSON.stringify(req, null, 2));
        continue;
      }
      for (let run = 1; run <= repeat; run++) {
        // The LLM: the real import, as the app asks it (app/server/courseImport.server.ts).
        const start = performance.now();
        const r = await providerForModel(llmModel).generate({
          model: llmModel,
          system: getRuntimePrompt(PROMPT_ID, course.locale),
          messages: [{ role: "user", content: message }],
          temperature: 0,
          maxTokens: 8_000,
        });
        // The model's own time when the provider measures it (Claude Code: without the CLI starting).
        llmMs.push(r.apiMs ?? Math.round(performance.now() - start));
        const cost = r.usage ? listPriceUsd(r.usage, price) : undefined;
        if (cost === undefined) llmPriced = false;
        else llmCostUsd += cost;
        const parsed = parseImport(r.text, document, emptyCourseData());
        const imported = parsed.ok ? parsed.proposal.outcomes : [];
        const llmLevel = (o: string): BloomLevel | null =>
          imported.find((x) => sameOutcome(x.text, o))?.bloom ?? null;
        raw.push({ set, course: course.id, run, import: r.text });

        // Jev, one request per outcome, the option order rotated per repeat.
        const jev = await mapLimit(course.outcomes, limit, async (outcome) => {
          const request = buildBloomJevRequest(outcome, course.locale, {
            model: jevModel,
            rotate: run - 1,
          });
          const answer = await askJev(request, { apiKey });
          jevMs.push(answer.ms);
          const v = parseBloomJevAnswer(answer.body);
          if (v.costUsd !== undefined) jevCostUsd += v.costUsd;
          raw.push({ set, course: course.id, run, outcome, request, body: answer.body });
          return v.level;
        });

        course.outcomes.forEach((outcome, i) => {
          rows.push({
            set,
            outcome,
            jev: jev[i] ?? null,
            llm: llmLevel(outcome),
            verb: bloomFromVerb(outcome, course.locale),
          });
        });
        const missing = course.outcomes.filter((o) => !imported.some((x) => sameOutcome(x.text, o)));
        console.log(
          `  ✓ ${set}/${course.id}#${run}${missing.length ? ` (${missing.length} outcomes not found back in the import)` : ""}`,
        );
      }
    }
  }
  if (dryRun) return;

  const date = new Date().toISOString().slice(0, 10);
  const meta: Meta = {
    date,
    jevModel,
    llmModel,
    repeat,
    jevMs,
    llmMs,
    jevCostUsd,
    ...(llmPriced ? { llmCostUsd } : {}),
  };
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${date}${label}-bloom-jev.md`);
  writeFileSync(file, bloomReport({ ...meta, rows, labels: loadLabels() }));
  writeFileSync(
    join(REPORTS_DIR, `${date}${label}-bloom-jev-raw.json`),
    `${JSON.stringify({ meta, rows, raw }, null, 2)}\n`,
  );
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
