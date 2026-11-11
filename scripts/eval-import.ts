/**
 * Course-import eval (brief P26, 26.3). Runs the REAL import prompt, the REAL
 * message builder and the REAL code checks on fictional documents whose content
 * is known, and scores deterministically (no judge model).
 *
 *   ANTHROPIC_API_KEY=… npm run eval:import                 # every case once
 *   ANTHROPIC_API_KEY=… npm run eval:import -- --repeat 3   # final measurement
 *   npm run eval:import -- --dry-run                        # build messages only
 *
 * Costs well under €1 per run (BESLUIT-2026-11-04-18). Never part of CI.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { providerForModel } from "~/lib/ai/provider";
import { buildImportMessage, parseImport } from "~/lib/courses/import";
import { emptyCourseData } from "~/lib/courses/schema";
import { getRuntimePrompt } from "~/lib/prompts";
import {
  type ImportCase,
  type ImportScore,
  importReportMarkdown,
  scoreImportCase,
} from "./eval-import-helpers";

const EVALS_DIR = join(process.cwd(), "evals");
const PROMPT_ID = "course-import@v3";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const repeat = Math.max(1, Number(arg("repeat") ?? 1));
  const model = arg("model") ?? DEFAULT_MODEL;
  const label = arg("label") ?? "";
  const only = arg("case");
  const cases = (
    JSON.parse(readFileSync(join(EVALS_DIR, "course-import", "cases.json"), "utf8"))
      .cases as ImportCase[]
  ).filter((c) => !only || c.id === only);
  const date = new Date().toISOString().slice(0, 10);
  const outDir = join(EVALS_DIR, "output", date, "course-import");
  mkdirSync(outDir, { recursive: true });
  const rows: ImportScore[] = [];

  for (const c of cases) {
    const message = buildImportMessage(c.document, c.courseName);
    if (dryRun) {
      console.log(`--- ${c.id} (${message.length} chars)\n${message}\n`);
      continue;
    }
    for (let i = 0; i < repeat; i++) {
      // The app's own budget and temperature (app/server/courseImport.server.ts).
      const { text } = await providerForModel(model).generate({
        model,
        system: getRuntimePrompt(PROMPT_ID, c.locale),
        messages: [{ role: "user", content: message }],
        temperature: 0,
        maxTokens: 8_000,
      });
      const suffix = repeat > 1 ? `.run${i + 1}` : "";
      writeFileSync(join(outDir, `${c.id}${suffix}.md`), `${message}\n\n=== ANSWER ===\n\n${text}\n`);
      const score = scoreImportCase(c, parseImport(text, c.document, emptyCourseData()));
      rows.push({ ...score, caseId: repeat > 1 ? `${c.id}#${i + 1}` : c.id });
      console.log(`${score.pass ? "✓" : "×"} ${c.id}${repeat > 1 ? `#${i + 1}` : ""}`);
    }
  }
  if (dryRun) return;

  const reports = join(EVALS_DIR, "reports");
  mkdirSync(reports, { recursive: true });
  const file = join(reports, `${date}${label}-course-import.md`);
  writeFileSync(file, importReportMarkdown({ date, model, repeat, rows }));
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
