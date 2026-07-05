/**
 * LimeOnIt eval harness — measures OUTPUT QUALITY, the thing structural tests
 * (placeholders resolve, NL/EN parity) can't see. It reuses the REAL pipeline
 * (buildSystemPrompt + providerForModel), so what it scores is exactly what the
 * app would send.
 *
 * ⚠️ This calls real LLM APIs — it COSTS money (~€1–3/run) and needs
 *    ANTHROPIC_API_KEY. It is NOT part of `npm test` / CI. Run it by hand:
 *
 *    ANTHROPIC_API_KEY=sk-… npm run eval                     # every tool with cases
 *    ANTHROPIC_API_KEY=sk-… npm run eval -- --tool forum-autograder
 *    npm run eval -- --cases-only            # regenerate outputs, don't judge
 *    npm run eval -- --judge-only            # re-judge the latest outputs
 *    npm run eval -- --judge-model claude-sonnet-4-6
 *    npm run eval -- --dry-run               # build every prompt, NO API calls (free)
 *
 * Layout:
 *    evals/<tool-slug>/cases.json   input scenarios (committed)
 *    evals/<tool-slug>/rubric.md    judge rubric, English (committed)
 *    evals/output/<date>/…       raw model outputs      (gitignored)
 *    evals/reports/<date>.md     scored report + .scores.json (committed)
 *
 * Runs via `vite-node -c scripts/eval.config.ts` (see that file for why not tsx).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildSystemPrompt, reinforceLanguage } from "~/lib/template/buildSystemPrompt";
import { ALL_TOOLS, getToolBySlug } from "~/lib/registry";
import type { Tool, ToolStage, OutputLanguage, ChatMessage } from "~/lib/registry/types";
import type { ContextProfile } from "~/lib/context/types";
import type { ImageInput } from "~/lib/ai/types";
import { providerForModel } from "~/lib/ai/provider";
import {
  parseJudgeResult,
  averageScore,
  buildReportMarkdown,
  reportRowKey,
  countWords,
  type ReportRow,
} from "./eval-helpers";

// ---------------------------------------------------------------------------
// Case + CLI shapes
// ---------------------------------------------------------------------------

interface EvalCase {
  id: string;
  description?: string;
  outputLanguage: OutputLanguage;
  /** Form values keyed by input field name. */
  values?: Record<string, string | number | boolean | string[]>;
  /** Inline teaching-context fixture (no id needed; matches ContextProfile). */
  profile?: Omit<ContextProfile, "id">;
  /** Chat tools only: the scripted student turns the harness plays. */
  userTurns?: string[];
  /** Vision tools (e.g. math-grading): image file, relative to evals/<slug>/. */
  imagePath?: string;
}

interface CasesFile {
  cases: EvalCase[];
}

interface Cli {
  tool?: string;
  casesOnly: boolean;
  judgeOnly: boolean;
  /** Build every case's prompt (validates placeholders) without calling any API. */
  dryRun: boolean;
  judgeModel: string;
}

const EVALS_DIR = join(process.cwd(), "evals");
const OUTPUT_DIR = join(EVALS_DIR, "output");
const REPORTS_DIR = join(EVALS_DIR, "reports");
const DEFAULT_JUDGE_MODEL = "claude-sonnet-4-6";

function parseCli(argv: string[]): Cli {
  const cli: Cli = {
    casesOnly: false,
    judgeOnly: false,
    dryRun: false,
    judgeModel: DEFAULT_JUDGE_MODEL,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tool") cli.tool = argv[++i];
    else if (a === "--cases-only") cli.casesOnly = true;
    else if (a === "--judge-only") cli.judgeOnly = true;
    else if (a === "--dry-run") cli.dryRun = true;
    else if (a === "--judge-model") cli.judgeModel = argv[++i] ?? DEFAULT_JUDGE_MODEL;
  }
  return cli;
}

/** YYYY-MM-DD in local time. (A plain script may use Date; only Workflow forbids it.) */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/** Tools that have an evals/<tool-slug>/cases.json, optionally filtered to one. */
function toolsWithCases(only?: string): Tool[] {
  const wanted = only ? [getToolBySlug(only)].filter((t): t is Tool => !!t) : ALL_TOOLS;
  if (only && wanted.length === 0) throw new Error(`Unknown tool slug: ${only}`);
  return wanted.filter((t) => existsSync(join(EVALS_DIR, t.slug, "cases.json")));
}

