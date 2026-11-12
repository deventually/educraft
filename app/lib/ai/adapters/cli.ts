import { spawn } from "node:child_process";
import {
  isResolvableModel,
  outputTokenBudget,
  resolveModelInfo,
  type ModelInfo,
  type ProviderId,
} from "../models";
import type { GenerateOptions, GenerateResult, LLMProvider, TokenUsage } from "../types";
import { LocalizedError } from "~/lib/i18n/errors";

/**
 * Local CLI agents (claude code, opencode, codex, gemini cli) exposed through
 * the portable LLMProvider interface. Each is run headlessly as a subprocess and
 * its stdout is streamed back.
 *
 * These only work where LimeOnIt runs on the same machine as the binaries, so
 * they are disabled in production. Flags below are the verified headless modes:
 *   claude -p                   (Claude Code non-interactive print; prompt on stdin)
 *   codex exec "<prompt>"       (Codex non-interactive)
 *   gemini -p "<prompt>"        (Gemini CLI headless)
 *   opencode run "<prompt>"     (opencode one-shot run)
 */

/** One run of an agent: its arguments, what goes on stdin, extra environment. */
interface Invocation {
  args: string[];
  stdin?: string;
  env?: Record<string, string>;
}

interface CliSpec {
  command: string;
  /** `json`: generate() asks for the agent's JSON result, to read why it stopped. */
  invoke(opts: GenerateOptions, info: ModelInfo, json: boolean): Invocation;
  /** Reads the JSON result; only for an agent whose invoke honours `json`. */
  parse?(stdout: string): GenerateResult;
}

/** The prompt as the final positional argument (codex exec "…", gemini -p "…"). */
function positional(command: string, args: string[]): CliSpec {
  return { command, invoke: (opts) => ({ args: [...args, assemblePrompt(opts)] }) };
}

const AGENTS: Partial<Record<ProviderId, CliSpec>> = {
  "claude-code": { command: "claude", invoke: claudeCodeInvocation, parse: parseClaudeCodeResult },
  opencode: positional("opencode", ["run"]),
  codex: positional("codex", ["exec"]),
  "gemini-cli": positional("gemini", ["-p"]),
};

function specFor(info: ModelInfo): CliSpec {
  const spec = AGENTS[info.provider];
  if (!spec) throw new Error(`No CLI agent configured for provider "${info.provider}".`);
  return spec;
}

/** Combine the system prompt and conversation turns into a single CLI prompt. */
export function assemblePrompt(opts: GenerateOptions): string {
  return [opts.system, ...opts.messages.map((m) => m.content)]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join("\n\n");
}

// ── Claude Code ───────────────────────────────────────────────────────────────────
// Run as the app's own request, not as Claude Code: our system prompt replaces its own,
// no tools, no CLAUDE.md, skills, hooks or MCP from the folder it runs in. With
// "claude-code::<model>" it is pinned to that model, with that model's effort and answer
// budget from the catalog, so the eval measures the app's prompts on the app's model.

/** The catalog model "claude-code::<model>" pins, when the catalog knows it. */
function pinnedModel(info: ModelInfo): ModelInfo | null {
  if (info.apiId === "claude-code" || !isResolvableModel(info.apiId)) return null;
  const target = resolveModelInfo(info.apiId);
  return target.provider === "anthropic" ? target : null;
}

/** The conversation for stdin: one turn as itself, a longer one with the roles named. */
function conversation(opts: GenerateOptions): string {
  if (opts.messages.length === 1) return opts.messages[0]?.content ?? "";
  return opts.messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

function claudeCodeInvocation(opts: GenerateOptions, info: ModelInfo, json: boolean): Invocation {
  const pinned = pinnedModel(info);
  const effort = pinned?.settings?.effort;
  const args = [
    "-p",
    "--output-format",
    json ? "json" : "text",
    "--system-prompt",
    opts.system,
    "--tools=",
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--no-session-persistence",
    ...(info.apiId === "claude-code" ? [] : ["--model", info.apiId]),
    ...(effort && effort !== "none" ? ["--effort", effort] : []),
  ];
  const maxTokens = opts.maxTokens ?? pinned?.settings?.maxTokens;
  const env = maxTokens
    ? { CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(outputTokenBudget(pinned ?? info, maxTokens)) }
    : undefined;
  return { args, stdin: conversation(opts), env };
}

interface ClaudeCodeResult {
  is_error?: boolean;
  result?: string;
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    output_tokens?: number;
    output_tokens_details?: { thinking_tokens?: number };
  };
}

