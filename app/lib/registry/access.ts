import type { Tool, UserType } from "./types";

/**
 * Instance-level roles. `student` is the constrained audience; `teacher` and
 * `admin` are full-access (teachers must be able to preview student tools).
 * SSO will later map institutional attributes onto these same three values.
 */
export type Role = "student" | "teacher" | "admin";

/**
 * The *effective* audience a tool is matched against. Extends the registry's
 * `UserType` with `"both"`, which only ever arrives as an instance-level
 * `audienceOverride` (Phase 4) — never as a tool's native `userType`.
 */
export type Audience = UserType | "both";

/**
 * The single source of truth for role × tool visibility — data-driven, no
 * per-tool branching. Enforced server-side in three places: the home loader
 * (list filter), the tool loader (404), and the stream action (refuse).
 *
 * - `student` → only tools whose audience is `"student"` (or `"both"`), further
 *   narrowed to their cohort's `allowedSlugs` when they have one.
 * - `teacher` / `admin` → every tool (the allow-list never constrains them).
 *
 * The audience is `audienceOverride ?? tool.userType` (Phase 4): an admin can
 * open an instructor tool to students via a `"both"` override without editing
 * the registry. `allowedSlugs` is resolved from the student's cohort
 * (`getAllowedToolSlugs`); `undefined`/`null` means unconstrained — a student
 * with no cohort keeps today's behaviour (all student tools), so nothing
 * regresses.
 */
export function canUseTool(
  user: { role: Role },
  tool: Pick<Tool, "slug" | "userType"> | { slug: string; userType: Audience },
  allowedSlugs?: Set<string> | null,
): boolean {
  if (user.role !== "student") return true;
  if (tool.userType !== "student" && tool.userType !== "both") return false;
  return !allowedSlugs || allowedSlugs.has(tool.slug);
}
