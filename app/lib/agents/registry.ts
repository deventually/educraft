import type { Agent, AgentStand, AgentTarget } from "./types";

/**
 * The hats (BESLUIT-2026-11-05-3, BESLUIT-2026-11-10-1). Every hat has its own section in the
 * help topic `review-team` (tests/help.test.ts).
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
  {
    id: "ai-resilience",
    role: { nl: "AI-bestendigheid", en: "AI resilience" },
    promptId: "agent-ai-resilience@v1",
    watches: ["course"],
    focus: {
      nl: "Kijkt of je summatieve toetsen laten zien wat de student zelf kan, ook nu er AI is.",
      en: "Checks that your summative assessments show what students can do themselves, AI or not.",
    },
    teacherDefault: "off",
  },
  {
    id: "professional-practice",
    role: { nl: "Werkveld", en: "Professional practice" },
    promptId: "agent-professional-practice@v1",
    watches: ["course"],
    focus: {
      nl: "Kijkt of studenten oefenen en getoetst worden zoals in het beroep, op het niveau uit je vakgebiedpakket.",
      en: "Checks that students practise and are assessed as in the profession, at the level from your subject pack.",
    },
    teacherDefault: "off",
  },
  {
    id: "student",
    role: { nl: "Student", en: "Student" },
    promptId: "agent-student@v2",
    watches: ["course"],
    focus: {
      nl: "Loopt je cursus week voor week door zoals een student: is duidelijk wat er moet, vallen deadlines niet samen, komt feedback op tijd?",
      en: "Goes through your course week by week like a student: is it clear what to do, do deadlines not coincide, does feedback come in time?",
    },
    teacherDefault: "off",
  },
  {
    id: "inclusion",
    role: { nl: "Inclusie", en: "Inclusion" },
    promptId: "agent-inclusion@v1",
    watches: ["course"],
    focus: {
      nl: "Kijkt of studenten op meer dan één manier kunnen leren en laten zien wat ze kunnen.",
      en: "Checks that students can learn, and show what they can do, in more than one way.",
    },
    teacherDefault: "off",
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