function loadCases(tool: Tool): EvalCase[] {
  const raw = readFileSync(join(EVALS_DIR, tool.slug, "cases.json"), "utf8");
  const parsed = JSON.parse(raw) as CasesFile;
  if (!Array.isArray(parsed.cases)) throw new Error(`${tool.slug}/cases.json: missing "cases" array`);
  return parsed.cases;
}

function loadRubric(tool: Tool): string {
  const path = join(EVALS_DIR, tool.slug, "rubric.md");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

// ---------------------------------------------------------------------------
// Case phase — build the real prompt and call the provider
// ---------------------------------------------------------------------------

const TRIGGER: Record<OutputLanguage, string> = {
  nl: "Voer de opdracht volledig uit.",
  en: "Carry out the task in full.",
};

const IMAGE_MEDIA: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** Load a case's image fixture (relative to evals/<slug>/) as a provider image. */
function loadImage(toolSlug: string, imagePath: string): ImageInput {
  const abs = join(EVALS_DIR, toolSlug, imagePath);
  if (!existsSync(abs)) {
    throw new Error(
      `image fixture not found: ${abs} — drop a real image there (see evals/${toolSlug}/fixtures/README.md)`,
    );
  }
  const ext = (imagePath.split(".").pop() ?? "").toLowerCase();
  const mediaType = IMAGE_MEDIA[ext];
  if (!mediaType) throw new Error(`unsupported image extension: .${ext}`);
  return { mediaType, dataBase64: readFileSync(abs).toString("base64") };
}

interface CaseOutput {
  tool: string;
  caseId: string;
  model: string;
  outputLanguage: OutputLanguage;
  promptWords: number;
  output: string;
}

/**
 * Build every stage prompt for a case WITHOUT calling any API. Exercises the real
 * interpolation, which throws on any unresolved {{placeholder}} — so a --dry-run
 * validates that a case supplies every required value before you pay to run it.
 * Returns the total prompt word count.
 */
function buildCasePrompts(tool: Tool, c: EvalCase): number {
  const profile: ContextProfile | null = c.profile ? { id: "eval", ...c.profile } : null;
  const values = c.values ?? {};
  const priorOutputs: Record<string, string> = {};
  let words = 0;
  for (const stage of tool.stages) {
    const system = buildSystemPrompt({
      promptId: stage.systemPromptId,
      values,
      profile,
      outputLanguage: c.outputLanguage,
      priorOutputs,
      consumes: stage.consumes,
    });
    words += countWords(system);
    priorOutputs[stage.id] = "(dry-run placeholder output)";
  }
  return words;
}

/** Run one case end-to-end through the tool's real stages, returning the output. */
async function runCase(tool: Tool, c: EvalCase): Promise<CaseOutput> {
  const profile: ContextProfile | null = c.profile ? { id: "eval", ...c.profile } : null;
  const values = c.values ?? {};
  const priorOutputs: Record<string, string> = {};
  let promptWords = 0;
  let finalOutput = "";
  const parts: string[] = [];

  for (const stage of tool.stages) {
    const system = buildSystemPrompt({
      promptId: stage.systemPromptId,
      values,
      profile,
      outputLanguage: c.outputLanguage,
      priorOutputs,
      consumes: stage.consumes,
    });
    promptWords += countWords(system);
    const model = stage.model ?? tool.defaultModel;

    const output =
      tool.mode === "chat"
        ? await runChat(tool, stage, system, c, model)
        : await runOneShot(tool, stage, system, c, model);

    priorOutputs[stage.id] = output;
    finalOutput = output;
    parts.push(tool.stages.length > 1 ? `### Stage: ${stage.id}\n\n${output}` : output);
  }

  return {
    tool: tool.slug,
    caseId: c.id,
    model: tool.stages[0]?.model ?? tool.defaultModel,
    outputLanguage: c.outputLanguage,
    promptWords,
    output: parts.join("\n\n---\n\n") || finalOutput,
  };
}

function stageParams(tool: Tool, stage: ToolStage) {
  return {
    temperature: stage.temperature ?? tool.defaultTemperature,
    maxTokens: stage.maxTokens ?? tool.defaultMaxTokens,
  };
}

async function runOneShot(
  tool: Tool,
  stage: ToolStage,
  system: string,
  c: EvalCase,
  model: string,
): Promise<string> {
  const provider = providerForModel(model);
  const images = c.imagePath ? [loadImage(tool.slug, c.imagePath)] : undefined;
  const { text } = await provider.generate({
    model,
    system,
    messages: [{ role: "user", content: TRIGGER[c.outputLanguage] }],
    images,
    ...stageParams(tool, stage),
  });
  return text;
}

/** Play the scripted student turns; return the full transcript for judging. */
async function runChat(
  tool: Tool,
  stage: ToolStage,
  system: string,
  c: EvalCase,
  model: string,
): Promise<string> {
  const provider = providerForModel(model);
  const turns = c.userTurns?.length ? c.userTurns : [TRIGGER[c.outputLanguage]];
  const history: ChatMessage[] = [];
  const transcript: string[] = [];
  const greeting = tool.chat?.greeting;
  if (greeting) {
    const g = typeof greeting === "string" ? greeting : greeting[c.outputLanguage];
    history.push({ role: "assistant", content: g });
    transcript.push(`**Tutor (greeting):** ${g}`);
  }
  for (const turn of turns) {
    history.push({ role: "user", content: turn });
    transcript.push(`**Student:** ${turn}`);
    const { text } = await provider.generate({
      model,
      system,
      messages: reinforceLanguage(history, c.outputLanguage),
      ...stageParams(tool, stage),
    });
    history.push({ role: "assistant", content: text });
    transcript.push(`**Tutor:** ${text}`);
  }
  return transcript.join("\n\n");
}

function writeOutput(date: string, o: CaseOutput) {
  const dir = join(OUTPUT_DIR, date, o.tool);
  ensureDir(dir);
  const header = `<!-- tool=${o.tool} case=${o.caseId} model=${o.model} lang=${o.outputLanguage} promptWords=${o.promptWords} -->\n\n`;
  writeFileSync(join(dir, `${o.caseId}.md`), header + o.output, "utf8");
}

// ---------------------------------------------------------------------------
// Judge phase — a second model scores the output against the tool's rubric
// ---------------------------------------------------------------------------

const JUDGE_SPINE = `You are a strict but fair evaluator of AI-generated teaching material. Score the OUTPUT against the RUBRIC. Reply with ONLY a JSON object, no prose, in this exact shape:
{"scores": {"taskFidelity": 1-5, "pedagogicalSoundness": 1-5, "formatAdherence": 1-5, "levelFit": 1-5, "languageQuality": 1-5}, "worst": "<the single weakest aspect, one phrase>", "verdict": "<one sentence>"}
Shared criteria (the rubric may add tool-specific ones): taskFidelity = does it do what the tool promises; pedagogicalSoundness = fidelity to the tool's pedagogical theory; formatAdherence = follows the required output structure; levelFit = register matches the case's EQF level; languageQuality = correct target language, no anglicisms in Dutch. Be harsh on fabricated facts. Integer scores 1 (poor) to 5 (excellent).`;

function buildJudgePrompt(rubric: string, c: EvalCase, output: string): string {
  return [
    JUDGE_SPINE,
    `\n# RUBRIC\n${rubric || "(no tool-specific rubric supplied; use the shared criteria only)"}`,
    `\n# CASE\nid: ${c.id}\noutputLanguage: ${c.outputLanguage}\nEQF: ${c.profile?.eqf ?? "n/a"}\ndescription: ${c.description ?? ""}\ninputs: ${JSON.stringify(c.values ?? {}, null, 2)}`,
    `\n# OUTPUT\n${output}`,
  ].join("\n");
}

interface JudgedCase extends ReportRow {
  outputLanguage: OutputLanguage;
  worst: string;
  verdict: string;
}

async function judgeOutput(
  tool: Tool,
  rubric: string,
  c: EvalCase,
  co: CaseOutput,
  judgeModel: string,
): Promise<JudgedCase> {
  const provider = providerForModel(judgeModel);
  const { text } = await provider.generate({
    model: judgeModel,
    system: "You output only valid JSON.",
    messages: [{ role: "user", content: buildJudgePrompt(rubric, c, co.output) }],
    temperature: 0,
    maxTokens: 1024,
  });
  const parsed = parseJudgeResult(text);
  return {
    tool: tool.slug,
    caseId: c.id,
    scores: parsed?.scores ?? {},
    model: co.model,
    promptWords: co.promptWords,
    outputLanguage: co.outputLanguage,
    worst: parsed?.worst ?? "(judge returned no parsable JSON)",
    verdict: parsed?.verdict ?? "",
  };
}

// ---------------------------------------------------------------------------
// Report — deltas come from the most recent prior <date>.scores.json
// ---------------------------------------------------------------------------

function previousAvgByKey(currentDate: string): Record<string, number> {
  if (!existsSync(REPORTS_DIR)) return {};
  const priors = readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith(".scores.json") && f < `${currentDate}.scores.json`)
    .sort();
  const latest = priors.at(-1);
  if (!latest) return {};
  try {
    return JSON.parse(readFileSync(join(REPORTS_DIR, latest), "utf8")) as Record<string, number>;
  } catch {
    return {};
  }
}

