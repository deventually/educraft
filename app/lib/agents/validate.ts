import { z } from "zod";
import { PROMPTS } from "~/lib/prompts";
import { AGENT_STANDS, AGENT_TARGETS, type Agent } from "./types";

export interface AgentValidationIssue {
  agent: string;
  message: string;
}

const AgentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  role: z.object({ nl: z.string().min(1), en: z.string().min(1) }),
  promptId: z.string().regex(/^[a-z0-9-]+@v\d+$/, "promptId must be <id>@vN"),
  watches: z.array(z.enum(AGENT_TARGETS)).min(1),
  focus: z.object({ nl: z.string().trim().min(1), en: z.string().trim().min(1) }),
  teacherDefault: z.enum(AGENT_STANDS),
});

/** Structural checks for the hat registry; empty = healthy. */
export function validateAgents(agents: Agent[]): AgentValidationIssue[] {
  const issues: AgentValidationIssue[] = [];
  const seen = new Set<string>();
  for (const agent of agents) {
    const parsed = AgentSchema.safeParse(agent);
    if (!parsed.success)
      issues.push({
        agent: agent.id,
        message: parsed.error.issues.map((i) => i.message).join("; "),
      });
    else if (!PROMPTS[agent.promptId])
      issues.push({ agent: agent.id, message: `Unknown prompt: ${agent.promptId}` });
    if (seen.has(agent.id)) issues.push({ agent: agent.id, message: "Duplicate agent id" });
    seen.add(agent.id);
  }
  return issues;
}
