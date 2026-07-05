import type { Tool, UserType } from "./types";

/**
 * Instance-level roles. `student` is the constrained audience; `teacher` and
 * `admin` are full-access (teachers must be able to preview student tools).
 * SSO will later map institutional attributes onto these same three values.
 */
export type Role = "student" | "teacher" | "admin";

/**
 * The single source of truth for role × tool visibility — data-driven, no
 * per-tool branching. Enforced server-side in three places: the home loader
 * (list filter), the tool loader (404), and the stream action (refuse).
 *
 * - `student` → only tools whose `userType` is `"student"`, further narrowed to
 *   their cohort's `allowedSlugs` when they have one.
 * - `teacher` / `admin` → every tool (the allow-list never constrains them).
 *
 * `allowedSlugs` is resolved from the student's cohort (`getAllowedToolSlugs`).
 * `undefined`/`null` means unconstrained — a student with no cohort keeps today's
 * behaviour (all student tools), so nothing regresses.
 */
export function canUseTool(
  user: { role: Role },
  tool: Pick<Tool, "slug" | "userType"> | { slug: string; userType: UserType },
  allowedSlugs?: Set<string> | null,
): boolean {
  if (user.role !== "student") return true;
  if (tool.userType !== "student") return false;
  return !allowedSlugs || allowedSlugs.has(tool.slug);
}
