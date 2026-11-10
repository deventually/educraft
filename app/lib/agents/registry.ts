import type { Agent, AgentStand, AgentTarget } from "./types";

/**
 * The hats (BESLUIT-2026-11-05-3, BESLUIT-2026-11-10-1). Every hat has its own section in the
 * help topic `role-agents` (tests/help.test.ts).
 */
export const AGENTS: Agent[] = [
  {
    id: "assessment-expert",
    role: { nl: "Toetsdeskundige", en: "Assessment expert" },
    promptId: "agent-assessment@v2",
    watches: ["course", "generation"],
    focus: {
      nl: "Kijkt of je leeruitkomsten toetsbaar zijn en je toetsen meten wat ze beloven.",
      en: "Checks that your learning outcomes are testable and your assessments measure them.",
    },
    teacherDefault: "on",
  },
  {
    id: "designer",
    role: { nl: "Ontwerper", en: "Designer" },
    promptId: "agent-design@v1",
    watches: ["course"],
    focus: {
      nl: "Kijkt of je lessen en opdrachten studenten in een haalbare opbouw naar de leeruitkomsten brengen.",
      en: "Checks that your lessons and assignments lead students to the outcomes at a doable pace.",
    },
    teacherDefault: "on",
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

/** The hats a teacher chose, out of `agents`; a hat the teacher never touched follows its default. */
export function chosenAgents(
  agents: Agent[],
  choices: Partial<Record<string, AgentStand>>,
): Agent[] {
  return agents.filter((a) => (choices[a.id] ?? a.teacherDefault) === "on");
}
