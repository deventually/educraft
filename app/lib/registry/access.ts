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
 * - `student` → only tools whose `userType` is `"student"`.
 * - `teacher` / `admin` → every tool.
 */
export function canUseTool(
  user: { role: Role },
  tool: Pick<Tool, "userType"> | { userType: UserType },
): boolean {
  if (user.role === "student") return tool.userType === "student";
  return true;
}
