import { spawn } from "node:child_process";
import { getModel, type ProviderId } from "../models";
import type { GenerateOptions, LLMProvider } from "../types";

/**
 * Local CLI agents (claude code, opencode, codex, gemini cli) exposed through
 * the portable LLMProvider interface. Each is run headlessly as a subprocess:
 * the assembled prompt is written to stdin and stdout is streamed back.
 *
 * These only work where EduCraft runs on the same machine as the binaries, so
 * they are disabled in production. Per-agent invocation is best-effort for
 * current CLI versions — adjust a single `args` entry below if yours differs.
 */
interface CliSpec {
  command: string;
  args: string[];
}

const AGENTS: Partial<Record<ProviderId, CliSpec>> = {
  "claude-code": { command: "claude", args: ["-p"] },
  opencode: { command: "opencode", args: ["run"] },
  codex: { command: "codex", args: ["exec"] },
  "gemini-cli": { command: "gemini", args: ["-p"] },
};

function specFor(catalogId: string): CliSpec {
  const provider = getModel(catalogId).provider;
  const spec = AGENTS[provider];
  if (!spec) throw new Error(`No CLI agent configured for provider "${provider}".`);
  return spec;
}

/** Combine the system prompt and conversation turns into a single CLI prompt. */
export function assemblePrompt(opts: GenerateOptions): string {
  return [opts.system, ...opts.messages.map((m) => m.content)]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Spawn the agent, stream stdout, and surface spawn/exit failures clearly. */
async function* runCli(catalogId: string, prompt: string): AsyncIterable<string> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("CLI agents run locally only and are disabled in production.");
  }
  const spec = specFor(catalogId);
  const child = spawn(spec.command, spec.args, { stdio: ["pipe", "pipe", "pipe"] });

  const spawnErrors: NodeJS.ErrnoException[] = [];
  child.on("error", (err) => {
    spawnErrors.push(err as NodeJS.ErrnoException);
  });

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  child.stdin?.write(prompt);
  child.stdin?.end();

  if (child.stdout) {
    for await (const chunk of child.stdout) {
      yield (chunk as Buffer).toString();
    }
  }

  const code = await new Promise<number | null>((resolve) => {
    child.on("close", (c) => resolve(c));
  });

  if (spawnErrors.length > 0) {
    const err = spawnErrors[0];
    const hint = err.code === "ENOENT" ? " Is it installed and on your PATH?" : "";
    throw new Error(`CLI "${spec.command}" could not be started (${err.code}).${hint}`);
  }
  if (code !== 0 && code !== null) {
    throw new Error(`CLI "${spec.command}" exited with code ${code}. ${stderr.slice(0, 500)}`.trim());
  }
}

export const cliProvider: LLMProvider = {
  id: "cli",

  async generate(opts) {
    let text = "";
    for await (const chunk of runCli(opts.model, assemblePrompt(opts))) text += chunk;
    return { text };
  },

  async *streamChat(opts) {
    yield* runCli(opts.model, assemblePrompt(opts));
  },
};
