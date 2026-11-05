import { describe, expect, it } from "vitest";
import { activeAgents, AGENTS, agentsWatching, getAgent } from "~/lib/agents/registry";
import { validateAgents } from "~/lib/agents/validate";
import type { Agent } from "~/lib/agents/types";

function valid(): Agent {
  return {
    id: "test-hat",
    role: { nl: "Testpet", en: "Test hat" },
    promptId: "agent-design@v1",
    watches: ["course"],
  };
}

describe("agent registry (P21.1)", () => {
  it("has exactly the two v1 hats, each bilingual and valid", () => {
    expect(AGENTS.map((a) => a.id)).toEqual(["assessment-expert", "designer"]);
    expect(validateAgents(AGENTS)).toEqual([]);
  });

  it("looks a hat up by id", () => {
    expect(getAgent("designer")?.role).toEqual({ nl: "Ontwerper", en: "Designer" });
    expect(getAgent("nope")).toBeUndefined();
  });

  it("lists the hats that watch a target", () => {
    expect(agentsWatching("course").map((a) => a.id)).toEqual(["assessment-expert", "designer"]);
    expect(agentsWatching("generation").map((a) => a.id)).toEqual(["assessment-expert"]);
  });

  it("leaves out the hats an admin switched off; an untouched hat is on", () => {
    const ids = (stands: Record<string, "on" | "off">) =>
      activeAgents("course", stands).map((a) => a.id);
    expect(ids({})).toEqual(["assessment-expert", "designer"]);
    expect(ids({ designer: "off" })).toEqual(["assessment-expert"]);
    expect(ids({ designer: "on", "assessment-expert": "off" })).toEqual(["designer"]);
  });
});

describe("validateAgents", () => {
  it("accepts a valid hat", () => {
    expect(validateAgents([valid()])).toEqual([]);
  });

  it("rejects duplicate ids", () => {
    expect(validateAgents([valid(), valid()])).toEqual([
      { agent: "test-hat", message: "Duplicate agent id" },
    ]);
  });

  it("rejects a role without both languages", () => {
    const a = { ...valid(), role: { nl: "Testpet", en: "" } };
    expect(validateAgents([a]).map((i) => i.agent)).toEqual(["test-hat"]);
  });

  it("rejects a prompt that is not registered", () => {
    const a = { ...valid(), promptId: "agent-missing@v1" };
    expect(validateAgents([a])).toEqual([
      { agent: "test-hat", message: "Unknown prompt: agent-missing@v1" },
    ]);
  });

  it("rejects a prompt id without a version", () => {
    const a = { ...valid(), promptId: "agent-test" };
    expect(validateAgents([a]).map((i) => i.agent)).toEqual(["test-hat"]);
  });

  it("rejects an empty or unknown watch list", () => {
    expect(validateAgents([{ ...valid(), watches: [] }])).toHaveLength(1);
    const bad = { ...valid(), watches: ["student"] } as unknown as Agent;
    expect(validateAgents([bad])).toHaveLength(1);
  });
});
