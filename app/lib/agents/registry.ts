import type { Agent, AgentStand, AgentTarget } from "./types";

/** The v1 hats (BESLUIT-2026-11-05-3). A third hat only when the pilot asks for one. */
export const AGENTS: Agent[] = [
  {
    id: "assessment-expert",
    role: { nl: "Toetsdeskundige", en: "Assessment expert" },
    promptId: "agent-assessment@v2",
    watches: ["course", "generation"],
  },
  {
    id: "designer",
    role: { nl: "Ontwerper", en: "Designer" },
    promptId: "agent-design@v1",
    watches: ["course"],
  },
];

export function getAgent(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id);
}

export function agentsWatching(target: AgentTarget): Agent[] {
  return AGENTS.filter((a) => a.watches.includes(target));
}

/** The hats watching `target` that an admin has not switched off (absent = on). */
export function activeAgents(
  target: AgentTarget,
  stands: Partial<Record<string, AgentStand>>,
): Agent[] {
  return agentsWatching(target).filter((a) => stands[a.id] !== "off");
}
