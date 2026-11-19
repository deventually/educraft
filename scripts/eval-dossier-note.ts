/**
 * Test-dossier notes eval (brief P35.2). Runs the REAL prompt, the REAL message builder and the
 * REAL code checks on fictional test analyses, and scores deterministically (no judge model).
 * Two cases carry a known fault (a made-up p-value, a question that does not exist) that must not
 * reach the teacher. Whether the concept is good, a person reads in the saved answers (`rubric.md`).
 *
 *   ANTHROPIC_API_KEY=… npm run eval:dossier-note                 # every case once
 *   npm run eval:dossier-note -- --model claude-code::claude-sonnet-5-5 --repeat 3
 *   npm run eval:dossier-note -- --dry-run                        # build messages only
 *
 * Costs well under €1 per run (BESLUIT-2026-11-04-18). Never part of CI.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { providerForModel } from "~/lib/ai/provider";
import { buildDossierNoteMessage, parseDossierNote } from "~/lib/courses/dossierNote";
import { getRuntimePrompt } from "~/lib/prompts";
import {
  type DossierNoteCase,
  type DossierNoteScore,
  dossierNoteReportMarkdown,
  scoreDossierNoteCase,
} from "./eval-dossier-note-helpers";

const EVALS_DIR = join(process.cwd(), "evals");
const STEP = "assessment-dossier-notes";
const PROMPT_ID = `${STEP}@v1`;

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
    JSON.parse(readFileSync(join(EVALS_DIR, STEP, "cases.json"), "utf8"))
      .cases as DossierNoteCase[]
  ).filter((c) => !only || c.id === only);
  const date = new Date().toISOString().slice(0, 10);
  const outDir = join(EVALS_DIR, "output", date, STEP);
  mkdirSync(outDir, { recursive: true });
  const rows: DossierNoteScore[] = [];
  let retries = 0;

  for (const c of cases) {
    const message = buildDossierNoteMessage(c.input);
    if (dryRun) {
      console.log(`--- ${c.id} (${message.length} chars)\n${message}\n`);
      continue;
    }
    for (let i = 0; i < repeat; i++) {
      // The app's own budget, temperature and single retry (app/server/dossierNote.server.ts).
      const ask = async () =>
        (
          await providerForModel(model).generate({
            model,
            system: getRuntimePrompt(PROMPT_ID, c.locale),
            messages: [{ role: "user", content: message }],
            temperature: 0,
            maxTokens: 2_000,
          })
        ).text;
      const texts = [await ask()];
      let parsed = parseDossierNote(texts[0] ?? "", c.input);
      if (!parsed.ok) {
        retries++;
        texts.push(await ask());
        parsed = parseDossierNote(texts[1] ?? "", c.input);
      }
      const suffix = repeat > 1 ? `.run${i + 1}` : "";
      writeFileSync(
        join(outDir, `${c.id}${suffix}.md`),
        `${message}\n\n${texts.map((t) => `=== ANSWER ===\n\n${t}\n`).join("\n")}\n=== SHOWN ===\n\n${
          parsed.ok ? `${parsed.note.draft}\n\n${parsed.note.questions.join("\n")}` : "(none)"
        }\n`,
      );
      const score = scoreDossierNoteCase(c, texts.at(-1) ?? "", parsed);
      rows.push({ ...score, caseId: repeat > 1 ? `${c.id}#${i + 1}` : c.id });
      console.log(`${score.pass ? "✓" : "×"} ${c.id}${repeat > 1 ? `#${i + 1}` : ""}`);
    }
  }
  if (dryRun) return;

  const reports = join(EVALS_DIR, "reports");
  mkdirSync(reports, { recursive: true });
  const file = join(reports, `${date}${label}-${STEP}.md`);
  writeFileSync(file, dossierNoteReportMarkdown({ date, model, repeat, rows, retries }));
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
