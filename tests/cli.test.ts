import { describe, it, expect, vi, afterEach } from "vitest";

// Fake child process whose stdout is an async-iterable of Buffers; stdin is recorded.
function fakeChild(chunks: string[], exitCode: number | null = 0) {
  let written = "";
  return {
    stdin: {
      write: vi.fn((s: string) => {
        written += s;
      }),
      end: vi.fn(),
    },
    get written() {
      return written;
    },
    stderr: { on: vi.fn() },
    stdout: (async function* () {
      for (const c of chunks) yield Buffer.from(c);
    })(),
    on(event: string, cb: (arg?: unknown) => void) {
      if (event === "close") setTimeout(() => cb(exitCode), 0);
      // no "error" in the happy path
    },
  };
}

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({ spawn: (...args: unknown[]) => spawnMock(...args) }));

import { cliProvider, assemblePrompt } from "~/lib/ai/adapters/cli";

const base = {
  model: "codex",
  system: "SYSTEM INSTRUCTIONS",
  messages: [{ role: "user" as const, content: "trigger" }],
};

/** What `claude -p --output-format json` prints at the end of a run. */
function claudeJson(result: string, stopReason = "end_turn", isError = false) {
  return JSON.stringify({
    type: "result",
    is_error: isError,
    result,
    stop_reason: stopReason,
    duration_ms: 4200,
    duration_api_ms: 3100,
    usage: {
      input_tokens: 10,
      cache_read_input_tokens: 2,
      cache_creation_input_tokens: 3,
      output_tokens: 40,
      output_tokens_details: { thinking_tokens: 5 },
    },
  });
}

afterEach(() => {
  spawnMock.mockReset();
  delete process.env.NODE_ENV;
});

describe("assemblePrompt", () => {
  it("joins system + turns, dropping empties", () => {
    expect(assemblePrompt(base)).toBe("SYSTEM INSTRUCTIONS\n\ntrigger");
  });
});

describe("cliProvider", () => {
  it("spawns the agent binary with the prompt as the final arg and streams stdout", async () => {
    spawnMock.mockReturnValue(fakeChild(["Hel", "lo"]));
    const out: string[] = [];
    for await (const c of cliProvider.streamChat(base)) out.push(c);
    expect(out.join("")).toBe("Hello");
    expect(spawnMock).toHaveBeenCalledWith(
      "codex",
      ["exec", "SYSTEM INSTRUCTIONS\n\ntrigger"],
      expect.anything(),
    );
  });

  it("passes the abort signal to spawn, so a closed tab kills the agent", async () => {
    spawnMock.mockReturnValue(fakeChild(["x"]));
    const signal = new AbortController().signal;
    for await (const _ of cliProvider.streamChat({ ...base, signal })) void _;
    expect(spawnMock.mock.calls.at(-1)?.[2].signal).toBe(signal);
  });

  it("passes the abort signal to spawn for generate() too", async () => {
    spawnMock.mockReturnValue(fakeChild(["x"]));
    const signal = new AbortController().signal;
    await cliProvider.generate({ ...base, signal });
    expect(spawnMock.mock.calls.at(-1)?.[2].signal).toBe(signal);
  });

  it("generate() collects the full output", async () => {
    spawnMock.mockReturnValue(fakeChild(["one ", "two"]));
    const r = await cliProvider.generate(base);
    expect(r.text).toBe("one two");
  });

  it("throws on a non-zero exit code", async () => {
    spawnMock.mockReturnValue(fakeChild(["partial"], 1));
    await expect(async () => {
      for await (const _ of cliProvider.streamChat(base)) void _;
    }).rejects.toThrow(/exited with code 1/);
  });

  it("is disabled in production", async () => {
    process.env.NODE_ENV = "production";
    await expect(async () => {
      for await (const _ of cliProvider.streamChat(base)) void _;
    }).rejects.toThrow(/locally only/);
  });
});

