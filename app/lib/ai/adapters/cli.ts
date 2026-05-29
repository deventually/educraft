import { spawn } from "node:child_process";
import { getModel, type ProviderId } from "../models";
import type { GenerateOptions, LLMProvider } from "../types";
import { LocalizedError } from "~/lib/i18n/errors";

/**
 * Local CLI agents (claude code, opencode, codex, gemini cli) exposed through
 * the portable LLMProvider interface. Each is run headlessly as a subprocess
 * with the assembled prompt passed as the final positional argument; stdout is
 * streamed back.
 *
 * These only work where EduCraft runs on the same machine as the binaries, so
 * they are disabled in production. Flags below are the verified headless modes:
 *   claude -p "<prompt>"        (Claude Code non-interactive print)
 *   codex exec "<prompt>"       (Codex non-interactive)
 *   gemini -p "<prompt>"        (Gemini CLI headless)
 *   opencode run "<prompt>"     (opencode one-shot run)
 * The prompt is appended after `args`, so it always arrives as the last arg.
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
    throw new LocalizedError({
      nl: "CLI-agents draaien alleen lokaal en zijn uitgeschakeld in productie.",
      en: "CLI agents run locally only and are disabled in production.",
    });
  }
  const spec = specFor(catalogId);
  // Prompt is the final positional argument (claude -p "…", codex exec "…", …).
  const child = spawn(spec.command, [...spec.args, prompt], { stdio: ["ignore", "pipe", "pipe"] });

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

  if (spawnErrors.length > 0) {
    const err = spawnErrors[0];
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
    let text = "";
    for await (const chunk of runCli(opts.model, assemblePrompt(opts))) text += chunk;
    return { text };
  },

  async *streamChat(opts) {
    yield* runCli(opts.model, assemblePrompt(opts));
  },
};
