import { describe, it, expect, vi, afterEach } from "vitest";

// Fake child process whose stdout is an async-iterable of Buffers.
function fakeChild(chunks: string[], exitCode: number | null = 0) {
  return {
    stdin: { write: vi.fn(), end: vi.fn() },
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
  model: "claude-code",
  system: "SYSTEM INSTRUCTIONS",
  messages: [{ role: "user" as const, content: "trigger" }],
};

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
  it("spawns the agent binary and streams stdout", async () => {
    spawnMock.mockReturnValue(fakeChild(["Hel", "lo"]));
    const out: string[] = [];
    for await (const c of cliProvider.streamChat(base)) out.push(c);
    expect(out.join("")).toBe("Hello");
    expect(spawnMock).toHaveBeenCalledWith("claude", ["-p"], expect.anything());
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
