import { describe, expect, it } from "vitest";
import { ALL_TOOLS, WORKPLACE_TOOLS, getToolBySlugOrThrow } from "~/lib/registry";
import { modeOf } from "~/lib/registry/modes";

/**
 * One strategy per way a tool runs: a conversation, chained stages, or one generation.
 * Everything that differs between them lives here, so no route or component branches on
 * `tool.mode` (BESLUIT: deep modules, AGENTS.md principle 4).
 */
const chat = getToolBySlugOrThrow("socratic-partner");
const reminded = getToolBySlugOrThrow("defend-your-work");
const multiStage = getToolBySlugOrThrow("cognitive-architect");
const oneShot = getToolBySlugOrThrow("authentic-assessment");

describe("modeOf: the kind of workspace", () => {
  it("tells a chat, chained stages and a single generation apart", () => {
    expect(modeOf(chat).kind).toBe("chat");
    expect(modeOf(multiStage).kind).toBe("multiStage");
    expect(modeOf(oneShot).kind).toBe("oneShot");
  });

  it("gives every registered tool a strategy", () => {
    for (const tool of [...ALL_TOOLS, ...WORKPLACE_TOOLS]) {
      const { kind } = modeOf(tool);
      expect(kind).toBe(
        tool.mode === "chat" ? "chat" : tool.stages.length > 1 ? "multiStage" : "oneShot",
      );
    }
  });

  it("lets only a chat fill the page height (its composer pins)", () => {
    expect(modeOf(chat).fillsHeight).toBe(true);
    expect(modeOf(multiStage).fillsHeight).toBe(false);
    expect(modeOf(oneShot).fillsHeight).toBe(false);
  });

  it("never shares a conversation with a colleague (BESLUIT-2026-11-05-5)", () => {
    expect(modeOf(chat).sharesWork).toBe(false);
    expect(modeOf(multiStage).sharesWork).toBe(true);
    expect(modeOf(oneShot).sharesWork).toBe(true);
  });
});

describe("modeOf: the turns the model answers", () => {
  const history = [
    { role: "user" as const, content: "eerste" },
    { role: "assistant" as const, content: "antwoord" },
    { role: "user" as const, content: "laatste" },
  ];

  it("a generation gets one trigger in the output language, whatever the body says", () => {
    expect(modeOf(oneShot).turns(history, "nl")).toEqual([
      { role: "user", content: "Voer de opdracht volledig uit." },
    ]);
    expect(modeOf(multiStage).turns(undefined, "en")).toEqual([
      { role: "user", content: "Carry out the task in full." },
    ]);
  });

  it("a chat keeps its history, and opens with the trigger when there is none", () => {
    expect(modeOf(chat).turns(history, "nl")).toBe(history);
    expect(modeOf(chat).turns(undefined, "nl")).toEqual([
      { role: "user", content: "Voer de opdracht volledig uit." },
    ]);
  });

  it("a chat repeats the language (and its own reminder) on the last turn only", () => {
    const sent = modeOf(reminded).promptTurns(history, "en");
    expect(sent[0]).toEqual(history[0]);
    expect(sent[2]!.content).toContain("laatste");
    expect(sent[2]!.content).toContain("always respond entirely in English");
    expect(history[2]!.content).toBe("laatste"); // the saved transcript stays untouched
  });

  it("a generation sends its turns as they are", () => {
    const turns = modeOf(oneShot).turns(undefined, "en");
    expect(modeOf(oneShot).promptTurns(turns, "en")).toBe(turns);
  });
});

describe("modeOf: where the work is kept", () => {
  it("a chat keeps one row per conversation, keyed by its session id", () => {
    expect(modeOf(chat).sessionId("  session-abcdefgh  ")).toBe("session-abcdefgh");
  });

  it("refuses a session id that is missing or out of bounds", () => {
    expect(modeOf(chat).sessionId(undefined)).toBeNull();
    expect(modeOf(chat).sessionId("   short  ")).toBeNull();
    expect(modeOf(chat).sessionId("x".repeat(101))).toBeNull();
  });

  it("a generation saves a new row every run, even when a session id is sent", () => {
    expect(modeOf(oneShot).sessionId("session-abcdefgh")).toBeNull();
    expect(modeOf(multiStage).sessionId("session-abcdefgh")).toBeNull();
  });
});
