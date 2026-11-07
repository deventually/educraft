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
 *    npm run eval -- --tool mentorai --runs 3 # mean + spread over 3 runs per case
 *    npm run eval -- --tool a,b --label d     # several tools, report <date>d.md
 *    npm run eval -- --tool x --batch         # half price via the Message Batches API
 *    npm run eval -- --tool x --model gpt-6.1-sol --label gpt  # another model answers,
 *                                             # the same (Claude) judge scores
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
import type { LLMProvider } from "~/lib/ai/types";
import { env } from "~/server/env.server";
import { anthropicSubmit, createBatchingProvider } from "./eval-batch";
import {
  parseJudgeResult,
  evalGreeting,
  scoresForNextRun,
  unjudgeableReason,
  judgeFileName,
  judgeRecord,
  applyHardChecks,
  hardChecksInstruction,
  meanScores,
  parseHardChecks,
  runSpread,
  capTruncated,
  batchableModel,
  caseValues,
  countedFailures,
  generationModel,
  JUDGE_MAX_TOKENS,
  TRUNCATION_CAP,
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
  /** Runs per case; the report shows the mean and the spread (default 1). */
  runs: number;
  /** Suffix for a second report on the same day: `--label d` → `<date>d.md`. */
  label: string;
  /** Send one-shot generations and all judging through the Message Batches API (half price). */
  batch: boolean;
  /** Generate with this model instead of the tool's own (`--model`); the judge stays. */
  model?: string;
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
    runs: 1,
    label: "",
    batch: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tool") cli.tool = argv[++i];
    else if (a === "--cases-only") cli.casesOnly = true;
    else if (a === "--judge-only") cli.judgeOnly = true;
    else if (a === "--dry-run") cli.dryRun = true;
    else if (a === "--batch") cli.batch = true;
    else if (a === "--model") cli.model = argv[++i];
    else if (a === "--judge-model") cli.judgeModel = argv[++i] ?? DEFAULT_JUDGE_MODEL;
    else if (a === "--label") cli.label = (argv[++i] ?? "").replace(/[^a-z0-9-]/gi, "");
    else if (a === "--runs") cli.runs = Math.max(1, Math.min(10, Number(argv[++i]) || 1));
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
/** `--tool a,b` runs several tools into one report. */
function toolsWithCases(only?: string): Tool[] {
  const slugs = only ? only.split(",").map((s) => s.trim()).filter(Boolean) : [];
  for (const slug of slugs) if (!getToolBySlug(slug)) throw new Error(`Unknown tool slug: ${slug}`);
  const wanted = slugs.length ? ALL_TOOLS.filter((t) => slugs.includes(t.slug)) : ALL_TOOLS;
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

/**
 * With `--batch`, one-shot stages and the judge go through one batching provider, so
 * concurrent calls share a batch. Chat tools keep the direct provider: every turn waits
 * on the previous one, and a batch per turn would take hours.
 */
let batchProvider: LLMProvider | null = null;
function oneShotProvider(model: string): LLMProvider {
  return batchProvider && batchableModel(model) ? batchProvider : providerForModel(model);
}

/** `--model`: every stage of every case is generated by this model instead. */
let modelOverride: string | undefined;

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
  /** A model answer hit maxTokens (finishReason "length"): the output is cut off. */
  truncated?: boolean;
}

/**
 * Build every stage prompt for a case WITHOUT calling any API. Exercises the real
 * interpolation, which throws on any unresolved {{placeholder}} — so a --dry-run
 * validates that a case supplies every required value before you pay to run it.
 * Returns the total prompt word count.
 */
function buildCasePrompts(tool: Tool, c: EvalCase): number {
  const profile: ContextProfile | null = c.profile ? { id: "eval", ...c.profile } : null;
  const values = caseValues(tool, c.values);
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
  const values = caseValues(tool, c.values);
  const priorOutputs: Record<string, string> = {};
  let promptWords = 0;
  let finalOutput = "";
  let truncated = false;
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
    const model = generationModel(tool, stage, modelOverride);

    const run =
      tool.mode === "chat"
        ? await runChat(tool, stage, system, c, model)
        : await runOneShot(tool, stage, system, c, model);
    const output = run.text;
    if (run.truncated) truncated = true;

    priorOutputs[stage.id] = output;
    finalOutput = output;
    parts.push(tool.stages.length > 1 ? `### Stage: ${stage.id}\n\n${output}` : output);
  }

  return {
    tool: tool.slug,
    caseId: c.id,
    model: tool.stages[0] ? generationModel(tool, tool.stages[0], modelOverride) : tool.defaultModel,
    outputLanguage: c.outputLanguage,
    promptWords,
    output: parts.join("\n\n---\n\n") || finalOutput,
    truncated,
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
): Promise<{ text: string; truncated: boolean }> {
  const provider = oneShotProvider(model);
  const images = c.imagePath ? [loadImage(tool.slug, c.imagePath)] : undefined;
  const { text, finishReason } = await provider.generate({
    model,
    system,
    messages: [{ role: "user", content: TRIGGER[c.outputLanguage] }],
    images,
    ...stageParams(tool, stage),
  });
  return { text, truncated: finishReason === "length" };
}

/** Play the scripted student turns; return the full transcript for judging. */
async function runChat(
  tool: Tool,
  stage: ToolStage,
  system: string,
  c: EvalCase,
  model: string,
): Promise<{ text: string; truncated: boolean }> {
  const provider = providerForModel(model);
  let truncated = false;
  const turns = c.userTurns?.length ? c.userTurns : [TRIGGER[c.outputLanguage]];
  const history: ChatMessage[] = [];
  const transcript: string[] = [];
  const g = evalGreeting(tool, c);
  if (g) {
    history.push({ role: "assistant", content: g });
    transcript.push(`**Tutor (greeting):** ${g}`);
  }
  for (const turn of turns) {
    history.push({ role: "user", content: turn });
    transcript.push(`**Student:** ${turn}`);
    const { text, finishReason } = await provider.generate({
      model,
      system,
      messages: reinforceLanguage(history, c.outputLanguage),
      ...stageParams(tool, stage),
    });
    if (finishReason === "length") truncated = true;
    history.push({ role: "assistant", content: text });
    transcript.push(`**Tutor:** ${text}`);
  }
  return { text: transcript.join("\n\n"), truncated };
}

/** Run 1 keeps the old name, so a single-run measurement looks as before. */
function outputFileName(caseId: string, run: number): string {
  return run === 1 ? `${caseId}.md` : `${caseId}.run${run}.md`;
}

function writeOutput(date: string, o: CaseOutput, run = 1) {
  const dir = join(OUTPUT_DIR, date, o.tool);
  ensureDir(dir);
  const header = `<!-- tool=${o.tool} case=${o.caseId} model=${o.model} lang=${o.outputLanguage} promptWords=${o.promptWords}${o.truncated ? " truncated=1" : ""} -->\n\n`;
  writeFileSync(join(dir, outputFileName(o.caseId, run)), header + o.output, "utf8");
}

// ---------------------------------------------------------------------------
// Judge phase — a second model scores the output against the tool's rubric
// ---------------------------------------------------------------------------

const JUDGE_SPINE = `You are a strict but fair evaluator of AI-generated teaching material. Score the OUTPUT against the RUBRIC. Reply with ONLY a JSON object, no prose, in this exact shape:
{"scores": {"taskFidelity": 1-5, "pedagogicalSoundness": 1-5, "formatAdherence": 1-5, "levelFit": 1-5, "languageQuality": 1-5}, "checks": {"<hard check id>": true|false}, "worst": "<the single weakest aspect, one phrase>", "verdict": "<one sentence>"}
Shared criteria (the rubric may add tool-specific ones): taskFidelity = does it do what the tool promises; pedagogicalSoundness = fidelity to the tool's pedagogical theory; formatAdherence = follows the required output structure; levelFit = register matches the case's EQF level; languageQuality = correct target language, no anglicisms in Dutch. Be harsh on fabricated facts. Integer scores 1 (poor) to 5 (excellent). A 5 means you found nothing to improve after looking for problems; reserve it for that. Leave "checks" empty ({}) when the rubric has no hard checks.`;

function buildJudgePrompt(rubric: string, c: EvalCase, output: string): string {
  const checks = hardChecksInstruction(parseHardChecks(rubric));
  return [
    JUDGE_SPINE,
    `\n# RUBRIC\n${rubric || "(no tool-specific rubric supplied; use the shared criteria only)"}`,
    ...(checks ? [`\n# HARD CHECKS\n${checks}`] : []),
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
  const provider = oneShotProvider(judgeModel);
  const ask = async (maxTokens: number) =>
    parseJudgeResult(
      (
        await provider.generate({
          model: judgeModel,
          system: "You output only valid JSON.",
          messages: [{ role: "user", content: buildJudgePrompt(rubric, c, co.output) }],
          temperature: 0,
          maxTokens,
        })
      ).text,
    );
  // One retry with more room (JUDGE_MAX_TOKENS): a verdict cut off mid-JSON leaves a run un-scored.
  const parsed = (await ask(JUDGE_MAX_TOKENS[0])) ?? (await ask(JUDGE_MAX_TOKENS[1]));
  const checks = parseHardChecks(rubric);
  const judged = new Set(checks.filter((c) => !c.counted).map((c) => c.id));
  const failedChecks = [
    ...(parsed?.failedChecks ?? []).filter((id) => judged.has(id)),
    ...countedFailures(checks, co.output),
  ];
  return {
    tool: tool.slug,
    caseId: c.id,
    // A failed hard check caps the scores in code, so a lenient scale cannot hide it.
    scores: parsed ? applyHardChecks(parsed.scores, failedChecks, checks) : {},
    failedChecks,
    model: co.model,
    promptWords: co.promptWords,
    outputLanguage: co.outputLanguage,
    worst: parsed?.worst ?? "(judge returned no parsable JSON)",
    verdict: parsed?.verdict ?? "",
  };
}

/** A case whose output could not be judged: no scores, the reason as its weakest aspect. */
function notJudged(tool: Tool, c: EvalCase, co: CaseOutput, reason: string): JudgedCase {
  return {
    tool: tool.slug,
    caseId: c.id,
    scores: {},
    model: co.model,
    promptWords: co.promptWords,
    outputLanguage: co.outputLanguage,
    worst: `NOT JUDGED: ${reason}${co.truncated ? " (the model hit the token limit)" : ""}`,
    verdict: "",
  };
}

/**
 * One report row for a case from its runs: per-criterion means, the spread of the
 * run averages, every hard check that failed in any run, and the weakest aspect of
 * the lowest-scoring run. A run that was not judged counts toward `runs` but not
 * toward the mean, and its reason is kept in the notes.
 */
function combineRuns(runs: JudgedCase[]): JudgedCase | null {
  const first = runs[0];
  if (!first) return null;
  if (runs.length === 1) return first;
  const scored = runs.filter((r) => Object.keys(r.scores).length > 0);
  const lowest = [...scored].sort((a, b) => averageScore(a.scores) - averageScore(b.scores))[0];
  const notJudgedNotes = runs.filter((r) => Object.keys(r.scores).length === 0).map((r) => r.worst);
  return {
    ...first,
    scores: meanScores(runs.map((r) => r.scores)),
    runs: runs.length,
    notJudgedRuns: runs.length - scored.length || undefined,
    spread: runSpread(runs.map((r) => r.scores)),
    failedChecks: [...new Set(runs.flatMap((r) => r.failedChecks ?? []))],
    worst: [lowest?.worst, ...notJudgedNotes].filter(Boolean).join(" | "),
    verdict: lowest?.verdict ?? "",
  };
}

// ---------------------------------------------------------------------------
// Report — deltas come from the most recent prior <date>.scores.json
// ---------------------------------------------------------------------------

/**
 * The most recent prior avg per key: a later report overrides an earlier one key by
 * key, so a report that ran only some tools does not hide the others' last score.
 */
function previousAvgByKey(currentDate: string): Record<string, number> {
  if (!existsSync(REPORTS_DIR)) return {};
  const priors = readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith(".scores.json") && f < `${currentDate}.scores.json`)
    .sort();
  const merged: Record<string, number> = {};
  for (const file of priors) {
    try {
      Object.assign(merged, JSON.parse(readFileSync(join(REPORTS_DIR, file), "utf8")) as Record<string, number>);
    } catch {
      // A corrupt prior report only loses its deltas.
    }
  }
  return merged;
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
  const scores = scoresForNextRun(judged);
  writeFileSync(join(REPORTS_DIR, `${date}.scores.json`), `${JSON.stringify(scores, null, 2)}\n`, "utf8");
  console.log(`\nReport written: evals/reports/${date}.md`);
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function readExistingOutput(date: string, toolId: string, caseId: string, run = 1): CaseOutput | null {
  const path = join(OUTPUT_DIR, date, toolId, outputFileName(caseId, run));
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
    truncated: / truncated=1 -->/.test(raw),
  };
}

function latestOutputDate(): string | null {
  if (!existsSync(OUTPUT_DIR)) return null;
  const dates = readdirSync(OUTPUT_DIR).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return dates.at(-1) ?? null;
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  modelOverride = cli.model;
  if (modelOverride) {
    // Fails on an unknown id before any case runs (and before anything is paid).
    const first = toolsWithCases(cli.tool)[0];
    if (first?.stages[0]) generationModel(first, first.stages[0], modelOverride);
    console.log(`Generating with ${modelOverride}; judging with ${cli.judgeModel}.`);
  }
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

  if (cli.batch) {
    if (!env.ANTHROPIC_API_KEY) throw new Error("--batch needs ANTHROPIC_API_KEY in .env.");
    batchProvider = createBatchingProvider(anthropicSubmit(env.ANTHROPIC_API_KEY));
    console.log("Batch mode: one-shot stages and judging go through the Message Batches API (half price).");
  }

  /** One run of one case: generate (or read) the output, then judge it. */
  const oneRun = async (tool: Tool, rubric: string, c: EvalCase, run: number): Promise<JudgedCase | null> => {
    const tag = cli.runs > 1 ? `${c.id} [run ${run}/${cli.runs}]` : c.id;
    try {
      let co: CaseOutput | null;
      if (cli.judgeOnly) {
        co = readExistingOutput(runDate, tool.slug, c.id, run);
        if (!co) {
          console.warn(`  · ${tag}: no existing output to judge — skipped`);
          return null;
        }
      } else {
        console.log(`  · ${tag} (${c.outputLanguage}) → generating…`);
        co = await runCase(tool, c);
        writeOutput(runDate, co, run);
      }
      if (cli.casesOnly) return null;

      const refused = unjudgeableReason(co.output);
      if (refused) {
        console.warn(`  · ${tag}: NOT JUDGED — ${refused}`);
        return notJudged(tool, c, co, refused);
      }
      console.log(`  · ${tag} → judging (${cli.judgeModel})…`);
      const j = await judgeOutput(tool, rubric, c, co, cli.judgeModel);
      if (co.truncated) {
        j.scores = capTruncated(j.scores);
        j.worst = `⚠️ output hit the token limit (cut off; scores capped at ${TRUNCATION_CAP}). ${j.worst}`;
      }
      if (j.failedChecks?.length) j.worst = `HARD CHECK FAILED: ${j.failedChecks.join(", ")}. ${j.worst}`;
      writeFileSync(join(OUTPUT_DIR, runDate, tool.slug, judgeFileName(c.id, run)), judgeRecord(j), "utf8");
      return j;
    } catch (err) {
      console.error(`  · ${tag}: FAILED — ${(err as Error).message}`);
      return null;
    }
  };

  const work: { tool: Tool; rubric: string; c: EvalCase }[] = [];
  for (const tool of tools) {
    const cases = loadCases(tool);
    console.log(`\n=== ${tool.slug} (${cases.length} cases, mode=${tool.mode}) ===`);
    const rubric = loadRubric(tool);
    for (const c of cases) work.push({ tool, rubric, c });
  }
  const runNumbers = Array.from({ length: cli.runs }, (_, i) => i + 1);
  // Sequential by default; with --batch every case and run at once, so they share batches.
  const perCase: (JudgedCase | null)[][] = [];
  if (cli.batch) {
    perCase.push(
      ...(await Promise.all(
        work.map((w) => Promise.all(runNumbers.map((run) => oneRun(w.tool, w.rubric, w.c, run)))),
      )),
    );
  } else {
    for (const w of work) {
      const runs: (JudgedCase | null)[] = [];
      for (const run of runNumbers) runs.push(await oneRun(w.tool, w.rubric, w.c, run));
      perCase.push(runs);
    }
  }
  for (const runs of perCase) {
    const combined = combineRuns(runs.filter((r): r is JudgedCase => r !== null));
    if (combined) judged.push(combined);
  }

  if (cli.casesOnly) {
    console.log(`\nOutputs written under evals/output/${runDate}/. (--cases-only: not judged.)`);
    return;
  }
  if (judged.length === 0) {
    console.error("No cases were judged; no report written.");
    process.exit(1);
  }
  writeReport(`${runDate}${cli.label}`, judged);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
