/**
 * Sharing with your team (P28.4, BESLUIT-2026-11-05-5). Pure data, no server: which kinds
 * of item can be shared, and which tool work may ever reach a colleague.
 */
import { ALL_TOOLS, WORKPLACE_TOOLS } from "~/lib/registry";
import { modeOf } from "~/lib/registry/modes";
import type { Tool } from "~/lib/registry/types";

/** The only shareable kinds. A dossier, rubric scores and chats are never among them. */
export const SHARE_KINDS = ["course", "rubric", "contextProfile"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

/**
 * Work a colleague may see through a shared course: never from a tool that handles student
 * work, never a chat, never work built from the dossier.
 */
export function isShareableWork(tool: Tool): boolean {
  return !tool.handlesStudentWork && modeOf(tool).sharesWork && tool.contextFrom === undefined;
}

/** The tool slugs whose work may show in a shared course, for the repository's WHERE. */
export const SHAREABLE_WORK_SLUGS: readonly string[] = [...ALL_TOOLS, ...WORKPLACE_TOOLS]
  .filter(isShareableWork)
  .map((t) => t.slug);
