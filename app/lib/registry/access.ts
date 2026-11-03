/**
 * Instance-level roles. Both are full-access: every tool is visible to a teacher
 * or admin unless the instance settings switch it off or an admin narrows a
 * teacher's allow-list (see `availability.server.ts`). SSO will later map
 * institutional attributes onto these same two values.
 *
 * Note: `"student"` survives only as tool data (`Tool.userType`), which says who
 * a tool speaks to — never who may use it.
 */
export const ROLES = ["teacher", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Narrow an unknown value (e.g. a DB `role` string) to a known {@link Role}. */
export function isRole(x: unknown): x is Role {
  return typeof x === "string" && (ROLES as readonly string[]).includes(x);
}
