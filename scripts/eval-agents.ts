/**
 * Role-agent eval (brief P21, 21.2). Runs the REAL hat prompts, the REAL input
 * builder and the REAL answer filter on synthetic courses whose fault is known,
 * and scores deterministically (no judge model).
 *
 *   ANTHROPIC_API_KEY=… npm run eval:agents                 # every case once
 *   ANTHROPIC_API_KEY=… npm run eval:agents -- --repeat 3   # final measurement
 *   npm run eval:agents -- --dry-run                        # build messages only
 *
 * Costs well under €1 per run (BESLUIT-2026-11-04-18). Never part of CI.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseAgentReview } from "~/lib/agents/filter";
import { buildReviewMessage } from "~/lib/agents/input";
import { getAgent } from "~/lib/agents/registry";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { providerForModel } from "~/lib/ai/provider";
import { checkAlignment } from "~/lib/courses/alignment";
import { getRuntimePrompt } from "~/lib/prompts";
import {
  type AgentCase,
  type AgentScore,
  agentReportMarkdown,
  scoreAgentCase,
  unknownTargets,
} from "./eval-agents-helpers";

const EVALS_DIR = join(process.cwd(), "evals");

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
    JSON.parse(readFileSync(join(EVALS_DIR, "role-agents", "cases.json"), "utf8"))
      .cases as AgentCase[]
  ).filter((c) => !only || c.id === only);
  const date = new Date().toISOString().slice(0, 10);
  const outDir = join(EVALS_DIR, "output", date, "role-agents");
  mkdirSync(outDir, { recursive: true });
  const rows: AgentScore[] = [];

  for (const c of cases) {
    const agent = getAgent(c.agent);
    if (!agent) throw new Error(`Unknown agent in case ${c.id}: ${c.agent}`);
    const rejected = c.rejected ?? [];
    const message = buildReviewMessage(
      { course: c.course, alignment: checkAlignment(c.course), rejected, linkedWork: c.linkedWork },
      c.locale,
    );
    if (dryRun) {
      console.log(`--- ${c.id} (${message.length} chars)\n${message}\n`);
      continue;
    }
    for (let i = 0; i < repeat; i++) {
      const { text } = await providerForModel(model).generate({
        model,
        system: getRuntimePrompt(agent.promptId, c.locale),
        messages: [{ role: "user", content: message }],
        temperature: 0,
        maxTokens: 4_000,
      });
      const suffix = repeat > 1 ? `.run${i + 1}` : "";
      writeFileSync(join(outDir, `${c.id}${suffix}.md`), `${message}\n\n=== ANSWER ===\n\n${text}\n`);
      const score = scoreAgentCase(c, parseAgentReview(text, c.course, rejected), unknownTargets(text, c.course));
      rows.push({ ...score, caseId: repeat > 1 ? `${c.id}#${i + 1}` : c.id });
      console.log(`${score.pass ? "✓" : "×"} ${c.id}${repeat > 1 ? `#${i + 1}` : ""}`);
    }
  }
  if (dryRun) return;

  const reports = join(EVALS_DIR, "reports");
  mkdirSync(reports, { recursive: true });
  const file = join(reports, `${date}${label}-role-agents.md`);
  writeFileSync(file, agentReportMarkdown({ date, model, repeat, rows }));
  console.log(`Report: ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
