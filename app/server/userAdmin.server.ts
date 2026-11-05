/**
 * Shared rules of the admin user pages (P28.1): the list (`/admin/users`) creates
 * accounts, the person page (`/admin/users/:id`) manages one.
 */

/** Shortest password the app accepts (same rule as the reset and invite pages). */
export const MIN_PASSWORD_LENGTH = 10;

/** Days a set-password link for a freshly created account stays valid. */
export const SET_PASSWORD_LINK_DAYS = 7;

/**
 * Whether the acting admin may manage `target` (P18.6): a teacher, or anyone when the
 * actor is the super admin. A regular admin never touches another admin (nor a
 * retired-role row — fail closed): that would be a way around the promotion rule.
 */
export function mayManage(actorIsOwner: boolean, target: { role: string }): boolean {
  return actorIsOwner || target.role === "teacher";
}
