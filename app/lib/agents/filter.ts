/**
 * Checks a hat's answer before a teacher ever sees it (brief P21, 21.1).
 * Anti-fabrication lives here, in code, not only in the prompt: a finding that
 * points at a key the course does not have is dropped, as are duplicates and
 * advice the teacher rejected before. Long text is clipped, never trusted.
 */
import { extractJson } from "~/lib/ai/extractJson";
import type { CourseData } from "~/lib/courses/types";
import { courseKeys } from "./input";
import { AGENT_LIMITS, RawAgentReviewSchema } from "./schema";
import type { AgentFinding, RejectedFinding } from "./types";

export type AgentParseResult =
  | { ok: true; findings: AgentFinding[] }
  | { ok: false; error: "unparseable" };

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

function sameKey(targetId: string | undefined, message: string): string {
  return `${targetId ?? ""}|${message.replace(/\s+/g, " ").trim().toLowerCase()}`;
}

export function parseAgentReview(
  raw: string,
  course: CourseData,
  rejected: RejectedFinding[],
): AgentParseResult {
  const parsed = RawAgentReviewSchema.safeParse(extractJson(raw));
  if (!parsed.success) return { ok: false, error: "unparseable" };

  const keys = courseKeys(course);
  const seen = new Set(rejected.map((r) => sameKey(r.targetId, r.message)));
  const findings: AgentFinding[] = [];
  for (const f of parsed.data.findings) {
    if (findings.length >= AGENT_LIMITS.findings) break;
    const message = clip(f.message, AGENT_LIMITS.message);
    if (!message) continue;
    const target = f.target?.trim();
    if (target && !Object.hasOwn(keys, target)) continue;
    const targetId = target ? keys[target] : undefined;
    const id = sameKey(targetId, message);
    if (seen.has(id)) continue;
    seen.add(id);
    const finding: AgentFinding = {
      severity: f.severity,
      message,
      suggestion: clip(f.suggestion ?? "", AGENT_LIMITS.suggestion),
    };
    if (targetId) finding.targetId = targetId;
    findings.push(finding);
  }
  return { ok: true, findings };
}
