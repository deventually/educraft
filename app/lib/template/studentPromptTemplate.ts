import type { ContextProfile } from "~/lib/context/types";
import type { OutputLanguage, Tool } from "~/lib/registry/types";
import { buildSystemPrompt } from "./buildSystemPrompt";

/**
 * The text a teacher copies for students (P31.1, `Tool.copyableStudentPrompt`), built on the
 * server once per language: the profile, in the learner register, is filled in; every form
 * field stays a `{{placeholder}}` for the browser to fill with what the teacher entered
 * (`fillStudentPrompt`). So the prompt files never ship to the browser as a whole.
 */
export function studentPromptTemplates(
  tool: Tool,
  profile: ContextProfile | null | undefined,
): Record<OutputLanguage, string> {
  const promptId = tool.stages[0]?.systemPromptId ?? "";
  const values = Object.fromEntries(tool.inputs.map((f) => [f.name, `{{${f.name}}}`]));
  const build = (outputLanguage: OutputLanguage) =>
    buildSystemPrompt({ promptId, values, profile, outputLanguage, audience: "learner" });
  return { nl: build("nl"), en: build("en") };
}
