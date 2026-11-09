/** What "With selected" on the user list can do (P28.1); shared by the page and its action. */
export const BULK_ACTIONS = ["addTeam", "removeTeam", "deactivate", "reactivate"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

/** Deactivate and reactivate are for the super admin only. */
export const OWNER_ONLY_BULK: readonly BulkAction[] = ["deactivate", "reactivate"];

/** The most people one bulk change may carry (the list shows at most 500). */
export const MAX_BULK = 500;