function usageOf(u: ClaudeCodeResult["usage"]): TokenUsage | undefined {
  if (!u) return undefined;
  return {
    input: u.input_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
    output: u.output_tokens ?? 0,
    reasoning: u.output_tokens_details?.thinking_tokens ?? 0,
  };
}

function parseClaudeCodeResult(stdout: string): GenerateResult {
  const r = JSON.parse(stdout) as ClaudeCodeResult;
  if (r.is_error) {
    throw new LocalizedError({
      nl: `Claude Code gaf een fout: ${r.result ?? "onbekend"}`,
      en: `Claude Code reported an error: ${r.result ?? "unknown"}`,
    });
  }
  return {
    text: r.result ?? "",
    usage: usageOf(r.usage),
    finishReason: r.stop_reason === "max_tokens" ? "length" : "stop",
  };
}

// ── Running an agent ──────────────────────────────────────────────────────────────

/** Spawn the agent, stream stdout, and surface spawn/exit failures clearly. */
async function* runCli(
  spec: CliSpec,
  run: Invocation,
  signal?: AbortSignal,
): AsyncIterable<string> {
  if (process.env.NODE_ENV === "production") {
    throw new LocalizedError({
      nl: "CLI-agents draaien alleen lokaal en zijn uitgeschakeld in productie.",
      en: "CLI agents run locally only and are disabled in production.",
    });
  }
  const child = spawn(spec.command, run.args, {
    stdio: [run.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    signal,
    ...(run.env ? { env: { ...process.env, ...run.env } } : {}),
  });
  if (run.stdin !== undefined) {
    child.stdin?.write(run.stdin);
    child.stdin?.end();
  }

  const spawnErrors: NodeJS.ErrnoException[] = [];
  child.on("error", (err) => {
    spawnErrors.push(err as NodeJS.ErrnoException);
  });

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  if (child.stdout) {
    for await (const chunk of child.stdout) {
      yield (chunk as Buffer).toString();
    }
  }

  const code = await new Promise<number | null>((resolve) => {
    child.on("close", (c) => resolve(c));
  });

  const [err] = spawnErrors;
  if (err) {
    if (err.code === "ENOENT") {
      throw new LocalizedError({
        nl: `CLI "${spec.command}" kon niet worden gestart. Is deze geïnstalleerd en beschikbaar in je PATH?`,
        en: `CLI "${spec.command}" could not be started. Is it installed and on your PATH?`,
      });
    }
    throw new LocalizedError({
      nl: `CLI "${spec.command}" kon niet worden gestart (${err.code}).`,
      en: `CLI "${spec.command}" could not be started (${err.code}).`,
    });
  }
  if (code !== 0 && code !== null) {
    const detail = stderr.slice(0, 500).trim();
    throw new LocalizedError({
      nl: `CLI "${spec.command}" eindigde met code ${code}. ${detail}`.trim(),
      en: `CLI "${spec.command}" exited with code ${code}. ${detail}`.trim(),
    });
  }
}

export const cliProvider: LLMProvider = {
  id: "cli",

  async generate(opts) {
    const info = resolveModelInfo(opts.model);
    const spec = specFor(info);
    const json = spec.parse !== undefined;
    let text = "";
    for await (const chunk of runCli(spec, spec.invoke(opts, info, json), opts.signal))
      text += chunk;
    return spec.parse ? spec.parse(text) : { text };
  },

  async *streamChat(opts) {
    const info = resolveModelInfo(opts.model);
    const spec = specFor(info);
    yield* runCli(spec, spec.invoke(opts, info, false), opts.signal);
  },
};
