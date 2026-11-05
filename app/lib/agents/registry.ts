import type { Agent, AgentTarget } from "./types";

/** The v1 hats (BESLUIT-2026-11-05-3). A third hat only when the pilot asks for one. */
export const AGENTS: Agent[] = [
  {
    id: "assessment-expert",
    role: { nl: "Toetsdeskundige", en: "Assessment expert" },
    promptId: "agent-assessment@v1",
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
