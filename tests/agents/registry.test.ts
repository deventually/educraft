import { describe, expect, it } from "vitest";
import {
  activeAgents,
  AGENTS,
  agentsWatching,
  chosenAgents,
  getAgent,
} from "~/lib/agents/registry";
import { validateAgents } from "~/lib/agents/validate";
import type { Agent } from "~/lib/agents/types";
import { loc } from "~/lib/i18n/localized";

function valid(): Agent {
  return {
    id: "test-hat",
    role: { nl: "Testpet", en: "Test hat" },
    promptId: "agent-design@v1",
    watches: ["course"],
    focus: { nl: "Let op testen.", en: "Looks at tests." },
    teacherDefault: "on",
  };
}

describe("agent registry (P21.1)", () => {
  it("has the reviewers in order, each bilingual and valid", () => {
    expect(AGENTS.map((a) => a.id)).toEqual([
      "assessment-expert",
      "designer",
      "ai-resilience",
      "professional-practice",
      "student",
    ]);
    expect(validateAgents(AGENTS)).toEqual([]);
  });

  it("looks a hat up by id", () => {
    expect(getAgent("designer")?.role).toEqual({ nl: "Ontwerper", en: "Designer" });
    expect(getAgent("nope")).toBeUndefined();
  });

  it("lists the hats that watch a target", () => {
    expect(agentsWatching("course").map((a) => a.id)).toEqual([
      "assessment-expert",
      "designer",
      "ai-resilience",
      "professional-practice",
      "student",
    ]);
    expect(agentsWatching("generation").map((a) => a.id)).toEqual(["assessment-expert"]);
  });

  it("leaves out the hats an admin switched off; an untouched hat is on", () => {
    const ids = (stands: Record<string, "on" | "off">) =>
      activeAgents("course", stands).map((a) => a.id);
    expect(ids({})).toEqual([
      "assessment-expert",
      "designer",
      "ai-resilience",
      "professional-practice",
      "student",
    ]);
    expect(ids({ designer: "off", "professional-practice": "off", student: "off" })).toEqual([
      "assessment-expert",
      "ai-resilience",
    ]);
    expect(
      ids({
        "ai-resilience": "off",
        "assessment-expert": "off",
        "professional-practice": "off",
        student: "off",
      }),
    ).toEqual(["designer"]);
  });
});

describe("the teacher's own choice of hats", () => {
  it("gives every reviewer a one-line focus; only the first two are on for a teacher by default", () => {
    expect(AGENTS.filter((a) => a.teacherDefault === "on").map((a) => a.id)).toEqual([
      "assessment-expert",
      "designer",
    ]);
    for (const a of AGENTS) {
      expect(loc(a.focus, "nl").trim()).not.toBe("");
      expect(loc(a.focus, "en").trim()).not.toBe("");
    }
  });

  it("follows the teacher's choice, and the hat's default when the teacher never chose", () => {
    const off: Agent = { ...valid(), id: "quiet-hat", teacherDefault: "off" };
    const hats = [valid(), off];
    const ids = (choices: Record<string, "on" | "off">) =>
      chosenAgents(hats, choices).map((a) => a.id);
    expect(ids({})).toEqual(["test-hat"]);
    expect(ids({ "test-hat": "off" })).toEqual([]);
    expect(ids({ "quiet-hat": "on" })).toEqual(["test-hat", "quiet-hat"]);
    expect(ids({ "quiet-hat": "on", "test-hat": "off" })).toEqual(["quiet-hat"]);
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

  it("rejects a hat without a bilingual focus or with an unknown teacher default", () => {
    expect(validateAgents([{ ...valid(), focus: { nl: "Iets", en: "" } }])).toHaveLength(1);
    const bad = { ...valid(), teacherDefault: "maybe" } as unknown as Agent;
    expect(validateAgents([bad])).toHaveLength(1);
  });

  it("rejects an empty or unknown watch list", () => {
    expect(validateAgents([{ ...valid(), watches: [] }])).toHaveLength(1);
    const bad = { ...valid(), watches: ["student"] } as unknown as Agent;
    expect(validateAgents([bad])).toHaveLength(1);
  });
});