function writeReport(date: string, judged: JudgedCase[]) {
  ensureDir(REPORTS_DIR);
  const previous = previousAvgByKey(date);
  const md = buildReportMarkdown({ date, rows: judged, previousAvgByKey: previous });
  // "Worst aspect" appendix helps a human read the table.
  const notes = judged
    .map((j) => `- **${reportRowKey(j)}** (avg ${averageScore(j.scores).toFixed(2)}): ${j.worst}`)
    .join("\n");
  writeFileSync(join(REPORTS_DIR, `${date}.md`), `${md}\n\n## Weakest aspect per case\n\n${notes}\n`, "utf8");
  // Machine-readable avgs → next run's delta source.
  const scores: Record<string, number> = {};
  for (const j of judged) scores[reportRowKey(j)] = averageScore(j.scores);
  writeFileSync(join(REPORTS_DIR, `${date}.scores.json`), `${JSON.stringify(scores, null, 2)}\n`, "utf8");
  console.log(`\nReport written: evals/reports/${date}.md`);
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function readExistingOutput(date: string, toolId: string, caseId: string): CaseOutput | null {
  const path = join(OUTPUT_DIR, date, toolId, `${caseId}.md`);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const meta = /<!-- tool=(\S+) case=(\S+) model=(\S+) lang=(\S+) promptWords=(\d+) -->/.exec(raw);
  const body = raw.replace(/^<!--.*?-->\n\n/, "");
  return {
    tool: toolId,
    caseId,
    model: meta?.[3] ?? "unknown",
    outputLanguage: (meta?.[4] as OutputLanguage) ?? "nl",
    promptWords: meta ? Number(meta[5]) : 0,
    output: body,
  };
}

function latestOutputDate(): string | null {
  if (!existsSync(OUTPUT_DIR)) return null;
  const dates = readdirSync(OUTPUT_DIR).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return dates.at(-1) ?? null;
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  const tools = toolsWithCases(cli.tool);
  if (tools.length === 0) {
    console.error("No tools have an evals/<tool-slug>/cases.json yet. Nothing to run.");
    process.exit(1);
  }

  // --dry-run: validate that every case builds a complete prompt, no API calls.
  if (cli.dryRun) {
    let ok = 0;
    let failed = 0;
    for (const tool of tools) {
      const cases = loadCases(tool);
      console.log(`\n=== ${tool.slug} (${cases.length} cases, mode=${tool.mode}) ===`);
      for (const c of cases) {
        try {
          const words = buildCasePrompts(tool, c);
          console.log(`  · ${c.id} (${c.outputLanguage}) → prompt OK, ${words} words`);
          ok++;
        } catch (err) {
          console.error(`  · ${c.id} → PROMPT ERROR: ${(err as Error).message}`);
          failed++;
        }
      }
    }
    console.log(`\nDry run: ${ok} ok, ${failed} failed. No API calls made.`);
    process.exit(failed ? 1 : 0);
  }

  // Cases phase produces outputs for `today`; judge phase reads either today's
  // fresh outputs or (for --judge-only) the latest existing output date.
  const runDate = cli.judgeOnly ? (latestOutputDate() ?? today()) : today();
  const judged: JudgedCase[] = [];

  for (const tool of tools) {
    const cases = loadCases(tool);
    const rubric = loadRubric(tool);
    console.log(`\n=== ${tool.slug} (${cases.length} cases, mode=${tool.mode}) ===`);

    for (const c of cases) {
      try {
        let co: CaseOutput | null;
        if (cli.judgeOnly) {
          co = readExistingOutput(runDate, tool.slug, c.id);
          if (!co) {
            console.warn(`  · ${c.id}: no existing output to judge — skipped`);
            continue;
          }
        } else {
          console.log(`  · ${c.id} (${c.outputLanguage}) → generating…`);
          co = await runCase(tool, c);
          writeOutput(runDate, co);
        }
        if (cli.casesOnly) continue;

        console.log(`  · ${c.id} → judging (${cli.judgeModel})…`);
        judged.push(await judgeOutput(tool, rubric, c, co, cli.judgeModel));
      } catch (err) {
        console.error(`  · ${c.id}: FAILED — ${(err as Error).message}`);
      }
    }
  }

  if (cli.casesOnly) {
    console.log(`\nOutputs written under evals/output/${runDate}/. (--cases-only: not judged.)`);
    return;
  }
  if (judged.length === 0) {
    console.error("No cases were judged; no report written.");
    process.exit(1);
  }
  writeReport(runDate, judged);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