describe("Claude Code: the request the app would send, not Claude Code's own setup", () => {
  const cc = { ...base, model: "claude-code::claude-sonnet-5-5" };
  const args = () => spawnMock.mock.calls.at(-1)?.[1] as string[];
  const options = () => spawnMock.mock.calls.at(-1)?.[2];

  it("replaces Claude Code's system prompt with ours and switches off its tools, settings and MCP", async () => {
    spawnMock.mockReturnValue(fakeChild(["Hallo"]));
    for await (const _ of cliProvider.streamChat(cc)) void _;
    expect(spawnMock.mock.calls.at(-1)?.[0]).toBe("claude");
    const a = args();
    expect(a[0]).toBe("-p");
    expect(a[a.indexOf("--system-prompt") + 1]).toBe("SYSTEM INSTRUCTIONS");
    expect(a).toContain("--tools=");
    // No CLAUDE.md, skills or hooks of the folder it runs in.
    expect(a[a.indexOf("--setting-sources") + 1]).toBe("");
    expect(a).toContain("--strict-mcp-config");
    expect(a).toContain("--disable-slash-commands");
    expect(a).toContain("--no-session-persistence");
  });

  it("pins the model after :: and its effort from the catalog", async () => {
    spawnMock.mockReturnValue(fakeChild(["x"]));
    for await (const _ of cliProvider.streamChat(cc)) void _;
    const a = args();
    expect(a[a.indexOf("--model") + 1]).toBe("claude-sonnet-5-5");
    expect(a[a.indexOf("--effort") + 1]).toBe("medium");
  });

  it("leaves the model to Claude Code for the plain claude-code entry", async () => {
    spawnMock.mockReturnValue(fakeChild(["x"]));
    for await (const _ of cliProvider.streamChat({ ...cc, model: "claude-code" })) void _;
    expect(args()).not.toContain("--model");
    expect(args()).not.toContain("--effort");
  });

  it("sends the conversation on stdin, not as an argument, with the roles of earlier turns", async () => {
    const child = fakeChild(["x"]);
    spawnMock.mockReturnValue(child);
    const messages = [
      { role: "assistant" as const, content: "Waar werk je aan?" },
      { role: "user" as const, content: "Mijn verslag." },
    ];
    for await (const _ of cliProvider.streamChat({ ...cc, messages })) void _;
    expect(args().join(" ")).not.toContain("Mijn verslag.");
    expect(child.written).toContain("Assistant: Waar werk je aan?");
    expect(child.written.trim().endsWith("Mijn verslag.")).toBe(true);
    expect(child.stdin.end).toHaveBeenCalled();
  });

  it("sends a single turn as itself", async () => {
    const child = fakeChild(["x"]);
    spawnMock.mockReturnValue(child);
    for await (const _ of cliProvider.streamChat(cc)) void _;
    expect(child.written).toBe("trigger");
  });

  it("caps the answer at the tool's budget plus thinking room, as the API call does", async () => {
    spawnMock.mockReturnValue(fakeChild(["x"]));
    for await (const _ of cliProvider.streamChat({ ...cc, maxTokens: 4000 })) void _;
    const budget = Number(options().env.CLAUDE_CODE_MAX_OUTPUT_TOKENS);
    expect(budget).toBeGreaterThan(4000);
  });

  it("generate() reads the JSON result: text, usage, and a cut-off answer as finishReason length", async () => {
    spawnMock.mockReturnValue(fakeChild([claudeJson("Een lesplan", "max_tokens")]));
    const r = await cliProvider.generate(cc);
    expect(args()[args().indexOf("--output-format") + 1]).toBe("json");
    expect(r.text).toBe("Een lesplan");
    expect(r.finishReason).toBe("length");
    expect(r.usage).toEqual({ input: 10, cacheRead: 2, cacheWrite: 3, output: 40, reasoning: 5 });
  });

  it("generate() reports the time of the model call itself, without the CLI starting up", async () => {
    spawnMock.mockReturnValue(fakeChild([claudeJson("Klaar")]));
    expect((await cliProvider.generate(cc)).apiMs).toBe(3100);
  });

  it("generate() reports a normal end as stop", async () => {
    spawnMock.mockReturnValue(fakeChild([claudeJson("Klaar")]));
    expect((await cliProvider.generate(cc)).finishReason).toBe("stop");
  });

  it("generate() throws when Claude Code reports an error", async () => {
    spawnMock.mockReturnValue(fakeChild([claudeJson("Usage limit reached", "end_turn", true)]));
    await expect(cliProvider.generate(cc)).rejects.toThrow(/Usage limit reached/);
  });

  it("streamChat() streams plain text", async () => {
    spawnMock.mockReturnValue(fakeChild(["Hal", "lo"]));
    const out: string[] = [];
    for await (const c of cliProvider.streamChat(cc)) out.push(c);
    expect(out.join("")).toBe("Hallo");
    expect(args()[args().indexOf("--output-format") + 1]).toBe("text");
  });
});
